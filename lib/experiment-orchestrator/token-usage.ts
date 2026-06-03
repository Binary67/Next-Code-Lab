import type { TokenUsage } from "@/lib/codex/types";

export function emptyTokenUsage(): TokenUsage {
  return {
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    reasoningOutputTokens: 0,
  };
}

export function addTokenUsage(
  current: TokenUsage | undefined,
  next: TokenUsage,
): TokenUsage {
  const base = current ?? emptyTokenUsage();

  return {
    inputTokens: base.inputTokens + next.inputTokens,
    cachedInputTokens: base.cachedInputTokens + next.cachedInputTokens,
    outputTokens: base.outputTokens + next.outputTokens,
    reasoningOutputTokens:
      base.reasoningOutputTokens + next.reasoningOutputTokens,
  };
}
