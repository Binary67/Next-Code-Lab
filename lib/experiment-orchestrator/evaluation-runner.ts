import { exec as execCallback } from "node:child_process";
import { promisify } from "node:util";

import type { TrialEvaluationContract } from "@/lib/codex/types";

const execAsync = promisify(execCallback);

function commandErrorMessage(error: unknown) {
  const record = error as { message?: string; stderr?: string; stdout?: string };
  const detail =
    record.stderr?.trim() || record.stdout?.trim() || record.message;

  return detail || "Command failed.";
}

export async function runEvaluation(
  contract: TrialEvaluationContract,
  targetRepoPath: string,
  baseRepoPath: string,
) {
  try {
    const { stdout } = await execAsync(contract.runCommand, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        OPTIMIZER_TARGET_REPO: targetRepoPath,
        OPTIMIZER_BASE_REPO: baseRepoPath,
      },
      maxBuffer: 10 * 1024 * 1024,
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
