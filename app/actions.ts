"use server";

import { execFile as execFileCallback } from "node:child_process";
import { readdir, rm, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { promisify } from "node:util";

import { CodexEvalSetupAgent } from "@/lib/codex/eval-setup-agent";
import {
  CodexRunbookAgent,
  parseRepoRunbook,
} from "@/lib/codex/runbook-agent";
import type {
  EvalSetupAgentResult,
  RepoRunbook,
  TrialEvaluationContract,
} from "@/lib/codex/types";
import { writeGeneratedEvalScript } from "@/lib/eval-artifacts";
import { writeExperiments } from "@/lib/experiment-store";
import { ExperimentOrchestrator } from "@/lib/experiment-orchestrator";
import type { Experiment } from "@/lib/experiments";
import { deleteExperimentTrialLogs } from "@/lib/trial-log-store";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

type EvalSetupActionResult = EvalSetupAgentResult & {
  runbook: RepoRunbook;
};

type StartEvalInterviewInput = {
  experimentId: string;
  repoPath: string;
  title: string;
  objective: string;
};

type SendEvalSetupReplyInput = {
  experimentId: string;
  threadId: string;
  repoPath: string;
  reply: string;
  runbook?: RepoRunbook;
};

type ApproveGeneratedEvaluationInput = {
  experimentId: string;
  threadId: string;
  repoPath: string;
  proposedContract: TrialEvaluationContract;
  runbook?: RepoRunbook;
};

type StartExperimentInput = {
  experiment: Experiment;
};

type ReadTrialDiffInput = {
  experimentId: string;
  repoPath: string;
  baseCommit?: string;
  trialId: string;
  commitSha?: string;
  branchName?: string;
};

type TrialDiff = {
  trialId: string;
  targetRef: string;
  diff: string;
};

type DeleteExperimentInput = {
  experiment: Experiment;
  remainingExperiments: Experiment[];
};

const execFileAsync = promisify(execFileCallback);
const evalSetupAgent = new CodexEvalSetupAgent();
const runbookAgent = new CodexRunbookAgent();
const experimentOrchestrator = new ExperimentOrchestrator();

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed.";
}

function isRemoteRepoPath(repoPath: string) {
  return (
    /^[a-z][a-z0-9+.-]*:\/\//i.test(repoPath) ||
    /^[\w.-]+@[\w.-]+:.+/.test(repoPath)
  );
}

function isMissingFile(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}

async function runGit(cwd: string, args: string[]) {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    maxBuffer: 10 * 1024 * 1024,
  });

  return stdout.trim();
}

async function resolveLocalRepoPath(repoPath: string) {
  const trimmed = repoPath.trim();

  if (!trimmed) {
    throw new Error("Select an existing local repository path first.");
  }

  if (isRemoteRepoPath(trimmed)) {
    throw new Error("Experiments only support existing local repository paths.");
  }

  const resolved = isAbsolute(trimmed) ? trimmed : resolve(trimmed);
  const stats = await stat(resolved).catch(() => null);

  if (!stats?.isDirectory()) {
    throw new Error("Eval setup repository path does not exist.");
  }

  return resolved;
}

function requiredString(value: string, field: string) {
  if (!value.trim()) {
    throw new Error(`Missing ${field}.`);
  }

  return value.trim();
}

function requiredExperimentId(value: string) {
  const experimentId = requiredString(value, "experiment ID");

  if (!/^[a-z0-9-]+$/.test(experimentId)) {
    throw new Error("Experiment ID contains unsupported characters.");
  }

  return experimentId;
}

function requiredGitRef(value: string | undefined, field: string) {
  const ref = requiredString(value ?? "", field);

  if (ref.startsWith("-")) {
    throw new Error(`${field} cannot start with a dash.`);
  }

  return ref;
}

function localExperimentPath(kind: "evals" | "worktrees", experimentId: string) {
  const root = resolve(process.cwd(), ".local", kind);
  const target = resolve(root, experimentId);
  const rel = relative(root, target);

  if (!rel || rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error("Experiment cleanup path must stay under .local.");
  }

  return target;
}

function validateScriptPath(scriptPath: string) {
  if (
    scriptPath.startsWith("/") ||
    scriptPath.split(/[\\/]/).includes("..")
  ) {
    throw new Error("Generated eval must use a repo-relative script path.");
  }

  return scriptPath;
}

async function readChildDirectories(path: string) {
  try {
    const entries = await readdir(path, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => resolve(path, entry.name));
  } catch (error) {
    if (isMissingFile(error)) {
      return [];
    }

    throw error;
  }
}

async function removeExperimentWorktrees(
  repoRoot: string,
  experimentId: string,
) {
  const root = localExperimentPath("worktrees", experimentId);
  const worktrees = await readChildDirectories(root);

  for (const worktree of worktrees) {
    try {
      await runGit(repoRoot, ["worktree", "remove", "--force", worktree]);
    } catch {
      await rm(worktree, { recursive: true, force: true });
    }
  }

  await runGit(repoRoot, ["worktree", "prune"]);
  await rm(root, { recursive: true, force: true });
}

async function deleteExperimentBranches(repoRoot: string, experimentId: string) {
  const output = await runGit(repoRoot, [
    "branch",
    "--format=%(refname:short)",
    "--list",
    `optimizer/${experimentId}/*`,
  ]);
  const branches = output.split("\n").filter(Boolean);

  for (const branch of branches) {
    await runGit(repoRoot, ["branch", "-D", branch]);
  }
}

