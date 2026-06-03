import type {
  Experiment,
  ExperimentEvaluation,
} from "@/lib/experiments";
import type { EvalSetupPendingAction } from "../types";

export type EvaluationPageId =
  | "setup"
  | "interview"
  | "contract"
  | "run-settings"
  | "behavior";

export type EvaluationPanelProps = {
  experiment: Experiment;
  pendingAction?: EvalSetupPendingAction;
  onChange: (
    experiment: Experiment,
    patch: Partial<ExperimentEvaluation>,
  ) => void;
  onChangeRunSettings: (
    experiment: Experiment,
    patch: Partial<Pick<Experiment, "trialCount" | "evalBudgetPerTrial">>,
  ) => void;
  onStartInterview: (experiment: Experiment) => void;
  onSendSetupReply: (experiment: Experiment, text: string) => void;
  onApproveGenerated: (experiment: Experiment) => void;
};

export type EvaluationPatchHandler = (
  patch: Partial<ExperimentEvaluation>,
) => void;

export type EvaluationPageChangeHandler = (page: EvaluationPageId) => void;

export type EvaluationRunSettingField =
  | "trialCount"
  | "evalBudgetPerTrial";

export type EvaluationRunSettingChangeHandler = (
  field: EvaluationRunSettingField,
  value: string,
) => void;
