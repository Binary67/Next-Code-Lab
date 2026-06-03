import { exec as execCallback } from "node:child_process";
import { promisify } from "node:util";

import type { RepoRunbook, TrialEvaluationContract } from "@/lib/codex/types";

const execAsync = promisify(execCallback);
const maxBuffer = 10 * 1024 * 1024;

function commandErrorMessage(error: unknown) {
  const record = error as { message?: string; stderr?: string; stdout?: string };
  const detail =
    record.stderr?.trim() || record.stdout?.trim() || record.message;

  return detail || "Command failed.";
}

function evaluationEnv(targetRepoPath: string, baseRepoPath: string) {
  return {
    ...process.env,
    OPTIMIZER_TARGET_REPO: targetRepoPath,
    OPTIMIZER_BASE_REPO: baseRepoPath,
  };
}

function setupCommands(runbook: RepoRunbook | undefined) {
  const commands =
    runbook?.dependencyManagers.flatMap((manager) => manager.setupCommands) ??
    [];

  return Array.from(
    new Set(commands.map((command) => command.trim()).filter(Boolean)),
  );
}

async function trackedStatus(repoPath: string) {
  const { stdout } = await execAsync(
    "git status --porcelain --untracked-files=no",
    {
      cwd: repoPath,
      maxBuffer,
    },
  );

  return stdout.trim();
}

async function prepareEvaluationWorktree(
  runbook: RepoRunbook | undefined,
  targetRepoPath: string,
  baseRepoPath: string,
) {
  const commands = setupCommands(runbook);

  for (const command of commands) {
    try {
      await execAsync(command, {
        cwd: targetRepoPath,
        env: evaluationEnv(targetRepoPath, baseRepoPath),
        maxBuffer,
      });
    } catch (error) {
      throw new Error(
        `Eval setup command failed (${command}): ${commandErrorMessage(error)}`,
        { cause: error },
      );
    }
  }

  const status = await trackedStatus(targetRepoPath);
  if (status) {
    throw new Error(
      [
        "Eval setup command modified tracked files.",
        "Dependency changes must be committed by the trial before evaluation.",
        status,
      ].join("\n"),
    );
  }
}

export async function runEvaluation(
  contract: TrialEvaluationContract,
  targetRepoPath: string,
  baseRepoPath: string,
  runbook?: RepoRunbook,
) {
  try {
    await prepareEvaluationWorktree(runbook, targetRepoPath, baseRepoPath);
    const { stdout } = await execAsync(contract.runCommand, {
      cwd: process.cwd(),
      env: evaluationEnv(targetRepoPath, baseRepoPath),
      maxBuffer,
    });
    const score = Number(stdout.trim());

    if (!Number.isFinite(score)) {
      throw new Error("Eval command must print one numeric score.");
    }

    return score;
  } catch (error) {
    throw new Error(`Evaluation failed: ${commandErrorMessage(error)}`, {
      cause: error,
    });
  }
}
