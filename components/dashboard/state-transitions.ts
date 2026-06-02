import type { Experiment, ExperimentEvaluation } from "@/lib/experiments";
import type {
  EvalSetupResponse,
  TrialEvaluationContract,
} from "@/lib/codex/types";
import {
  createEvalSetupAgentMessage,
  directionLabel,
  normalizeEvaluation,
  refreshEvaluationMetrics,
} from "./evaluation-utils";

export type ExperimentDraft = {
  repo: string;
  title: string;
  description: string;
};

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function createExperimentFromDraft(draft: ExperimentDraft): Experiment {
  const title = draft.title.trim();
  const context =
    draft.description.trim() ||
    "Evaluation setup required before optimization can start.";
  const base = {
    id: slugify(title) + "-" + Date.now(),
    repo: draft.repo.trim(),
    title,
    description: context,
  };
  const detail = {
    objective: context,
    targetLabel: "Direction",
    targetValue: "Not set",
    targetMetric: 0,
    evaluation: {
      mode: "existing",
      scriptPath: "",
      scoreDirection: null,
      runCommand: "",
      scoreName: "",
      status: "missing",
      messages: [],
    },
    metrics: [],
    trend: [],
    trials: [],
    progressSteps: [
      {
        id: "evaluation-setup",
        title: "Configure evaluation",
        detail: "Provide an existing eval script or generate one with the setup interview.",
        status: "active",
        time: "Just now",
      },
      {
        id: "baseline-measurement",
        title: "Collect baseline",
        detail: "Run the eval script and record the first score.",
        status: "queued",
        time: "Next",
      },
    ],
    changes: [],
    agentMessages: [],
  } satisfies Pick<
    Experiment,
    | "objective"
    | "targetLabel"
    | "targetValue"
    | "targetMetric"
    | "evaluation"
    | "metrics"
    | "trend"
    | "trials"
    | "progressSteps"
    | "changes"
    | "agentMessages"
  >;

  return {
    ...base,
    ...detail,
    status: "setup",
    metricLabel: "Evaluation",
    metricValue: "needed",
    timing: "setup",
  };
}

export function updateExperimentEvaluation(
  experiment: Experiment,
  patch: Partial<ExperimentEvaluation>,
): Experiment {
  const merged = {
    ...experiment.evaluation,
    ...patch,
  };
  const nextEvaluation = normalizeEvaluation(
    patch.mode === "existing"
      ? {
          ...merged,
          evalSetupThreadId: undefined,
          generatedScriptApproved: undefined,
          proposedContract: undefined,
          messages: [],
        }
      : patch.mode === "generated" && experiment.evaluation.mode !== "generated"
        ? {
            ...merged,
            scriptPath: "",
            runCommand: "",
            scoreName: "",
            scoreDirection: null,
            evalSetupThreadId: undefined,
            generatedScriptApproved: undefined,
            proposedContract: undefined,
            messages: [],
          }
        : merged,
  );

  return {
    ...experiment,
    evaluation: nextEvaluation,
    metricValue:
      experiment.status === "setup"
        ? nextEvaluation.status === "ready"
          ? "ready"
          : "needed"
        : experiment.metricValue,
    targetValue: directionLabel(nextEvaluation.scoreDirection),
    metrics: refreshEvaluationMetrics(experiment.metrics, nextEvaluation),
  };
}

export function applyEvalSetupStarted(
  experiment: Experiment,
  evalSetupThreadId: string,
  response: EvalSetupResponse,
): Experiment {
  const proposedContract =
    response.status === "ready" ? response.proposedContract : undefined;
  const nextEvaluation = normalizeEvaluation({
    ...experiment.evaluation,
    mode: "generated",
    scriptPath: "",
    runCommand: "",
    scoreName: "",
    scoreDirection: null,
    evalSetupThreadId,
    generatedScriptApproved: undefined,
    proposedContract,
    messages: [
      ...experiment.evaluation.messages,
      createEvalSetupAgentMessage(response),
    ],
  });

  return {
    ...experiment,
    evaluation: nextEvaluation,
    metrics: refreshEvaluationMetrics(experiment.metrics, nextEvaluation),
  };
}

export function applyEvalSetupReply(
  experiment: Experiment,
  text: string,
  response: EvalSetupResponse,
): Experiment {
  const proposedContract =
    response.status === "ready" ? response.proposedContract : undefined;
  const nextEvaluation = normalizeEvaluation({
    ...experiment.evaluation,
    mode: "generated",
    scriptPath: "",
    runCommand: "",
    scoreName: "",
    scoreDirection: null,
    generatedScriptApproved: undefined,
    proposedContract,
    messages: [
      ...experiment.evaluation.messages,
      {
        id: "eval-user-" + Date.now(),
        author: "user",
        text,
        time: "Just now",
      },
      createEvalSetupAgentMessage(response),
    ],
  });

  return {
    ...experiment,
    evaluation: nextEvaluation,
    metrics: refreshEvaluationMetrics(experiment.metrics, nextEvaluation),
  };
}

