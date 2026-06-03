import type {
  ExperimentMetric,
  ExperimentTrial,
  ScoreDirection,
} from "@/lib/experiments";

export function formatScore(score: number) {
  return Number.isInteger(score)
    ? String(score)
    : String(Number(score.toFixed(6)));
}

export function isScoreImproved(
  score: number,
  baseline: number,
  direction: ScoreDirection,
) {
  return direction === "minimize" ? score < baseline : score > baseline;
}

export function isBetterScore(
  score: number,
  currentBest: number,
  direction: ScoreDirection,
) {
  return direction === "minimize" ? score < currentBest : score > currentBest;
}

export function getBestImprovedTrial(
  trials: ExperimentTrial[],
  direction: ScoreDirection,
) {
  return trials
    .filter((trial): trial is ExperimentTrial & { score: number } =>
      Boolean(trial.improved && Number.isFinite(trial.score)),
    )
    .sort((a, b) => (isBetterScore(a.score, b.score, direction) ? -1 : 1))[0];
}

export function updateRunMetrics(
  scoreName: string,
  baselineScore: number,
  trials: ExperimentTrial[],
  direction: ScoreDirection,
): ExperimentMetric[] {
  const completedTrials = trials.filter((trial) => trial.status !== "running");
  const improvedTrials = trials.filter((trial) => trial.improved);
  const bestTrial = getBestImprovedTrial(trials, direction);

  return [
    {
      label: "Baseline",
      value: formatScore(baselineScore),
      detail: scoreName,
    },
    {
      label: "Trials",
      value: String(completedTrials.length),
      detail: `${improvedTrials.length} improved`,
    },
    {
      label: "Best",
      value: bestTrial?.metricValue ?? "-",
      detail: bestTrial?.branchName ?? "No improved trial yet",
    },
  ];
}
