export type StartTrialInput = {
  repoPath: string;
  instruction: string;
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
