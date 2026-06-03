import type { CodexTrialAgent } from "@/lib/codex/trial-agent";
import type {
  TrialAgentResponse,
  TrialEvaluationContract,
} from "@/lib/codex/types";
import type { Experiment, ExperimentTrial } from "@/lib/experiments";
import { appendTrialLog, createTrialLog } from "@/lib/trial-log-store";

import { runEvaluation } from "./evaluation-runner";
import {
  createTrialWorktrees,
  resetEvalWorktree,
  snapshotTrialChanges,
} from "./git-worktrees";
import { formatScore, isScoreImproved } from "./score";
import { persistExperiment, withTrial } from "./experiment-state";
import { addTokenUsage } from "./token-usage";

type RunTrialInput = {
  experiment: Experiment;
  repoRoot: string;
  baseCommit: string;
  contract: TrialEvaluationContract;
  baselineScore: number;
  trialNumber: number;
  evalBudget: number;
};

type TrialAgent = Pick<CodexTrialAgent, "startTrial" | "continueTrial">;

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

export async function runTrial(input: RunTrialInput, trialAgent: TrialAgent) {
  const { experiment, contract, baselineScore, trialNumber, evalBudget } =
    input;
  const startedAt = new Date().toISOString();
  const worktree = await createTrialWorktrees(
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
    agentWorktreePath: worktree.agentPath,
    evalWorktreePath: worktree.evalPath,
    evalsUsed: 0,
    improved: false,
    startedAt,
  };
  trial = {
    ...trial,
    log: await createTrialLog({
      experimentId: experiment.id,
      trialId: worktree.id,
      title: trial.title,
      status: trial.status,
      branchName: worktree.branchName,
      agentWorktreePath: worktree.agentPath,
      evalWorktreePath: worktree.evalPath,
    }),
  };
  let nextExperiment = withTrial(experiment, trial);
  const appendLog = async (markdown: string) => {
    const log = await appendTrialLog(experiment.id, worktree.id, markdown);
    trial = { ...trial, log };
  };

  await persistExperiment(nextExperiment);
  await appendLog(
    [
      "## Orchestration",
      "",
      "[Setup]",
      `Created trial worktrees from base commit ${input.baseCommit}.`,
      `Eval budget: ${evalBudget}`,
    ].join("\n"),
  );
  nextExperiment = withTrial(nextExperiment, trial);

  try {
    let turn = await trialAgent.startTrial(
      {
        repoPath: worktree.agentPath,
        objective: experiment.objective,
        scoreName: contract.scoreName,
        scoreDirection: contract.scoreDirection,
        baselineScore,
        evalBudget,
        trialNumber,
      },
      {
        turnNumber: 1,
        inputSummary: `Started optimization trial ${trialNumber} for objective: ${experiment.objective}`,
        appendLog,
        onThreadStarted: async (threadId) => {
          trial = { ...trial, threadId };
          nextExperiment = withTrial(nextExperiment, trial);
          await persistExperiment(nextExperiment);
          await appendLog(`[Setup]\nThread: ${threadId}`);
        },
      },
    );
    trial = {
      ...trial,
      threadId: turn.trialThreadId,
      summary: turn.response.message,
      tokenUsage: addTokenUsage(trial.tokenUsage, turn.tokenUsage),
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
        await appendLog(
          [
            "## Final Status",
            "",
            "Failed",
            "Trial stopped because Codex reported it was blocked.",
            trial.commitSha ? `Commit: ${trial.commitSha}` : "Commit: none",
          ].join("\n"),
        );
        return withTrial(nextExperiment, trial);
      }

      if (!shouldEvaluate(turn.response, trial.evalsUsed)) {
        break;
      }

      const evalsUsed = trial.evalsUsed + 1;
      await appendLog(
        [
          `## Evaluation ${evalsUsed}`,
          "",
          "[Snapshot]",
          "Committing trial changes for evaluation.",
        ].join("\n"),
      );
      const commitSha = await snapshotTrialChanges(
        worktree.agentPath,
        trial.id,
        evalsUsed,
      );
      trial = { ...trial, commitSha };
      nextExperiment = withTrial(nextExperiment, trial);
      await persistExperiment(nextExperiment);
      await appendLog(`[Snapshot]\nCommitted trial changes as ${commitSha}.`);

      await resetEvalWorktree(worktree.evalPath, commitSha);
      const score = await runEvaluation(
        contract,
        worktree.evalPath,
        input.repoRoot,
      );
      const improved = isScoreImproved(
        score,
        baselineScore,
        contract.scoreDirection,
      );
      await appendLog(
        [
          "[Output]",
          `Score: ${formatScore(score)}`,
          `Baseline: ${formatScore(baselineScore)}`,
          `Result: ${improved ? "improved" : "did not beat the baseline"}`,
          `Remaining eval requests: ${evalBudget - evalsUsed}`,
        ].join("\n"),
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
        trial = {
          ...trial,
          commitSha,
          status: "completed",
          duration: `${evalsUsed} eval${evalsUsed === 1 ? "" : "s"}`,
          completedAt: new Date().toISOString(),
        };
        await appendLog(
          [
            "[Status]",
            "Completed. Trial stopped because it beat the baseline.",
            "",
            "## Final Status",
            "",
            "Completed",
            `Best score: ${formatScore(score)}`,
            `Commit: ${commitSha}`,
          ].join("\n"),
        );
        return withTrial(nextExperiment, trial);
      }

      if (evalsUsed >= evalBudget || turn.response.status === "done") {
        break;
      }

      const remaining = evalBudget - evalsUsed;
      const turnNumber = evalsUsed + 1;
      turn = await trialAgent.continueTrial(
        {
          trialThreadId: turn.trialThreadId,
          repoPath: worktree.agentPath,
          instruction: buildEvalFeedback(score, false, remaining),
        },
        {
          turnNumber,
          inputSummary: [
            `Continued after evaluation ${evalsUsed}.`,
            `Score: ${formatScore(score)}.`,
            `Remaining eval requests: ${remaining}.`,
          ].join(" "),
          appendLog,
        },
      );
      trial = { ...trial, summary: turn.response.message };
      trial = {
        ...trial,
        tokenUsage: addTokenUsage(trial.tokenUsage, turn.tokenUsage),
      };
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
    await appendLog(
      [
        "## Final Status",
        "",
        trial.score === undefined
          ? "Completed without requesting an evaluation."
          : "Completed without improving the baseline.",
        trial.score === undefined
          ? "Best score: none"
          : `Best score: ${formatScore(trial.score)}`,
        trial.commitSha ? `Commit: ${trial.commitSha}` : "Commit: none",
      ].join("\n"),
    );

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
    await appendLog(
      [
        "## Final Status",
        "",
        "Failed",
        error instanceof Error ? error.message : "Trial failed.",
        trial.commitSha ? `Commit: ${trial.commitSha}` : "Commit: none",
      ].join("\n"),
    );

    return withTrial(nextExperiment, trial);
  }
}
