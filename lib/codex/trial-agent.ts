import type { ThreadOptions } from "@openai/codex-sdk";

import type {
  ContinueTrialInput,
  StartTrialInput,
  TrialAgentResult,
} from "./types";
import { createCodexClient } from "./client";

const trialThreadOptions = {
  sandboxMode: "workspace-write",
  approvalPolicy: "never",
  networkAccessEnabled: false,
} satisfies Pick<
  ThreadOptions,
  "sandboxMode" | "approvalPolicy" | "networkAccessEnabled"
>;

function startInstruction(input: StartTrialInput) {
  return [
    input.instruction,
    "",
    "Evaluation contract:",
    `- Eval script: ${input.evaluation.scriptPath}`,
    `- Run command: ${input.evaluation.runCommand}`,
    `- Score name: ${input.evaluation.scoreName}`,
    `- Score direction: ${input.evaluation.scoreDirection}`,
    "- Treat a non-zero eval exit as an invalid trial.",
    "- Any score improvement in the selected direction is useful.",
  ].join("\n");
}

export class CodexTrialAgent {
  private readonly codex = createCodexClient();

  async startTrial(input: StartTrialInput): Promise<TrialAgentResult> {
    const thread = this.codex.startThread({
      ...trialThreadOptions,
      workingDirectory: input.repoPath,
    });
    const turn = await thread.run(startInstruction(input));
    const trialThreadId = thread.id;

    if (!trialThreadId) {
      throw new Error("Codex did not return a trial thread ID.");
    }

    return {
      trialThreadId,
      response: turn.finalResponse,
    };
  }

  async continueTrial(input: ContinueTrialInput): Promise<TrialAgentResult> {
    const thread = this.codex.resumeThread(input.trialThreadId, {
      ...trialThreadOptions,
      workingDirectory: input.repoPath,
    });
    const turn = await thread.run(input.instruction);

    return {
      trialThreadId: input.trialThreadId,
      response: turn.finalResponse,
    };
  }
}
