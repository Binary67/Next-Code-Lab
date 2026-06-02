"use server";

import { execFile as execFileCallback } from "node:child_process";
import { readdir, rm, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { promisify } from "node:util";

import { CodexEvalSetupAgent } from "@/lib/codex/eval-setup-agent";
import type {
  EvalSetupAgentResult,
  TrialEvaluationContract,
} from "@/lib/codex/types";
import { writeGeneratedEvalScript } from "@/lib/eval-artifacts";
import { writeExperiments } from "@/lib/experiment-store";
import { ExperimentOrchestrator } from "@/lib/experiment-orchestrator";
import type { Experiment } from "@/lib/experiments";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

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
};

type ApproveGeneratedEvaluationInput = {
  experimentId: string;
  threadId: string;
  repoPath: string;
  proposedContract: TrialEvaluationContract;
};

type StartExperimentInput = {
  experiment: Experiment;
};

type DeleteExperimentInput = {
  experiment: Experiment;
  remainingExperiments: Experiment[];
};

const execFileAsync = promisify(execFileCallback);
const evalSetupAgent = new CodexEvalSetupAgent();
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
): Promise<ActionResult<EvalSetupAgentResult>> {
  try {
    const repoPath = await resolveLocalRepoPath(input.repoPath);
    const result = await evalSetupAgent.startInterview({
      experimentId: requiredString(input.experimentId, "experiment ID"),
      repoPath,
      title: requiredString(input.title, "experiment title"),
      objective: requiredString(input.objective, "experiment objective"),
    });

    return { ok: true, data: result };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function sendEvalSetupReply(
  input: SendEvalSetupReplyInput,
): Promise<ActionResult<EvalSetupAgentResult>> {
  try {
    const repoPath = await resolveLocalRepoPath(input.repoPath);
    const result = await evalSetupAgent.continueInterview({
      experimentId: requiredString(input.experimentId, "experiment ID"),
      evalSetupThreadId: requiredString(input.threadId, "eval setup thread ID"),
      repoPath,
      reply: requiredString(input.reply, "reply"),
    });

    return { ok: true, data: result };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function approveGeneratedEvaluation(
  input: ApproveGeneratedEvaluationInput,
): Promise<ActionResult<EvalSetupAgentResult>> {
  try {
    const repoPath = await resolveLocalRepoPath(input.repoPath);
    const result = await evalSetupAgent.approveGenerated({
      experimentId: requiredString(input.experimentId, "experiment ID"),
      evalSetupThreadId: requiredString(input.threadId, "eval setup thread ID"),
      repoPath,
      proposedContract: normalizeContract(input.proposedContract),
    });

    if (result.response.status !== "generated") {
      throw new Error("Codex did not return a generated eval script.");
    }

    await writeGeneratedEvalScript(
      requiredString(input.experimentId, "experiment ID"),
      result.response.contract,
      result.response.scriptContent,
    );

    return { ok: true, data: result };
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
