import { Codex, type ThreadOptions } from "@openai/codex-sdk";

import type {
  ContinueTrialInput,
  StartTrialInput,
  TrialAgentResult,
} from "./types";

const trialThreadOptions = {
  sandboxMode: "workspace-write",
  approvalPolicy: "never",
  networkAccessEnabled: false,
} satisfies Pick<
  ThreadOptions,
  "sandboxMode" | "approvalPolicy" | "networkAccessEnabled"
>;

export class CodexTrialAgent {
  private readonly codex = new Codex();

  async startTrial(input: StartTrialInput): Promise<TrialAgentResult> {
    const thread = this.codex.startThread({
      ...trialThreadOptions,
      workingDirectory: input.repoPath,
    });
    const turn = await thread.run(input.instruction);
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
