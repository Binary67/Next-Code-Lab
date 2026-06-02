export type TrialEvaluationContract = {
  scriptPath: string;
  runCommand: string;
  scoreDirection: "minimize" | "maximize";
  scoreName: string;
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
  repoPath: string;
  title: string;
  objective: string;
};

export type ContinueEvalSetupInput = {
  evalSetupThreadId: string;
  repoPath: string;
  reply: string;
};

export type ApproveEvalSetupInput = {
  evalSetupThreadId: string;
  repoPath: string;
  proposedContract: TrialEvaluationContract;
};

export type StartTrialInput = {
  repoPath: string;
  instruction: string;
  evaluation: TrialEvaluationContract;
};

export type ContinueTrialInput = {
  trialThreadId: string;
  repoPath: string;
  instruction: string;
};

export type TrialAgentResult = {
  trialThreadId: string;
  response: string;
};
