import type { Thread, ThreadEvent, ThreadOptions } from "@openai/codex-sdk";

import type {
  ContinueTrialInput,
  StartTrialInput,
  TokenUsage,
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

type TrialLogOptions = {
  turnNumber: number;
  inputSummary: string;
  appendLog?: (markdown: string) => Promise<void>;
  onThreadStarted?: (threadId: string) => Promise<void>;
};

type StreamLogState = {
  commandOutputLengths: Map<string, number>;
  loggedCommands: Set<string>;
  finalResponse: string;
  tokenUsage: TokenUsage;
  turnFailure?: string;
};

function emptyTokenUsage(): TokenUsage {
  return {
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    reasoningOutputTokens: 0,
  };
}

function addTokenUsage(current: TokenUsage, next: TokenUsage): TokenUsage {
  return {
    inputTokens: current.inputTokens + next.inputTokens,
    cachedInputTokens: current.cachedInputTokens + next.cachedInputTokens,
    outputTokens: current.outputTokens + next.outputTokens,
    reasoningOutputTokens:
      current.reasoningOutputTokens + next.reasoningOutputTokens,
  };
}

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

function statusLine(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
}

function fileChangeVerb(kind: string) {
  if (kind === "add") return "Added";
  if (kind === "delete") return "Deleted";
  return "Updated";
}

async function appendEventLog(
  event: ThreadEvent,
  state: StreamLogState,
  options: TrialLogOptions,
) {
  if (event.type === "thread.started") {
    await options.onThreadStarted?.(event.thread_id);
    return;
  }

  const appendLog = options.appendLog;

  if (!appendLog) {
    return;
  }

  if (event.type === "turn.failed") {
    state.turnFailure = event.error.message;
    await appendLog(`[Error]\n${event.error.message}`);
    return;
  }

  if (event.type === "error") {
    state.turnFailure = event.message;
    await appendLog(`[Error]\n${event.message}`);
    return;
  }

  if (event.type === "turn.completed") {
    const usage = {
      inputTokens: event.usage.input_tokens,
      cachedInputTokens: event.usage.cached_input_tokens,
      outputTokens: event.usage.output_tokens,
      reasoningOutputTokens: event.usage.reasoning_output_tokens,
    };
    state.tokenUsage = addTokenUsage(state.tokenUsage, usage);
    await appendLog(
      [
        "[Usage]",
        `Input tokens: ${usage.inputTokens}`,
        `Cached input tokens: ${usage.cachedInputTokens}`,
        `Output tokens: ${usage.outputTokens}`,
        `Reasoning output tokens: ${usage.reasoningOutputTokens}`,
      ].join("\n"),
    );
    return;
  }

  if (
    event.type !== "item.started" &&
    event.type !== "item.updated" &&
    event.type !== "item.completed"
  ) {
    return;
  }

  const item = event.item;

  if (item.type === "agent_message") {
    if (event.type === "item.completed") {
      state.finalResponse = item.text;
    }
    return;
  }

  if (item.type === "reasoning") {
    if (event.type === "item.completed" && item.text.trim()) {
      await appendLog(`[Reasoning]\n${item.text.trim()}`);
    }
    return;
  }

  if (item.type === "todo_list") {
    if (event.type === "item.completed" && item.items.length > 0) {
      await appendLog(
        [
          "[Todo]",
          ...item.items.map((todo) => `${todo.completed ? "- [x]" : "- [ ]"} ${todo.text}`),
        ].join("\n"),
      );
    }
    return;
  }

  if (item.type === "command_execution") {
    if (!state.loggedCommands.has(item.id)) {
      state.loggedCommands.add(item.id);
      await appendLog(`[Command]\n${item.command}`);
    }

    const output = item.aggregated_output ?? "";
    const previousLength = state.commandOutputLengths.get(item.id) ?? 0;

    if (output.length > previousLength) {
      state.commandOutputLengths.set(item.id, output.length);
      await appendLog(`[Output]\n${output.slice(previousLength).trimEnd()}`);
    }

    if (event.type === "item.completed" && item.exit_code !== undefined) {
      await appendLog(
        `[Status]\nCommand ${statusLine(item.status)} with exit code ${item.exit_code}.`,
      );
    }
    return;
  }

  if (item.type === "file_change" && event.type === "item.completed") {
    const lines = item.changes.map(
      (change) => `${fileChangeVerb(change.kind)} ${change.path}`,
    );

    await appendLog(
      [
        "[File Changes]",
        ...lines,
        `Patch ${statusLine(item.status)}.`,
      ].join("\n"),
    );
  }
}

async function runTrialTurn(
  thread: Thread,
  input: string,
  options: TrialLogOptions,
): Promise<{ response: TrialAgentResponse; tokenUsage: TokenUsage }> {
  await options.appendLog?.(
    [`## Turn ${options.turnNumber}`, "", "[Input]", options.inputSummary].join(
      "\n",
    ),
  );

  const { events } = await thread.runStreamed(input, {
    outputSchema: trialOutputSchema,
  });
  const state: StreamLogState = {
    commandOutputLengths: new Map(),
    loggedCommands: new Set(),
    finalResponse: "",
    tokenUsage: emptyTokenUsage(),
  };

  try {
    for await (const event of events) {
      await appendEventLog(event, state, options);
    }
  } catch (error) {
    await options.appendLog?.(
      `[Error]\n${error instanceof Error ? error.message : "Codex stream failed."}`,
    );
    throw error;
  }

  if (state.turnFailure) {
    throw new Error(state.turnFailure);
  }

  try {
    const response = parseTrialResponse(state.finalResponse);
    await options.appendLog?.(`[Agent Response]\n${response.message}`);
    return { response, tokenUsage: state.tokenUsage };
  } catch (error) {
    await options.appendLog?.(
      `[Error]\n${error instanceof Error ? error.message : "Codex returned invalid output."}`,
    );
    throw error;
  }
}

export class CodexTrialAgent {
  private readonly codex = createCodexClient();

  async startTrial(
    input: StartTrialInput,
    options?: TrialLogOptions,
  ): Promise<TrialAgentResult> {
    const thread = this.codex.startThread({
      ...trialThreadOptions,
      workingDirectory: input.repoPath,
    });
    const turn = await runTrialTurn(
      thread,
      startInstruction(input),
      options ?? {
        turnNumber: 1,
        inputSummary: `Started optimization trial ${input.trialNumber}.`,
      },
    );
    const trialThreadId = thread.id;

    if (!trialThreadId) {
      throw new Error("Codex did not return a trial thread ID.");
    }

    return {
      trialThreadId,
      response: turn.response,
      tokenUsage: turn.tokenUsage,
    };
  }

  async continueTrial(
    input: ContinueTrialInput,
    options?: TrialLogOptions,
  ): Promise<TrialAgentResult> {
    const thread = this.codex.resumeThread(input.trialThreadId, {
      ...trialThreadOptions,
      workingDirectory: input.repoPath,
    });
    const turn = await runTrialTurn(
      thread,
      input.instruction,
      options ?? {
        turnNumber: 1,
        inputSummary: "Continued optimization after evaluation feedback.",
      },
    );

    return {
      trialThreadId: input.trialThreadId,
      response: turn.response,
      tokenUsage: turn.tokenUsage,
    };
  }
}
