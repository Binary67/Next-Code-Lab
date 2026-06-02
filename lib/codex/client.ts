import { existsSync } from "node:fs";
import { join } from "node:path";

import { Codex } from "@openai/codex-sdk";

function resolveCodexPathOverride() {
  if (process.platform !== "darwin" || process.arch !== "arm64") {
    return undefined;
  }

  const candidates = [
    join(
      process.cwd(),
      "node_modules",
      "@openai",
      "codex-darwin-arm64",
      "vendor",
      "aarch64-apple-darwin",
      "bin",
      "codex",
    ),
    "/opt/homebrew/bin/codex",
  ];

  return candidates.find((candidate) => existsSync(candidate));
}

export function createCodexClient() {
  const codexPathOverride = resolveCodexPathOverride();

  return new Codex(codexPathOverride ? { codexPathOverride } : undefined);
}
