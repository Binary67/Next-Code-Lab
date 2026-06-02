import type { TokenUsage, TrialEvaluationContract } from "./codex/types";

export type Status = "setup" | "running" | "needs-input" | "completed" | "failed";
export type ScoreDirection = "minimize" | "maximize";
export type EvaluationMode = "existing" | "generated";
export type EvaluationStatus = "missing" | "incomplete" | "ready";

export type ExperimentMetric = {
  label: string;
  value: string;
  detail: string;
};

export type TrialStatus =
  | "setup"
  | "completed"
  | "needs-input"
  | "running"
  | "failed";

export type ExperimentTrial = {
  id: string;
  title: string;
  summary: string;
  metricValue: string;
  duration: string;
  status: TrialStatus;
  threadId?: string;
  branchName?: string;
  worktreePath?: string;
  agentWorktreePath?: string;
  evalWorktreePath?: string;
  commitSha?: string;
  score?: number;
  evalsUsed?: number;
  improved?: boolean;
  tokenUsage?: TokenUsage;
  startedAt?: string;
  completedAt?: string;
  log?: {
    path: string;
    updatedAt?: string;
  };
};

export type TrendPoint = {
  label: string;
  value: number;
};

export type AgentMessage = {
  id: string;
  author: "agent" | "user";
  text: string;
  time: string;
  choices?: string[];
};

export type ExperimentEvaluation = {
  mode: EvaluationMode;
  scriptPath: string;
  scoreDirection: ScoreDirection | null;
  runCommand: string;
  scoreName: string;
  status: EvaluationStatus;
  evalSetupThreadId?: string;
  generatedScriptApproved?: boolean;
  proposedContract?: TrialEvaluationContract;
  messages: AgentMessage[];
};

export type ProgressStep = {
  id: string;
  title: string;
  detail: string;
  status: "completed" | "active" | "queued" | "blocked";
  time: string;
};

export type ExperimentChange = {
  id: string;
  path: string;
  summary: string;
  status: "applied" | "validated" | "planned";
};

export type Experiment = {
  id: string;
  repo: string;
  title: string;
  description: string;
  status: Status;
  trialCount: number;
  evalBudgetPerTrial: number;
  baseBranch?: string;
  baseCommit?: string;
  baselineScore?: number;
  bestBranchName?: string;
  metricLabel: string;
  metricValue: string;
  /** Improvement shown next to the metric, e.g. a 18% reduction. */
  delta?: { dir: "down" | "up"; value: string };
  /** Right-hand timing text for running / completed experiments. */
  timing?: string;
  objective: string;
  targetLabel: string;
  targetValue: string;
  targetMetric: number;
  evaluation: ExperimentEvaluation;
  metrics: ExperimentMetric[];
  trend: TrendPoint[];
  trials: ExperimentTrial[];
  progressSteps: ProgressStep[];
  changes: ExperimentChange[];
  agentMessages: AgentMessage[];
  pendingQuestion?: {
    title: string;
    body: string;
    options: string[];
  };
};

export const DEFAULT_TRIAL_COUNT = 3;
export const DEFAULT_EVAL_BUDGET_PER_TRIAL = 3;

export function applyExperimentDefaults(experiment: Experiment): Experiment {
  return {
    ...experiment,
    trialCount: Number.isInteger(experiment.trialCount)
      ? experiment.trialCount
      : DEFAULT_TRIAL_COUNT,
    evalBudgetPerTrial: Number.isInteger(experiment.evalBudgetPerTrial)
      ? experiment.evalBudgetPerTrial
      : DEFAULT_EVAL_BUDGET_PER_TRIAL,
  };
}
