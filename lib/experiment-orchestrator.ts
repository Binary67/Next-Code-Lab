import type { TrialEvaluationContract } from "@/lib/codex/types";
import { CodexTrialAgent } from "@/lib/codex/trial-agent";
import {
  buildBaselineFailedExperiment,
  buildStartedExperiment,
  completeRun,
  persistExperiment,
} from "@/lib/experiment-orchestrator/experiment-state";
import { runEvaluation } from "@/lib/experiment-orchestrator/evaluation-runner";
import {
  createBaselineWorktree,
  getGitState,
} from "@/lib/experiment-orchestrator/git-worktrees";
import { runTrial } from "@/lib/experiment-orchestrator/trial-flow";
import {
  applyExperimentDefaults,
  type Experiment,
} from "@/lib/experiments";

export {
  isBetterScore,
  isScoreImproved,
} from "@/lib/experiment-orchestrator/score";

type RunExperimentInput = {
  experiment: Experiment;
  repoPath: string;
};

function normalizeRunCount(value: number) {
  return Number.isInteger(value) && value > 0 ? value : 1;
}

export class ExperimentOrchestrator {
  private readonly trialAgent = new CodexTrialAgent();

  async start(input: RunExperimentInput): Promise<Experiment> {
    let experiment = applyExperimentDefaults(input.experiment);
    const evaluation = experiment.evaluation;

    if (evaluation.status !== "ready" || !evaluation.scoreDirection) {
      throw new Error("Complete evaluation setup before starting.");
    }

    const trialCount = normalizeRunCount(experiment.trialCount);
    const evalBudgetPerTrial = normalizeRunCount(
      experiment.evalBudgetPerTrial,
    );
    const contract: TrialEvaluationContract = {
      scriptPath: evaluation.scriptPath,
      runCommand: evaluation.runCommand,
      scoreName: evaluation.scoreName,
      scoreDirection: evaluation.scoreDirection,
    };
    let repoRoot: string;
    let baseBranch: string;
    let baseCommit: string;
    let baselineScore: number;

    try {
      const gitState = await getGitState(input.repoPath);
      repoRoot = gitState.repoRoot;
      baseBranch = gitState.baseBranch;
      baseCommit = gitState.baseCommit;
      const baselineWorktree = await createBaselineWorktree(
        repoRoot,
        experiment.id,
        baseCommit,
      );
      baselineScore = await runEvaluation(
        contract,
        baselineWorktree,
        repoRoot,
        experiment.runbook,
      );
    } catch (error) {
      const failed = buildBaselineFailedExperiment(
        experiment,
        error instanceof Error ? error.message : "Baseline evaluation failed.",
      );

      await persistExperiment(failed);
      return failed;
    }

    experiment = buildStartedExperiment({
      experiment,
      repoRoot,
      trialCount,
      evalBudgetPerTrial,
      baseBranch,
      baseCommit,
      baselineScore,
      contract,
    });
    await persistExperiment(experiment);

    for (let index = 1; index <= trialCount; index += 1) {
      experiment = await runTrial(
        {
          experiment,
          repoRoot,
          baseCommit,
          contract,
          baselineScore,
          trialNumber: index,
          evalBudget: evalBudgetPerTrial,
          runbook: experiment.runbook,
        },
        this.trialAgent,
      );
      await persistExperiment(experiment);
    }

    return completeRun(experiment, repoRoot, contract.scoreDirection);
  }
}
