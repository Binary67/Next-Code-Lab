export type TrialEvaluationContract = {
  scriptPath: string;
  runCommand: string;
  scoreDirection: "minimize" | "maximize";
  scoreName: string;
};

export type TokenUsage = {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
};

export type EvalSetupQuestionResult = {
  status: "question";
  message: string;
  question: string;
  choices?: string[];
};

export type EvalSetupReadyResult = {
  status: "ready";
  message: string;
  proposedContract: TrialEvaluationContract;
};

export type EvalSetupGeneratedResult = {
  status: "generated";
  message: string;
  contract: TrialEvaluationContract;
  scriptContent: string;
};

export type EvalSetupResponse =
  | EvalSetupQuestionResult
  | EvalSetupReadyResult
  | EvalSetupGeneratedResult;

export type EvalSetupAgentResult = {
  evalSetupThreadId: string;
  response: EvalSetupResponse;
};

export type StartEvalSetupInput = {
  experimentId: string;
  repoPath: string;
  title: string;
  objective: string;
};

export type ContinueEvalSetupInput = {
  experimentId: string;
  evalSetupThreadId: string;
  repoPath: string;
  reply: string;
};

export type ApproveEvalSetupInput = {
  experimentId: string;
  evalSetupThreadId: string;
  repoPath: string;
  proposedContract: TrialEvaluationContract;
};

export type StartTrialInput = {
  repoPath: string;
  objective: string;
  scoreName: string;
  scoreDirection: "minimize" | "maximize";
  baselineScore: number;
  evalBudget: number;
  trialNumber: number;
};

export type ContinueTrialInput = {
  trialThreadId: string;
  repoPath: string;
  instruction: string;
};

export type TrialAgentResponse = {
  status: "request_eval" | "done" | "blocked";
  message: string;
};

export type TrialAgentResult = {
  trialThreadId: string;
  response: TrialAgentResponse;
  tokenUsage: TokenUsage;
};
