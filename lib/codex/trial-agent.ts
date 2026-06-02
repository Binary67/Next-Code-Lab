import type { ThreadOptions } from "@openai/codex-sdk";

import type {
  ContinueTrialInput,
  StartTrialInput,
  TrialAgentResponse,
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

const trialOutputSchema = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["request_eval", "done", "blocked"] },
    message: { type: "string" },
  },
  required: ["status", "message"],
  additionalProperties: false,
} as const;

function parseTrialResponse(finalResponse: string): TrialAgentResponse {
  let parsed: unknown;

  try {
    parsed = JSON.parse(finalResponse);
  } catch (error) {
    throw new Error("Codex returned invalid trial JSON.", { cause: error });
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed)
  ) {
    throw new Error("Codex returned invalid trial output.");
  }

  const value = parsed as Record<string, unknown>;
  if (
    value.status !== "request_eval" &&
    value.status !== "done" &&
    value.status !== "blocked"
  ) {
    throw new Error("Codex returned an unknown trial status.");
  }

  if (typeof value.message !== "string" || !value.message.trim()) {
    throw new Error("Codex returned an invalid trial message.");
  }

  return {
    status: value.status,
    message: value.message.trim(),
  };
}

function startInstruction(input: StartTrialInput) {
  return [
    "You are running one isolated optimization trial for this repository.",
    `Trial number: ${input.trialNumber}`,
    `Optimization objective: ${input.objective}`,
    "",
    "Hidden evaluation:",
    `- Score name: ${input.scoreName}`,
    `- Score direction: ${input.scoreDirection}`,
    `- Baseline score: ${input.baselineScore}`,
    `- Evaluation requests available: ${input.evalBudget}`,
    "",
    "Do not search for, create, modify, or run the evaluation script.",
    "Optimize the codebase based on the objective and metric name only.",
    "When you have made changes that should be scored, return status request_eval.",
    "If you are done without needing another score, return status done.",
    "If you cannot proceed without user input, return status blocked.",
    "Any score improvement in the selected direction is enough for this trial to stop successfully.",
  ].join("\n");
}

export class CodexTrialAgent {
  private readonly codex = createCodexClient();

  async startTrial(input: StartTrialInput): Promise<TrialAgentResult> {
    const thread = this.codex.startThread({
      ...trialThreadOptions,
      workingDirectory: input.repoPath,
    });
    const turn = await thread.run(startInstruction(input), {
      outputSchema: trialOutputSchema,
    });
    const trialThreadId = thread.id;

    if (!trialThreadId) {
      throw new Error("Codex did not return a trial thread ID.");
    }

    return {
      trialThreadId,
      response: parseTrialResponse(turn.finalResponse),
    };
  }

  async continueTrial(input: ContinueTrialInput): Promise<TrialAgentResult> {
    const thread = this.codex.resumeThread(input.trialThreadId, {
      ...trialThreadOptions,
      workingDirectory: input.repoPath,
    });
    const turn = await thread.run(input.instruction, {
      outputSchema: trialOutputSchema,
    });

    return {
      trialThreadId: input.trialThreadId,
      response: parseTrialResponse(turn.finalResponse),
    };
  }
}
