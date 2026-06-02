import type {
  AgentMessage,
  EvaluationStatus,
  ExperimentEvaluation,
  ExperimentMetric,
  ScoreDirection,
} from "@/lib/experiments";
import type {
  EvalSetupResponse,
  TrialEvaluationContract,
} from "@/lib/codex/types";
import type { EvalSetupPendingAction } from "./types";

export function getEvaluationStatus(
  evaluation: Pick<
    ExperimentEvaluation,
    "scriptPath" | "runCommand" | "scoreDirection"
  >,
): EvaluationStatus {
  const hasScript = Boolean(evaluation.scriptPath.trim());
  const hasCommand = Boolean(evaluation.runCommand.trim());
  const hasDirection = Boolean(evaluation.scoreDirection);

  if (hasScript && hasCommand && hasDirection) return "ready";
  if (hasScript || hasCommand || hasDirection) return "incomplete";
  return "missing";
}

export function getMissingEvaluationFields(evaluation: ExperimentEvaluation) {
  const missing = [];
  if (!evaluation.scriptPath.trim()) missing.push("eval script path");
  if (!evaluation.runCommand.trim()) missing.push("run command");
  if (!evaluation.scoreDirection) missing.push("score direction");
  return missing;
}

export function normalizeEvaluation(
  evaluation: ExperimentEvaluation,
): ExperimentEvaluation {
  const scoreName = evaluation.scoreName.trim();
  const next = {
    ...evaluation,
    scoreName,
  };
  const status = getEvaluationStatus(next);

  return {
    ...next,
    scoreName: status === "ready" ? scoreName || "score" : scoreName,
    status,
  };
}

export function evaluationStatusLabel(status: EvaluationStatus) {
  if (status === "ready") return "Ready";
  if (status === "incomplete") return "Incomplete";
  return "Needed";
}

export function directionLabel(direction: ScoreDirection | null) {
  if (!direction) return "Not set";
  return direction === "minimize" ? "Minimize" : "Maximize";
}

export function formatEvalContract(contract: TrialEvaluationContract) {
  return [
    `Eval script: ${contract.scriptPath}`,
    `Run command: ${contract.runCommand}`,
    `Score: ${contract.scoreName}`,
    `Direction: ${contract.scoreDirection}`,
  ].join("\n");
}

export function getEvalSetupContract(response: EvalSetupResponse) {
  if (response.status === "ready") return response.proposedContract;
  if (response.status === "generated") return response.contract;
  return undefined;
}

export function createEvalSetupAgentMessage(
  response: EvalSetupResponse,
): AgentMessage {
  const contract = getEvalSetupContract(response);
  const text =
    response.status === "question"
      ? [response.message, response.question].filter(Boolean).join("\n\n")
      : contract
        ? [response.message, formatEvalContract(contract)].join("\n\n")
        : response.message;

  return {
    id: `eval-agent-${Date.now()}`,
    author: "agent",
    text,
    time: "Just now",
    choices: response.status === "question" ? response.choices : undefined,
  };
}

export function evalSetupPendingLabel(action: EvalSetupPendingAction) {
  if (action === "start") return "Codex is working on the eval setup...";
  if (action === "reply") return "Waiting for Codex...";
  return "Writing generated eval...";
}

export function refreshEvaluationMetrics(
  metrics: ExperimentMetric[],
  evaluation: ExperimentEvaluation,
) {
  return metrics.map((metric) => {
    if (metric.label === "Evaluation") {
      return {
        ...metric,
        value: evaluationStatusLabel(evaluation.status),
        detail: evaluation.mode === "existing" ? "existing script" : "generated script",
      };
    }

    if (metric.label === "Score") {
      return {
        ...metric,
        value: evaluation.status === "ready" ? evaluation.scoreName : "-",
        detail:
          evaluation.status === "ready"
            ? directionLabel(evaluation.scoreDirection)
            : "Not set",
      };
    }

    return metric;
  });
}
