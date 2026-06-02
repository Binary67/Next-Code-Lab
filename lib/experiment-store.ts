import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  applyExperimentDefaults,
  type Experiment,
} from "@/lib/experiments";
import { readTrialTokenUsage } from "@/lib/trial-log-store";
import type { TokenUsage } from "@/lib/codex/types";

const localDataDir = join(process.cwd(), ".local");
const experimentsPath = join(localDataDir, "experiments.json");

function isMissingFile(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}

export async function readExperiments(): Promise<Experiment[]> {
  try {
    const raw = await readFile(experimentsPath, "utf8");
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      throw new Error(`${experimentsPath} must contain an experiment array.`);
    }

    return Promise.all(
      (parsed as Experiment[])
        .map(applyExperimentDefaults)
        .map(hydrateTokenUsageFromLogs),
    );
  } catch (error) {
    if (!isMissingFile(error)) {
      throw error;
    }

    await writeExperiments([]);
    return [];
  }
}

async function hydrateTokenUsageFromLogs(
  experiment: Experiment,
): Promise<Experiment> {
  const trials = await Promise.all(
    experiment.trials.map(async (trial) => {
      const tokenUsage = await readTrialTokenUsage(experiment.id, trial.id);

      if (
        !tokenUsage ||
        (trial.tokenUsage &&
          tokenUsageTotal(trial.tokenUsage) >= tokenUsageTotal(tokenUsage))
      ) {
        return trial;
      }

      return { ...trial, tokenUsage };
    }),
  );

  return { ...experiment, trials };
}

function tokenUsageTotal(tokenUsage: TokenUsage) {
  return tokenUsage.inputTokens + tokenUsage.outputTokens;
}

export async function writeExperiments(experiments: Experiment[]) {
  await mkdir(localDataDir, { recursive: true });
  await writeFile(
    experimentsPath,
    `${JSON.stringify(experiments, null, 2)}\n`,
    "utf8",
  );
}
