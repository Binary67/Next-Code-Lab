export type TrialEvaluationContract = {
  scriptPath: string;
  runCommand: string;
  scoreDirection: "minimize" | "maximize";
  scoreName: string;
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
