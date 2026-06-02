import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";

import type { TrialEvaluationContract } from "@/lib/codex/types";

export function evalArtifactDir(experimentId: string) {
  return resolve(process.cwd(), ".local", "evals", experimentId);
}

export function resolveEvalArtifactPath(
  experimentId: string,
  scriptPath: string,
) {
  const baseDir = evalArtifactDir(experimentId);
  const targetPath = resolve(process.cwd(), scriptPath);
  const rel = relative(baseDir, targetPath);

  if (isAbsolute(scriptPath) || rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error("Generated eval path must stay under .local/evals.");
  }

  return targetPath;
}

export async function writeGeneratedEvalScript(
  experimentId: string,
  contract: TrialEvaluationContract,
  scriptContent: string,
) {
  const scriptPath = resolveEvalArtifactPath(experimentId, contract.scriptPath);

  await mkdir(dirname(scriptPath), { recursive: true });
  await writeFile(
    scriptPath,
    scriptContent.endsWith("\n") ? scriptContent : `${scriptContent}\n`,
    "utf8",
  );
}
