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
import { formatRunbookForPrompt } from "./runbook-agent";

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
    scriptContent: { type: ["string", "null"] },
  },
  required: [
    "status",
    "message",
    "question",
    "choices",
    "proposedContract",
    "contract",
    "scriptContent",
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
      scriptContent: requiredString(parsed.scriptContent, "scriptContent"),
    };
  }

  throw new Error("Codex returned an unknown eval setup status.");
}

function runbookSection(runbook: StartEvalSetupInput["runbook"]) {
  if (!runbook) {
    return [
      "Public repo runbook: not available.",
      "Infer execution details from repository files, and prefer project-local runners over system runtimes when evidence supports them.",
    ].join("\n");
  }

  return [
    "Public repo runbook:",
    formatRunbookForPrompt(runbook),
    "",
    "Use this runbook for repository setup and execution mechanics.",
    "When generated eval code runs candidate repository code, prefer the runbook's setup commands, run prefixes, workflows, and runtime requirements over generic system commands.",
  ].join("\n");
}

function startInstruction(input: StartEvalSetupInput) {
  const generatedScriptPath = `.local/evals/${input.experimentId}/eval.mjs`;

  return [
    "You are setting up an evaluation script for an optimization experiment.",
    `Experiment title: ${input.title}`,
    `Experiment objective: ${input.objective}`,
    "",
    runbookSection(input.runbook),
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
    "- The eval script belongs to the orchestrator app, not the target repository.",
    `- For generated evals, propose script path ${generatedScriptPath}.`,
    `- For generated evals, propose run command: node ${generatedScriptPath}`,
    "- Generated eval scripts must read the candidate repository path from OPTIMIZER_TARGET_REPO.",
    "- Generated eval scripts may read ignored local assets from OPTIMIZER_BASE_REPO, the original target repository.",
    "- Generated eval scripts must execute candidate repository code through the public runbook's project runner when one is available.",
    "",
    "Metric selection policy:",
    "- Treat a metric as selected only when the experiment title or objective explicitly names the metric or scoring signal to optimize.",
    "- Repository files, benchmark conventions, existing scripts, and common task defaults can suggest metrics, but they are not user selection.",
    "- If the metric is only inferred, return status question asking which metric to use before proposing a contract.",
    "- Include up to three concise metric choices when useful, such as RMSLE, RMSE, or R2, ordered with your recommendation first.",
    "- In the question or message, tell the user they may choose a suggestion or type a different metric.",
    "",
    "Ask exactly one highest-value clarifying question when required by the metric selection policy or when another answer cannot be inferred from the repository or prior context.",
    "If the user explicitly selected the metric and enough information is available, return a proposed eval contract instead of asking a question.",
    "During interview turns, do not return status generated.",
    "Do not write files during interview turns.",
    "For fields that do not apply to the selected status, return null.",
  ].join("\n");
}

function continueInstruction(input: ContinueEvalSetupInput) {
  const generatedScriptPath = `.local/evals/${input.experimentId}/eval.mjs`;

  return [
    "Continue the eval setup interview using this user reply.",
    "",
    `User reply: ${input.reply}`,
    "",
    runbookSection(input.runbook),
    "",
    "Treat this reply as the user's selected metric if it names or selects a metric.",
    "Reinspect the repository if needed. Ask exactly one highest-value clarifying question only if the metric is still unclear or the eval contract still cannot be inferred. Include up to three suggested choices when useful.",
    "If the user selected the metric and enough information is available, return status ready with a proposed eval contract.",
    `For generated evals, use script path ${generatedScriptPath} and run command node ${generatedScriptPath}.`,
    "Generated eval scripts must read the candidate repository path from OPTIMIZER_TARGET_REPO.",
    "Generated eval scripts may read ignored local assets from OPTIMIZER_BASE_REPO, the original target repository.",
    "Generated eval scripts must execute candidate repository code through the public runbook's project runner when one is available.",
    "Do not write files and do not return status generated during this interview turn.",
    "For fields that do not apply to the selected status, return null.",
  ].join("\n");
}

function approveInstruction(input: ApproveEvalSetupInput) {
  const contract = input.proposedContract;

  return [
    "The user approved this eval contract. Generate the eval script content now.",
    "",
    `Script path: ${contract.scriptPath}`,
    `Run command: ${contract.runCommand}`,
    `Score name: ${contract.scoreName}`,
    `Score direction: ${contract.scoreDirection}`,
    "",
    runbookSection(input.runbook),
    "",
    "Do not write files. Return the complete eval script as scriptContent.",
    "The orchestrator will store this script in its own .local directory, outside the target repository.",
    "The script must read candidate code from OPTIMIZER_TARGET_REPO, which points to the eval worktree at the candidate snapshot.",
    "The script may read ignored local assets such as data/, .venv, caches, fixtures, or local credentials from OPTIMIZER_BASE_REPO, which points to the original target repository.",
    "When the script executes candidate repository code, use the public runbook's setup assumptions and run prefix instead of generic system runtimes when available.",
    "The script must print one numeric score to stdout and exit 0 on successful evaluation.",
    "Return status generated with the final contract and scriptContent.",
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
