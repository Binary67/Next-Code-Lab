"use server";

import { stat } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

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

function validateScriptPath(scriptPath: string) {
  if (
    scriptPath.startsWith("/") ||
    scriptPath.split(/[\\/]/).includes("..")
  ) {
    throw new Error("Generated eval must use a repo-relative script path.");
  }

  return scriptPath;
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