export function applyGeneratedEvaluationApproval(
  experiment: Experiment,
  response: EvalSetupResponse,
  contract: TrialEvaluationContract,
): Experiment {
  const nextEvaluation = normalizeEvaluation({
    ...experiment.evaluation,
    mode: "generated",
    scriptPath: contract.scriptPath,
    runCommand: contract.runCommand,
    scoreName: contract.scoreName,
    scoreDirection: contract.scoreDirection,
    proposedContract: contract,
    generatedScriptApproved: true,
    messages: [
      ...experiment.evaluation.messages,
      createEvalSetupAgentMessage(response),
    ],
  });

  return {
    ...experiment,
    evaluation: nextEvaluation,
    metricValue:
      experiment.status === "setup"
        ? nextEvaluation.status === "ready"
          ? "ready"
          : "needed"
        : experiment.metricValue,
    targetValue: directionLabel(nextEvaluation.scoreDirection),
    metrics: refreshEvaluationMetrics(experiment.metrics, nextEvaluation),
  };
}

export function startExperiment(experiment: Experiment): Experiment {
  const evaluation = normalizeEvaluation(experiment.evaluation);
  const metricLabel = "Current " + evaluation.scoreName;
  const direction = directionLabel(evaluation.scoreDirection);
  const runtimeInstruction = [
    "Repository: " + experiment.repo,
    "Eval script: " + evaluation.scriptPath,
    "Run command: " + evaluation.runCommand,
    "Score: " + evaluation.scoreName,
    "Direction: " + evaluation.scoreDirection,
  ].join("\n");

  return {
    ...experiment,
    status: "running",
    metricLabel,
    metricValue: "baseline pending",
    timing: "just started",
    targetLabel: "Direction",
    targetValue: direction,
    evaluation,
    metrics: [],
    trials: [
      {
        id: "T-01",
        title: "Baseline evaluation",
        summary: "Run " + evaluation.runCommand + " and record " + evaluation.scoreName + ".",
        metricValue: "pending",
        duration: "Just now",
        status: "running",
      },
      ...experiment.trials.filter((trial) => trial.id !== "Setup"),
    ],
    progressSteps: experiment.progressSteps.map((step) =>
      step.id === "evaluation-setup"
        ? {
            ...step,
            status: "completed",
            detail: "Evaluation contract is ready.",
            time: "Just now",
          }
        : step.id === "baseline-measurement"
          ? { ...step, status: "active", time: "Now" }
          : step,
    ),
    changes: [
      {
        id: "eval-contract",
        path: evaluation.scriptPath,
        summary: "Use " + evaluation.scoreName + " eval contract for optimization.",
        status: "planned",
      },
      ...experiment.changes.filter((change) => change.id !== "eval-contract"),
    ],
    agentMessages: [
      ...experiment.agentMessages,
      {
        id: "start-" + Date.now(),
        author: "agent",
        text: "Starting optimization with this eval contract:\n" + runtimeInstruction,
        time: "Just now",
      },
    ],
  };
}

export function approveExperiment(experiment: Experiment): Experiment {
  const message = "Approved. Resume the run.";

  return {
    ...experiment,
    status: "running",
    metricLabel: "Progress",
    metricValue: "resuming",
    timing: "just resumed",
    delta: undefined,
    pendingQuestion: undefined,
    agentMessages: [
      ...experiment.agentMessages,
      {
        id: "reply-" + Date.now(),
        author: "user",
        text: message,
        time: "Just now",
      },
    ],
    progressSteps: experiment.progressSteps.map((step) =>
      step.status === "blocked"
        ? {
            ...step,
            status: "completed",
            detail: "User approved the next run.",
            time: "Just now",
          }
        : step.status === "queued"
          ? { ...step, status: "active", time: "Now" }
          : step,
    ),
  };
}

export function addRuntimeReply(
  experiment: Experiment,
  text: string,
): Experiment {
  return {
    ...experiment,
    agentMessages: [
      ...experiment.agentMessages,
      {
        id: "reply-" + Date.now(),
        author: "user",
        text,
        time: "Just now",
      },
    ],
  };
}

export function answerPendingQuestion(
  experiment: Experiment,
  answer: string,
): Experiment {
  return {
    ...experiment,
    status: "running",
    metricLabel: "Progress",
    metricValue: "resuming",
    timing: "just resumed",
    delta: undefined,
    pendingQuestion: undefined,
    agentMessages: [
      ...experiment.agentMessages,
      {
        id: "answer-" + Date.now(),
        author: "user",
        text: answer,
        time: "Just now",
      },
    ],
    progressSteps: experiment.progressSteps.map((step) =>
      step.status === "blocked"
        ? {
            ...step,
            status: "completed",
            detail: "User selected " + answer + ".",
            time: "Just now",
          }
        : step.status === "queued"
          ? { ...step, status: "active", time: "Now" }
          : step,
    ),
    changes: experiment.changes.map((change) =>
      change.status === "planned" ? { ...change, status: "applied" } : change,
    ),
  };
}
