import type { ThreadOptions } from "@openai/codex-sdk";

import type {
  ApproveEvalSetupInput,
  ContinueEvalSetupInput,
  EvalSetupAgentResult,
  EvalSetupResponse,
  StartEvalSetupInput,
  TrialEvaluationContract,
} from "./types";
import { createCodexClient } from "./client";

const interviewThreadOptions = {
  sandboxMode: "read-only",
  approvalPolicy: "never",
  networkAccessEnabled: false,
  skipGitRepoCheck: true,
} satisfies Pick<
  ThreadOptions,
  | "sandboxMode"
  | "approvalPolicy"
  | "networkAccessEnabled"
  | "skipGitRepoCheck"
>;

const approvalThreadOptions = {
  ...interviewThreadOptions,
  sandboxMode: "workspace-write",
} satisfies Pick<
  ThreadOptions,
  | "sandboxMode"
  | "approvalPolicy"
  | "networkAccessEnabled"
  | "skipGitRepoCheck"
>;

const contractSchema = {
  type: "object",
  properties: {
    scriptPath: { type: "string" },
    runCommand: { type: "string" },
    scoreDirection: { type: "string", enum: ["minimize", "maximize"] },
    scoreName: { type: "string" },
  },
  required: ["scriptPath", "runCommand", "scoreDirection", "scoreName"],
  additionalProperties: false,
} as const;

