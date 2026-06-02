import type { TrialEvaluationContract } from "./codex/types";

export type Status = "setup" | "running" | "needs-input" | "completed";
export type ScoreDirection = "minimize" | "maximize";
export type EvaluationMode = "existing" | "generated";
export type EvaluationStatus = "missing" | "incomplete" | "ready";

export type ExperimentMetric = {
  label: string;
  value: string;
  detail: string;
};

export type TrialStatus = "setup" | "completed" | "needs-input" | "running";

export type ExperimentTrial = {
  id: string;
  title: string;
  summary: string;
  metricValue: string;
  duration: string;
  status: TrialStatus;
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
  scoreDirection: ScoreDirection;
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
