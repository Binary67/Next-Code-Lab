import {
  exec as execCallback,
  execFile as execFileCallback,
} from "node:child_process";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import type {
  TrialAgentResponse,
  TrialEvaluationContract,
} from "@/lib/codex/types";
import { CodexTrialAgent } from "@/lib/codex/trial-agent";
import { readExperiments, writeExperiments } from "@/lib/experiment-store";
import {
  applyExperimentDefaults,
  type Experiment,
  type ExperimentMetric,
  type ExperimentTrial,
  type ProgressStep,
  type ScoreDirection,
} from "@/lib/experiments";

const execAsync = promisify(execCallback);
const execFileAsync = promisify(execFileCallback);

type RunExperimentInput = {
  experiment: Experiment;
  repoPath: string;
};

type TrialWorktree = {
  id: string;
  branchName: string;
  path: string;
};

function formatScore(score: number) {
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

function normalizeRunCount(value: number) {
  return Number.isInteger(value) && value > 0 ? value : 1;
}

async function runGit(cwd: string, args: string[]) {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    maxBuffer: 10 * 1024 * 1024,
  });

  return stdout.trim();
}

async function getGitState(repoPath: string) {
  const repoRoot = await runGit(repoPath, ["rev-parse", "--show-toplevel"]);
  const baseBranch = await runGit(repoRoot, [
    "rev-parse",
    "--abbrev-ref",
    "HEAD",
  ]);
  const baseCommit = await runGit(repoRoot, ["rev-parse", "HEAD"]);

  return { repoRoot, baseBranch, baseCommit };
}

function worktreeRoot(experimentId: string) {
  return join(process.cwd(), ".local", "worktrees", experimentId);
}

async function createBaselineWorktree(
  repoRoot: string,
  experimentId: string,
  baseCommit: string,
) {
  const root = worktreeRoot(experimentId);
  const path = join(root, "baseline");

  await mkdir(root, { recursive: true });
  await runGit(repoRoot, ["worktree", "add", "--detach", path, baseCommit]);
  return path;
}

async function createTrialWorktree(
  repoRoot: string,
  experimentId: string,
  trialNumber: number,
  baseCommit: string,
): Promise<TrialWorktree> {
  const id = `T-${String(trialNumber).padStart(2, "0")}`;
  const slug = `trial-${String(trialNumber).padStart(3, "0")}`;
  const branchName = `optimizer/${experimentId}/${slug}`;
  const root = worktreeRoot(experimentId);
  const path = join(root, slug);

  await mkdir(root, { recursive: true });
  await runGit(repoRoot, [
    "worktree",
    "add",
    "-B",
    branchName,
    path,
    baseCommit,
  ]);

  return { id, branchName, path };
}

function commandErrorMessage(error: unknown) {
  const record = error as { message?: string; stderr?: string; stdout?: string };
  const detail =
    record.stderr?.trim() || record.stdout?.trim() || record.message;

  return detail || "Command failed.";
}

async function runEvaluation(
  contract: TrialEvaluationContract,
  targetRepoPath: string,
) {
  try {
    const { stdout } = await execAsync(contract.runCommand, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        OPTIMIZER_TARGET_REPO: targetRepoPath,
        OPTIMIZER_WORKTREE: targetRepoPath,
      },
      maxBuffer: 10 * 1024 * 1024,
    });
    const score = Number(stdout.trim());

    if (!Number.isFinite(score)) {
      throw new Error("Eval command must print one numeric score.");
    }

    return score;
  } catch (error) {
    throw new Error(`Evaluation failed: ${commandErrorMessage(error)}`, {
      cause: error,
    });
  }
}

async function commitTrialChanges(worktreePath: string, trialId: string) {
  const status = await runGit(worktreePath, ["status", "--porcelain"]);

  if (status) {
    await runGit(worktreePath, ["add", "-A"]);
    await runGit(worktreePath, [
      "-c",
      "user.name=Optimizer Lab",
      "-c",
      "user.email=optimizer-lab@example.invalid",
      "commit",
      "-m",
      `Optimizer trial ${trialId}`,
    ]);
  }

  return runGit(worktreePath, ["rev-parse", "HEAD"]);
}

