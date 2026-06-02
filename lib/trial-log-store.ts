import { appendFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";

import type { TokenUsage } from "@/lib/codex/types";

const localDataDir = resolve(process.cwd(), ".local");
const trialLogsDir = resolve(localDataDir, "trial-logs");

type TrialLogMeta = {
  path: string;
  updatedAt?: string;
};

type CreateTrialLogInput = {
  experimentId: string;
  trialId: string;
  title: string;
  status: string;
  threadId?: string;
  branchName?: string;
  agentWorktreePath?: string;
  evalWorktreePath?: string;
};

function isMissingFile(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}

function validateSegment(value: string, field: string) {
  if (!/^[A-Za-z0-9-]+$/.test(value)) {
    throw new Error(`${field} contains unsupported characters.`);
  }

  return value;
}

function resolveTrialLogPath(experimentId: string, trialId: string) {
  const safeExperimentId = validateSegment(experimentId, "Experiment ID");
  const safeTrialId = validateSegment(trialId, "Trial ID");
  const target = resolve(trialLogsDir, safeExperimentId, `${safeTrialId}.md`);
  const rel = relative(trialLogsDir, target);

  if (!rel || rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error("Trial log path must stay under .local/trial-logs.");
  }

  return target;
}

function relativeTrialLogPath(experimentId: string, trialId: string) {
  return `.local/trial-logs/${experimentId}/${trialId}.md`;
}

async function readUpdatedAt(path: string) {
  try {
    const stats = await stat(path);
    return stats.mtime.toISOString();
  } catch (error) {
    if (isMissingFile(error)) {
      return undefined;
    }

    throw error;
  }
}

function ensureTrailingBlankLine(value: string) {
  return value.endsWith("\n\n") ? value : `${value.replace(/\s+$/u, "")}\n\n`;
}

function emptyTokenUsage(): TokenUsage {
  return {
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    reasoningOutputTokens: 0,
  };
}

export function parseTrialLogTokenUsage(markdown: string): TokenUsage | undefined {
  const usage = emptyTokenUsage();
  let found = false;

  for (const match of markdown.matchAll(
    /^(Input tokens|Cached input tokens|Output tokens|Reasoning output tokens):\s*(\d+)\s*$/gmu,
  )) {
    found = true;
    const value = Number(match[2]);

    if (match[1] === "Input tokens") {
      usage.inputTokens += value;
    } else if (match[1] === "Cached input tokens") {
      usage.cachedInputTokens += value;
    } else if (match[1] === "Output tokens") {
      usage.outputTokens += value;
    } else {
      usage.reasoningOutputTokens += value;
    }
  }

  return found ? usage : undefined;
}

export async function createTrialLog(
  input: CreateTrialLogInput,
): Promise<TrialLogMeta> {
  const path = resolveTrialLogPath(input.experimentId, input.trialId);
  const lines = [
    `# ${input.trialId} - ${input.title}`,
    "",
    `Status: ${input.status}`,
    `Thread: ${input.threadId ?? "pending"}`,
    `Branch: ${input.branchName ?? "pending"}`,
    `Agent worktree: ${input.agentWorktreePath ?? "pending"}`,
    `Eval worktree: ${input.evalWorktreePath ?? "pending"}`,
    "",
  ];

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, lines.join("\n"), "utf8");

  return {
    path: relativeTrialLogPath(input.experimentId, input.trialId),
    updatedAt: await readUpdatedAt(path),
  };
}

export async function appendTrialLog(
  experimentId: string,
  trialId: string,
  markdown: string,
) {
  const path = resolveTrialLogPath(experimentId, trialId);

  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, ensureTrailingBlankLine(markdown), "utf8");

  return {
    path: relativeTrialLogPath(experimentId, trialId),
    updatedAt: await readUpdatedAt(path),
  };
}

export async function statTrialLog(
  experimentId: string,
  trialId: string,
): Promise<TrialLogMeta> {
  const path = resolveTrialLogPath(experimentId, trialId);

  return {
    path: relativeTrialLogPath(experimentId, trialId),
    updatedAt: await readUpdatedAt(path),
  };
}

export async function readTrialLog(experimentId: string, trialId: string) {
  const path = resolveTrialLogPath(experimentId, trialId);
  const updatedAt = await readUpdatedAt(path);

  try {
    return {
      markdown: await readFile(path, "utf8"),
      updatedAt,
    };
  } catch (error) {
    if (isMissingFile(error)) {
      return { markdown: "", updatedAt };
    }

    throw error;
  }
}

export async function readTrialTokenUsage(
  experimentId: string,
  trialId: string,
) {
  const path = resolveTrialLogPath(experimentId, trialId);

  try {
    return parseTrialLogTokenUsage(await readFile(path, "utf8"));
  } catch (error) {
    if (isMissingFile(error)) {
      return undefined;
    }

    throw error;
  }
}

export async function deleteExperimentTrialLogs(experimentId: string) {
  const safeExperimentId = validateSegment(experimentId, "Experiment ID");
  const target = resolve(trialLogsDir, safeExperimentId);
  const rel = relative(trialLogsDir, target);

  if (!rel || rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error("Trial log cleanup path must stay under .local/trial-logs.");
  }

  await rm(target, { recursive: true, force: true });
}
