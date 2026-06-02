import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { Experiment } from "@/lib/experiments";

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

    return parsed as Experiment[];
  } catch (error) {
    if (!isMissingFile(error)) {
      throw error;
    }

    await writeExperiments([]);
    return [];
  }
}

export async function writeExperiments(experiments: Experiment[]) {
  await mkdir(localDataDir, { recursive: true });
  await writeFile(
    experimentsPath,
    `${JSON.stringify(experiments, null, 2)}\n`,
    "utf8",
  );
}