async function persistExperiment(experiment: Experiment) {
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

function withTrial(experiment: Experiment, trial: ExperimentTrial) {
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

function getBestImprovedTrial(
  trials: ExperimentTrial[],
  direction: ScoreDirection,
) {
  return trials
    .filter((trial): trial is ExperimentTrial & { score: number } =>
      Boolean(trial.improved && Number.isFinite(trial.score)),
    )
    .sort((a, b) => (isBetterScore(a.score, b.score, direction) ? -1 : 1))[0];
}

function updateRunMetrics(
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

function buildEvalFeedback(score: number, improved: boolean, remaining: number) {
  return [
    `Hidden eval score: ${formatScore(score)}`,
    improved ? "Result: improved." : "Result: did not beat the baseline.",
    `Remaining eval requests: ${remaining}`,
    improved
      ? "Stop work. The orchestrator will finish this trial."
      : [
          "Continue optimizing, then return request_eval when ready for",
          "another score. Return done if no useful path remains.",
        ].join(" "),
  ].join("\n");
}

function shouldEvaluate(response: TrialAgentResponse, evalsUsed: number) {
  return (
    response.status === "request_eval" ||
    (response.status === "done" && evalsUsed === 0)
  );
}

export class ExperimentOrchestrator {
  private readonly trialAgent = new CodexTrialAgent();

  private failBeforeTrials(experiment: Experiment, message: string): Experiment {
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
      baselineScore = await runEvaluation(contract, baselineWorktree);
    } catch (error) {
      const failed = this.failBeforeTrials(
        experiment,
        error instanceof Error ? error.message : "Baseline evaluation failed.",
      );

      await persistExperiment(failed);
      return failed;
    }

    experiment = {
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
    await persistExperiment(experiment);

    for (let index = 1; index <= trialCount; index += 1) {
      experiment = await this.runTrial({
        experiment,
        repoRoot,
        baseCommit,
        contract,
        baselineScore,
        trialNumber: index,
        evalBudget: evalBudgetPerTrial,
      });
      await persistExperiment(experiment);
    }

    return this.completeRun(experiment, repoRoot, contract.scoreDirection);
  }

  private async runTrial(input: {
    experiment: Experiment;
    repoRoot: string;
    baseCommit: string;
    contract: TrialEvaluationContract;
    baselineScore: number;
    trialNumber: number;
    evalBudget: number;
  }) {
    const { experiment, contract, baselineScore, trialNumber, evalBudget } =
      input;
    const startedAt = new Date().toISOString();
    const worktree = await createTrialWorktree(
      input.repoRoot,
      experiment.id,
      trialNumber,
      input.baseCommit,
    );
    let trial: ExperimentTrial = {
      id: worktree.id,
      title: `Optimization trial ${trialNumber}`,
      summary: "Codex is optimizing from the captured base commit.",
      metricValue: "pending",
      duration: "Running",
      status: "running",
      branchName: worktree.branchName,
      worktreePath: worktree.path,
      evalsUsed: 0,
      improved: false,
      startedAt,
    };
    let nextExperiment = withTrial(experiment, trial);

    try {
      let turn = await this.trialAgent.startTrial({
        repoPath: worktree.path,
        objective: experiment.objective,
        scoreName: contract.scoreName,
        scoreDirection: contract.scoreDirection,
        baselineScore,
        evalBudget,
        trialNumber,
      });
      trial = {
        ...trial,
        threadId: turn.trialThreadId,
        summary: turn.response.message,
      };
      nextExperiment = withTrial(nextExperiment, trial);
      await persistExperiment(nextExperiment);

      while (trial.evalsUsed !== undefined && trial.evalsUsed < evalBudget) {
        if (turn.response.status === "blocked") {
          trial = {
            ...trial,
            status: "failed",
            summary: turn.response.message,
            duration: "Blocked",
            completedAt: new Date().toISOString(),
          };
          return withTrial(nextExperiment, trial);
        }

        if (!shouldEvaluate(turn.response, trial.evalsUsed)) {
          break;
        }

        const score = await runEvaluation(contract, worktree.path);
        const evalsUsed = trial.evalsUsed + 1;
        const improved = isScoreImproved(
          score,
          baselineScore,
          contract.scoreDirection,
        );

        trial = {
          ...trial,
          score,
          evalsUsed,
          improved,
          metricValue: formatScore(score),
          summary: improved
            ? "Trial improved the hidden score."
            : "Trial did not beat the baseline yet.",
        };
        nextExperiment = {
          ...withTrial(nextExperiment, trial),
          trend: [
            ...nextExperiment.trend.filter((point) => point.label !== trial.id),
            { label: trial.id, value: score },
          ],
        };
        await persistExperiment(nextExperiment);

        if (improved) {
          const commitSha = await commitTrialChanges(worktree.path, trial.id);
          trial = {
            ...trial,
            commitSha,
            status: "completed",
            duration: `${evalsUsed} eval${evalsUsed === 1 ? "" : "s"}`,
            completedAt: new Date().toISOString(),
          };
          return withTrial(nextExperiment, trial);
        }

        if (evalsUsed >= evalBudget || turn.response.status === "done") {
          break;
        }

        turn = await this.trialAgent.continueTrial({
          trialThreadId: turn.trialThreadId,
          repoPath: worktree.path,
          instruction: buildEvalFeedback(score, false, evalBudget - evalsUsed),
        });
        trial = { ...trial, summary: turn.response.message };
        nextExperiment = withTrial(nextExperiment, trial);
        await persistExperiment(nextExperiment);
      }

      trial = {
        ...trial,
        status: "completed",
        summary:
          trial.score === undefined
            ? "Trial ended without requesting an eval."
            : "Trial finished without improving the baseline.",
        duration: `${trial.evalsUsed ?? 0} eval${
          trial.evalsUsed === 1 ? "" : "s"
        }`,
        completedAt: new Date().toISOString(),
      };

      return withTrial(nextExperiment, trial);
    } catch (error) {
      trial = {
        ...trial,
        status: "failed",
        summary: error instanceof Error ? error.message : "Trial failed.",
        metricValue: trial.score === undefined ? "invalid" : trial.metricValue,
        duration: "Failed",
        completedAt: new Date().toISOString(),
      };

      return withTrial(nextExperiment, trial);
    }
  }

  private async completeRun(
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
      await runGit(repoRoot, [
        "branch",
        "-f",
        bestBranchName,
        bestTrial.commitSha,
      ]);
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
}
