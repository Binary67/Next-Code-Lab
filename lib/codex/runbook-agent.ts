import type { ThreadOptions } from "@openai/codex-sdk";

import type { RepoRunbook, RunbookAgentResult } from "./types";
import { createCodexClient } from "./client";

const runbookThreadOptions = {
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

const stringArraySchema = {
  type: "array",
  items: { type: "string" },
} as const;

const runbookOutputSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    projectTypes: stringArraySchema,
    dependencyManagers: {
      type: "array",
      items: {
        type: "object",
        properties: {
          ecosystem: { type: "string" },
          manager: { type: "string" },
          manifestFiles: stringArraySchema,
          lockFiles: stringArraySchema,
          setupCommands: stringArraySchema,
          runPrefix: { type: ["string", "null"] },
          evidence: stringArraySchema,
        },
        required: [
          "ecosystem",
          "manager",
          "manifestFiles",
          "lockFiles",
          "setupCommands",
          "runPrefix",
          "evidence",
        ],
        additionalProperties: false,
      },
    },
    runtimeRequirements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          version: { type: ["string", "null"] },
          source: { type: "string" },
        },
        required: ["name", "version", "source"],
        additionalProperties: false,
      },
    },
    workflows: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          purpose: { type: "string" },
          commands: stringArraySchema,
          requiredEnvVars: stringArraySchema,
          requiredFiles: stringArraySchema,
          produces: stringArraySchema,
          confidence: {
            type: "string",
            enum: ["high", "medium", "low"],
          },
          evidence: stringArraySchema,
        },
        required: [
          "name",
          "purpose",
          "commands",
          "requiredEnvVars",
          "requiredFiles",
          "produces",
          "confidence",
          "evidence",
        ],
        additionalProperties: false,
      },
    },
    repoConventions: stringArraySchema,
    knownRisks: stringArraySchema,
    openQuestions: stringArraySchema,
  },
  required: [
    "summary",
    "projectTypes",
    "dependencyManagers",
    "runtimeRequirements",
    "workflows",
    "repoConventions",
    "knownRisks",
    "openQuestions",
  ],
  additionalProperties: false,
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Codex returned an invalid runbook ${field}.`);
  }

  return value.trim();
}

function optionalString(value: unknown, field: string) {
  if (value === undefined || value === null) {
    return undefined;
  }

  return requiredString(value, field);
}

function stringArray(value: unknown, field: string) {
  if (!Array.isArray(value)) {
    throw new Error(`Codex returned an invalid runbook ${field}.`);
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function evidenceArray(value: unknown, field: string) {
  const evidence = stringArray(value, field);

  if (evidence.length === 0) {
    throw new Error(`Codex returned runbook ${field} without evidence.`);
  }

  return evidence;
}

function parseDependencyManager(
  value: unknown,
  index: number,
): RepoRunbook["dependencyManagers"][number] {
  if (!isRecord(value)) {
    throw new Error(`Codex returned an invalid runbook dependency manager ${index}.`);
  }

  return {
    ecosystem: requiredString(value.ecosystem, `dependencyManagers.${index}.ecosystem`),
    manager: requiredString(value.manager, `dependencyManagers.${index}.manager`),
    manifestFiles: stringArray(
      value.manifestFiles,
      `dependencyManagers.${index}.manifestFiles`,
    ),
    lockFiles: stringArray(value.lockFiles, `dependencyManagers.${index}.lockFiles`),
    setupCommands: stringArray(
      value.setupCommands,
      `dependencyManagers.${index}.setupCommands`,
    ),
    runPrefix: optionalString(value.runPrefix, `dependencyManagers.${index}.runPrefix`),
    evidence: evidenceArray(value.evidence, `dependencyManagers.${index}.evidence`),
  };
}

function parseRuntimeRequirement(
  value: unknown,
  index: number,
): RepoRunbook["runtimeRequirements"][number] {
  if (!isRecord(value)) {
    throw new Error(`Codex returned an invalid runbook runtime requirement ${index}.`);
  }

  return {
    name: requiredString(value.name, `runtimeRequirements.${index}.name`),
    version: optionalString(value.version, `runtimeRequirements.${index}.version`),
    source: requiredString(value.source, `runtimeRequirements.${index}.source`),
  };
}

function parseWorkflow(
  value: unknown,
  index: number,
): RepoRunbook["workflows"][number] {
  if (!isRecord(value)) {
    throw new Error(`Codex returned an invalid runbook workflow ${index}.`);
  }

  const confidence = value.confidence;
  if (
    confidence !== "high" &&
    confidence !== "medium" &&
    confidence !== "low"
  ) {
    throw new Error(`Codex returned an invalid runbook workflows.${index}.confidence.`);
  }

  return {
    name: requiredString(value.name, `workflows.${index}.name`),
    purpose: requiredString(value.purpose, `workflows.${index}.purpose`),
    commands: stringArray(value.commands, `workflows.${index}.commands`),
    requiredEnvVars: stringArray(
      value.requiredEnvVars,
      `workflows.${index}.requiredEnvVars`,
    ),
    requiredFiles: stringArray(
      value.requiredFiles,
      `workflows.${index}.requiredFiles`,
    ),
    produces: stringArray(value.produces, `workflows.${index}.produces`),
    confidence,
    evidence: evidenceArray(value.evidence, `workflows.${index}.evidence`),
  };
}

function parseArray<T>(
  value: unknown,
  field: string,
  parseItem: (item: unknown, index: number) => T,
) {
  if (!Array.isArray(value)) {
    throw new Error(`Codex returned an invalid runbook ${field}.`);
  }

  return value.map(parseItem);
}

export function parseRepoRunbook(value: unknown): RepoRunbook {
  if (!isRecord(value)) {
    throw new Error("Codex returned an invalid runbook.");
  }

  return {
    summary: requiredString(value.summary, "summary"),
    projectTypes: stringArray(value.projectTypes, "projectTypes"),
    dependencyManagers: parseArray(
      value.dependencyManagers,
      "dependencyManagers",
      parseDependencyManager,
    ),
    runtimeRequirements: parseArray(
      value.runtimeRequirements,
      "runtimeRequirements",
      parseRuntimeRequirement,
    ),
    workflows: parseArray(value.workflows, "workflows", parseWorkflow),
    repoConventions: stringArray(value.repoConventions, "repoConventions"),
    knownRisks: stringArray(value.knownRisks, "knownRisks"),
    openQuestions: stringArray(value.openQuestions, "openQuestions"),
  };
}

export function formatRunbookForPrompt(runbook: RepoRunbook) {
  return JSON.stringify(runbook, null, 2);
}

function runbookInstruction() {
  return [
    "Create a public repository runbook for optimizer agents.",
    "",
    "The target repository is your working directory.",
    "Inspect repository files and run safe static inspection commands only.",
    "Do not write files. Do not install dependencies. Do not use network access.",
    "",
    "The runbook must be repo-agnostic. Do not assume the repository is machine learning, web, CLI, or inference unless the files show that.",
    "Describe runnable workflows the repository exposes, using flexible workflow names such as build, lint, benchmark, inference smoke test, training, unit tests, or dev server only when supported by evidence.",
    "Prefer reproducible, lockfile-respecting setup commands when the repository supports them, such as frozen or locked install modes.",
    "For each dependency manager, include a runPrefix when commands should be executed through a project runner instead of a system runtime, for example uv run, poetry run, pnpm exec, npm run, or cargo run.",
    "Every dependency manager and workflow must include evidence from repository files such as package manifests, lockfiles, Makefiles, CI, or README content.",
    "Do not include hidden metric implementation, hidden fixtures, generated evaluation script content, or scoring logic.",
  ].join("\n");
}

export class CodexRunbookAgent {
  private readonly codex = createCodexClient();

  async createRunbook(repoPath: string): Promise<RunbookAgentResult> {
    const thread = this.codex.startThread({
      ...runbookThreadOptions,
      workingDirectory: repoPath,
    });
    const turn = await thread.run(runbookInstruction(), {
      outputSchema: runbookOutputSchema,
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(turn.finalResponse);
    } catch (error) {
      throw new Error("Codex returned invalid runbook JSON.", {
        cause: error,
      });
    }

    return { runbook: parseRepoRunbook(parsed) };
  }
}
