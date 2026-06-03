import type { Experiment, ExperimentEvaluation } from "@/lib/experiments";
import type { WorkflowPageItem } from "../shared";
import type { EvalSetupPendingAction } from "../types";
import { evaluationStatusLabel } from "../evaluation-utils";
import type { EvaluationPageId } from "./types";

export function defaultEvaluationPage(
  evaluation: ExperimentEvaluation,
): EvaluationPageId {
  return evaluation.mode === "generated" || evaluation.evalSetupThreadId
    ? "interview"
    : "setup";
}

export function getEvaluationPages({
  experiment,
  pendingAction,
  hasActiveEvalContract,
}: {
  experiment: Experiment;
  pendingAction?: EvalSetupPendingAction;
  hasActiveEvalContract: boolean;
}): WorkflowPageItem[] {
  const evaluation = experiment.evaluation;

  return [
    {
      id: "setup",
      label: "Setup",
      detail: evaluationStatusLabel(evaluation.status),
    },
    {
      id: "interview",
      label: "Setup Interview",
      detail: evaluation.evalSetupThreadId ? "Thread active" : "Not started",
      badge: pendingAction ? (
        <span className="rounded-full bg-blue-100 px-1.5 text-[11px] font-medium text-blue-700">
          Working
        </span>
      ) : undefined,
    },
    {
      id: "contract",
      label: "Eval Contract",
      detail: hasActiveEvalContract ? "Configured" : "Not set",
    },
    {
      id: "run-settings",
      label: "Run Settings",
      detail: `${experiment.trialCount} trials`,
    },
    {
      id: "behavior",
      label: "Contract Behavior",
      detail: "Execution rules",
    },
  ];
}
