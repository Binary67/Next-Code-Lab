import type { Experiment, ExperimentTrial } from "@/lib/experiments";

function formatScoreValue(value: number) {
  return Number.isInteger(value)
    ? String(value)
    : String(Number(value.toFixed(6)));
}

export function getBestTrial(
  trials: ExperimentTrial[],
  direction: Experiment["evaluation"]["scoreDirection"],
) {
  const scored = trials.filter(
    (trial): trial is ExperimentTrial & { score: number } =>
      Boolean(trial.improved && Number.isFinite(trial.score)),
  );

  if (scored.length === 0) {
    return null;
  }

  if (!direction) {
    return scored[0];
  }

  return scored.reduce((best, trial) => {
    const better =
      direction === "minimize" ? trial.score < best.score : trial.score > best.score;
    return better ? trial : best;
  });
}

export function getTrialDelta(
  trial: ExperimentTrial,
  baselineScore: number | undefined,
) {
  if (!Number.isFinite(trial.score) || !Number.isFinite(baselineScore)) {
    return null;
  }

  const delta = (trial.score as number) - (baselineScore as number);
  const sign = delta > 0 ? "+" : delta < 0 ? "-" : "";

  return {
    value: `${sign}${formatScoreValue(Math.abs(delta))}`,
    raw: delta,
  };
}
