import type { TrialEvaluationContract } from "@/lib/codex/types";
import { readExperiments, writeExperiments } from "@/lib/experiment-store";
import type {
  Experiment,
  ExperimentTrial,
  ProgressStep,
  ScoreDirection,
} from "@/lib/experiments";
import { appendTrialLog } from "@/lib/trial-log-store";

import { createBestBranch } from "./git-worktrees";
import { formatScore, isBetterScore, updateRunMetrics } from "./score";

type BuildStartedExperimentInput = {
  experiment: Experiment;
  repoRoot: string;
  trialCount: number;
  evalBudgetPerTrial: number;
  baseBranch: string;
  baseCommit: string;
  baselineScore: number;
  contract: TrialEvaluationContract;
};

export async function persistExperiment(experiment: Experiment) {
  const experiments = await readExperiments();
  const index = experiments.findIndex((item) => item.id === experiment.id);

  if (index === -1) {
    await writeExperiments([experiment, ...experiments]);
    return;
  }

  const next = [...experiments];
  next[index] = experiment;
  await writeExperiments(next);
}

export function withTrial(experiment: Experiment, trial: ExperimentTrial) {
  const existing = experiment.trials.filter((item) => item.id !== trial.id);

  return {
    ...experiment,
    trials: [trial, ...existing],
  };
}

function baseProgressSteps(): ProgressStep[] {
  return [
    {
      id: "evaluation-setup",
      title: "Configure evaluation",
      detail: "Evaluation contract is ready.",
      status: "completed",
      time: "Done",
    },
    {
      id: "baseline-measurement",
      title: "Collect baseline",
      detail: "Baseline score has been recorded.",
      status: "completed",
      time: "Done",
    },
    {
      id: "trial-run",
      title: "Run trials",
      detail: "Codex optimization trials are in progress.",
      status: "active",
      time: "Now",
    },
    {
      id: "best-branch",
      title: "Create best branch",
      detail: "Queued until trials finish.",
      status: "queued",
      time: "Next",
    },
  ];
}

export function buildBaselineFailedExperiment(
  experiment: Experiment,
  message: string,
): Experiment {
  return {
    ...experiment,
    status: "failed",
    metricLabel: "Baseline",
    metricValue: "failed",
    timing: "baseline failed",
    trials: [],
    progressSteps: [
      {
        id: "evaluation-setup",
        title: "Configure evaluation",
        detail: "Evaluation contract is ready.",
        status: "completed",
        time: "Done",
      },
      {
        id: "baseline-measurement",
        title: "Collect baseline",
        detail: message,
        status: "blocked",
        time: "Failed",
      },
    ],
    agentMessages: [
      ...experiment.agentMessages,
      {
        id: `baseline-failed-${Date.now()}`,
        author: "agent",
        text: message,
        time: "Just now",
      },
    ],
  };
}

export function buildStartedExperiment({
  experiment,
  repoRoot,
  trialCount,
  evalBudgetPerTrial,
  baseBranch,
  baseCommit,
  baselineScore,
  contract,
}: BuildStartedExperimentInput): Experiment {
  return {
    ...experiment,
    repo: repoRoot,
    status: "running",
    trialCount,
    evalBudgetPerTrial,
    baseBranch,
    baseCommit,
    baselineScore,
    bestBranchName: undefined,
    metricLabel: `Current ${contract.scoreName}`,
    metricValue: formatScore(baselineScore),
    targetLabel: "Baseline",
    targetValue: formatScore(baselineScore),
    targetMetric: baselineScore,
    timing: "baseline measured",
    delta: undefined,
    trials: [],
    trend: [{ label: "Baseline", value: baselineScore }],
    metrics: updateRunMetrics(
      contract.scoreName,
      baselineScore,
      [],
      contract.scoreDirection,
    ),
    progressSteps: baseProgressSteps(),
    changes: [
      {
        id: "eval-contract",
        path: contract.scriptPath,
        summary: "Use hidden eval contract for optimization scoring.",
        status: "validated",
      },
    ],
    agentMessages: [
      ...experiment.agentMessages,
      {
        id: `orchestrator-${Date.now()}`,
        author: "agent",
        text: `Baseline ${contract.scoreName}: ${formatScore(
          baselineScore,
        )}. Starting ${trialCount} trials.`,
        time: "Just now",
      },
    ],
  };
}

export async function completeRun(
  experiment: Experiment,
  repoRoot: string,
  direction: ScoreDirection,
) {
  const improvedTrials = experiment.trials
    .filter(
      (
        trial,
      ): trial is ExperimentTrial & { score: number; commitSha: string } =>
        Boolean(
          trial.improved &&
            trial.commitSha &&
            Number.isFinite(trial.score),
        ),
    )
    .sort((a, b) => (isBetterScore(a.score, b.score, direction) ? -1 : 1));
  const bestTrial = improvedTrials[0];
  const bestBranchName = bestTrial
    ? `optimizer/${experiment.id}/best`
    : undefined;

  if (bestTrial && bestBranchName) {
    await createBestBranch(repoRoot, bestBranchName, bestTrial.commitSha);
    await appendTrialLog(
      experiment.id,
      bestTrial.id,
      [
        "## Run Selection",
        "",
        "[Status]",
        `Best branch ${bestBranchName} created from this trial.`,
      ].join("\n"),
    );
  }

  const metrics = updateRunMetrics(
    experiment.evaluation.scoreName,
    experiment.baselineScore ?? 0,
    experiment.trials,
    direction,
  );

  const next: Experiment = {
    ...experiment,
    status: "completed",
    bestBranchName,
    metricLabel: bestTrial
      ? `Best ${experiment.evaluation.scoreName}`
      : experiment.metricLabel,
    metricValue: bestTrial ? formatScore(bestTrial.score) : "no improvement",
    timing: `${experiment.trials.length} trials completed`,
    delta: bestTrial
      ? {
          dir: direction === "minimize" ? "down" : "up",
          value: formatScore(
            Math.abs(bestTrial.score - (experiment.baselineScore ?? 0)),
          ),
        }
      : undefined,
    metrics,
    progressSteps: experiment.progressSteps.map((step) =>
      step.id === "trial-run"
        ? { ...step, status: "completed", time: "Done" }
        : step.id === "best-branch"
          ? {
              ...step,
              status: bestTrial ? "completed" : "blocked",
              detail: bestTrial
                ? `Best branch ${bestBranchName} created.`
                : "No trial improved the baseline.",
              time: "Done",
            }
          : step,
    ),
    changes: bestTrial
      ? [
          {
            id: "best-branch",
            path: bestBranchName ?? "",
            summary: `Best trial ${bestTrial.id} improved ${
              experiment.evaluation.scoreName
            }.`,
            status: "validated",
          },
          ...experiment.changes.filter((change) => change.id !== "best-branch"),
        ]
      : experiment.changes,
    agentMessages: [
      ...experiment.agentMessages,
      {
        id: `complete-${Date.now()}`,
        author: "agent",
        text: bestTrial
          ? `Best branch ${bestBranchName} points to ${
              bestTrial.id
            } with score ${formatScore(bestTrial.score)}.`
          : "All trials completed without improving the baseline.",
        time: "Just now",
      },
    ],
  };

  await persistExperiment(next);
  return next;
}