const evalSetupOutputSchema = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["question", "ready", "generated"] },
    message: { type: "string" },
    question: { type: ["string", "null"] },
    choices: {
      anyOf: [
        {
          type: "array",
          items: { type: "string" },
          maxItems: 3,
        },
        { type: "null" },
      ],
    },
    proposedContract: {
      anyOf: [contractSchema, { type: "null" }],
    },
    contract: {
      anyOf: [contractSchema, { type: "null" }],
    },
  },
  required: [
    "status",
    "message",
    "question",
    "choices",
    "proposedContract",
    "contract",
  ],
  additionalProperties: false,
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Codex returned an invalid ${field}.`);
  }

  return value.trim();
}

function validateScriptPath(scriptPath: string, field: string) {
  if (
    scriptPath.startsWith("/") ||
    scriptPath.split(/[\\/]/).includes("..")
  ) {
    throw new Error(`Codex returned an invalid ${field}.`);
  }

  return scriptPath;
}

function parseContract(value: unknown, field: string): TrialEvaluationContract {
  if (!isRecord(value)) {
    throw new Error(`Codex returned an invalid ${field}.`);
  }

  const scoreDirection = value.scoreDirection;
  if (scoreDirection !== "minimize" && scoreDirection !== "maximize") {
    throw new Error(`Codex returned an invalid ${field}.scoreDirection.`);
  }

  return {
    scriptPath: validateScriptPath(
      requiredString(value.scriptPath, `${field}.scriptPath`),
      `${field}.scriptPath`,
    ),
    runCommand: requiredString(value.runCommand, `${field}.runCommand`),
    scoreDirection,
    scoreName: requiredString(value.scoreName, `${field}.scoreName`),
  };
}

function parseEvalSetupResponse(finalResponse: string): EvalSetupResponse {
  let parsed: unknown;

  try {
    parsed = JSON.parse(finalResponse);
  } catch (error) {
    throw new Error("Codex returned invalid eval setup JSON.", {
      cause: error,
    });
  }

  if (!isRecord(parsed)) {
    throw new Error("Codex returned invalid eval setup output.");
  }

  const message = requiredString(parsed.message, "message");

  if (parsed.status === "question") {
    const choices = Array.isArray(parsed.choices)
      ? parsed.choices
          .filter((choice): choice is string => typeof choice === "string")
          .map((choice) => choice.trim())
          .filter(Boolean)
          .slice(0, 3)
      : undefined;

    return {
      status: "question",
      message,
      question: requiredString(parsed.question, "question"),
      choices: choices && choices.length > 0 ? choices : undefined,
    };
  }

  if (parsed.status === "ready") {
    return {
      status: "ready",
      message,
      proposedContract: parseContract(
        parsed.proposedContract,
        "proposedContract",
      ),
    };
  }

  if (parsed.status === "generated") {
    return {
      status: "generated",
      message,
      contract: parseContract(parsed.contract, "contract"),
    };
  }

  throw new Error("Codex returned an unknown eval setup status.");
}

function startInstruction(input: StartEvalSetupInput) {
  return [
    "You are setting up an evaluation script for an optimization experiment.",
    `Experiment title: ${input.title}`,
    `Experiment objective: ${input.objective}`,
    "",
    "The target repository is your working directory.",
    "Inspect the repository before deciding what information is missing. You may read files and run safe static inspection commands, but this interview turn must not write files.",
    "",
    "Rubric for a complete eval contract:",
    "- The behavior or quality signal to score is clear.",
    "- The input data, fixtures, page, command, or scenario to evaluate is clear.",
    "- The eval can run from the repository root with a concrete command.",
    "- Stdout prints one numeric score and exits 0 on success.",
    "- Non-zero exit means an invalid trial.",
    "- The score direction is inferable or explicitly selected.",
    "- The script path is repo-relative, preferably under .optimizer/evals/.",
    "",
    "Ask exactly one highest-value clarifying question only if the answer cannot be inferred from the repository or prior context. Include up to three suggested choices when useful, but the user may answer freely.",
    "If enough information is available, return a proposed eval contract instead of asking a question.",
    "During interview turns, do not return status generated.",
    "For fields that do not apply to the selected status, return null.",
  ].join("\n");
}

function continueInstruction(input: ContinueEvalSetupInput) {
  return [
    "Continue the eval setup interview using this user reply.",
    "",
    `User reply: ${input.reply}`,
    "",
    "Reinspect the repository if needed. Ask exactly one highest-value clarifying question only if the eval contract still cannot be inferred. Include up to three suggested choices when useful.",
    "If enough information is available, return status ready with a proposed eval contract.",
    "Do not write files and do not return status generated during this interview turn.",
    "For fields that do not apply to the selected status, return null.",
  ].join("\n");
}

function approveInstruction(input: ApproveEvalSetupInput) {
  const contract = input.proposedContract;

  return [
    "The user approved this eval contract. Write the eval script now.",
    "",
    `Script path: ${contract.scriptPath}`,
    `Run command: ${contract.runCommand}`,
    `Score name: ${contract.scoreName}`,
    `Score direction: ${contract.scoreDirection}`,
    "",
    "Create or update only the eval script file and any required parent directory. Do not modify package manifests or unrelated files.",
    "The script must be runnable from the repository root using the run command, print one numeric score to stdout, and exit 0 on successful evaluation.",
    "After writing the script, return status generated with the final contract.",
    "For fields that do not apply to the selected status, return null.",
  ].join("\n");
}

export class CodexEvalSetupAgent {
  private readonly codex = createCodexClient();

  async startInterview(
    input: StartEvalSetupInput,
  ): Promise<EvalSetupAgentResult> {
    const thread = this.codex.startThread({
      ...interviewThreadOptions,
      workingDirectory: input.repoPath,
    });
    const turn = await thread.run(startInstruction(input), {
      outputSchema: evalSetupOutputSchema,
    });
    const evalSetupThreadId = thread.id;

    if (!evalSetupThreadId) {
      throw new Error("Codex did not return an eval setup thread ID.");
    }

    return {
      evalSetupThreadId,
      response: parseEvalSetupResponse(turn.finalResponse),
    };
  }

  async continueInterview(
    input: ContinueEvalSetupInput,
  ): Promise<EvalSetupAgentResult> {
    const thread = this.codex.resumeThread(input.evalSetupThreadId, {
      ...interviewThreadOptions,
      workingDirectory: input.repoPath,
    });
    const turn = await thread.run(continueInstruction(input), {
      outputSchema: evalSetupOutputSchema,
    });

    return {
      evalSetupThreadId: input.evalSetupThreadId,
      response: parseEvalSetupResponse(turn.finalResponse),
    };
  }

  async approveGenerated(
    input: ApproveEvalSetupInput,
  ): Promise<EvalSetupAgentResult> {
    const thread = this.codex.resumeThread(input.evalSetupThreadId, {
      ...approvalThreadOptions,
      workingDirectory: input.repoPath,
    });
    const turn = await thread.run(approveInstruction(input), {
      outputSchema: evalSetupOutputSchema,
    });

    return {
      evalSetupThreadId: input.evalSetupThreadId,
      response: parseEvalSetupResponse(turn.finalResponse),
    };
  }
}
