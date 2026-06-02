"use server";

import { stat } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

import { CodexEvalSetupAgent } from "@/lib/codex/eval-setup-agent";
import type {
  EvalSetupAgentResult,
  TrialEvaluationContract,
} from "@/lib/codex/types";
import { writeExperiments } from "@/lib/experiment-store";
import type { Experiment } from "@/lib/experiments";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

type StartEvalInterviewInput = {
  experimentId: string;
  repoPath: string;
  title: string;
  objective: string;
};

type SendEvalSetupReplyInput = {
  threadId: string;
  repoPath: string;
  reply: string;
};

type ApproveGeneratedEvaluationInput = {
  threadId: string;
  repoPath: string;
  proposedContract: TrialEvaluationContract;
};

const evalSetupAgent = new CodexEvalSetupAgent();

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Eval setup failed.";
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
    throw new Error("Eval setup only supports existing local repository paths.");
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
    void input.experimentId;
    const repoPath = await resolveLocalRepoPath(input.repoPath);
    const result = await evalSetupAgent.startInterview({
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
      evalSetupThreadId: requiredString(input.threadId, "eval setup thread ID"),
      repoPath,
      proposedContract: normalizeContract(input.proposedContract),
    });

    return { ok: true, data: result };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