function normalizeContract(
  contract: TrialEvaluationContract,
): TrialEvaluationContract {
  if (
    contract.scoreDirection !== "minimize" &&
    contract.scoreDirection !== "maximize"
  ) {
    throw new Error("Generated eval has an invalid score direction.");
  }

  return {
    scriptPath: validateScriptPath(
      requiredString(contract.scriptPath, "script path"),
    ),
    runCommand: requiredString(contract.runCommand, "run command"),
    scoreName: requiredString(contract.scoreName, "score name"),
    scoreDirection: contract.scoreDirection,
  };
}

async function resolveRunbook(repoPath: string, runbook?: RepoRunbook) {
  if (runbook) {
    return parseRepoRunbook(runbook);
  }

  const result = await runbookAgent.createRunbook(repoPath);
  return result.runbook;
}

export async function saveExperiments(experiments: Experiment[]) {
  await writeExperiments(experiments);
}

export async function deleteExperiment(
  input: DeleteExperimentInput,
): Promise<ActionResult<null>> {
  try {
    const experimentId = requiredExperimentId(input.experiment.id);
    const repoPath = await resolveLocalRepoPath(input.experiment.repo);
    const repoRoot = await runGit(repoPath, ["rev-parse", "--show-toplevel"]);

    await removeExperimentWorktrees(repoRoot, experimentId);
    await deleteExperimentBranches(repoRoot, experimentId);
    await rm(localExperimentPath("evals", experimentId), {
      recursive: true,
      force: true,
    });
    await deleteExperimentTrialLogs(experimentId);
    await writeExperiments(
      input.remainingExperiments.filter(
        (experiment) => experiment.id !== experimentId,
      ),
    );

    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function startEvalInterview(
  input: StartEvalInterviewInput,
): Promise<ActionResult<EvalSetupActionResult>> {
  try {
    const repoPath = await resolveLocalRepoPath(input.repoPath);
    const runbook = await resolveRunbook(repoPath);
    const result = await evalSetupAgent.startInterview({
      experimentId: requiredString(input.experimentId, "experiment ID"),
      repoPath,
      title: requiredString(input.title, "experiment title"),
      objective: requiredString(input.objective, "experiment objective"),
      runbook,
    });

    return { ok: true, data: { ...result, runbook } };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function sendEvalSetupReply(
  input: SendEvalSetupReplyInput,
): Promise<ActionResult<EvalSetupActionResult>> {
  try {
    const repoPath = await resolveLocalRepoPath(input.repoPath);
    const runbook = await resolveRunbook(repoPath, input.runbook);
    const result = await evalSetupAgent.continueInterview({
      experimentId: requiredString(input.experimentId, "experiment ID"),
      evalSetupThreadId: requiredString(input.threadId, "eval setup thread ID"),
      repoPath,
      reply: requiredString(input.reply, "reply"),
      runbook,
    });

    return { ok: true, data: { ...result, runbook } };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function approveGeneratedEvaluation(
  input: ApproveGeneratedEvaluationInput,
): Promise<ActionResult<EvalSetupActionResult>> {
  try {
    const repoPath = await resolveLocalRepoPath(input.repoPath);
    const runbook = await resolveRunbook(repoPath, input.runbook);
    const result = await evalSetupAgent.approveGenerated({
      experimentId: requiredString(input.experimentId, "experiment ID"),
      evalSetupThreadId: requiredString(input.threadId, "eval setup thread ID"),
      repoPath,
      proposedContract: normalizeContract(input.proposedContract),
      runbook,
    });

    if (result.response.status !== "generated") {
      throw new Error("Codex did not return a generated eval script.");
    }

    await writeGeneratedEvalScript(
      requiredString(input.experimentId, "experiment ID"),
      result.response.contract,
      result.response.scriptContent,
    );

    return { ok: true, data: { ...result, runbook } };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function startExperiment(
  input: StartExperimentInput,
): Promise<ActionResult<Experiment>> {
  try {
    const repoPath = await resolveLocalRepoPath(input.experiment.repo);
    const result = await experimentOrchestrator.start({
      experiment: input.experiment,
      repoPath,
    });

    return { ok: true, data: result };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function readTrialDiff(
  input: ReadTrialDiffInput,
): Promise<ActionResult<TrialDiff>> {
  try {
    requiredExperimentId(input.experimentId);
    const repoPath = await resolveLocalRepoPath(input.repoPath);
    const repoRoot = await runGit(repoPath, ["rev-parse", "--show-toplevel"]);
    const baseCommit = requiredGitRef(input.baseCommit, "base commit");
    const targetRef = requiredGitRef(
      input.commitSha || input.branchName,
      "trial diff target",
    );
    const { stdout } = await execFileAsync(
      "git",
      [
        "diff",
        "--no-ext-diff",
        "--find-renames",
        "--unified=3",
        baseCommit,
        targetRef,
      ],
      {
        cwd: repoRoot,
        maxBuffer: 20 * 1024 * 1024,
      },
    );

    return {
      ok: true,
      data: {
        trialId: requiredString(input.trialId, "trial ID"),
        targetRef,
        diff: stdout,
      },
    };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
