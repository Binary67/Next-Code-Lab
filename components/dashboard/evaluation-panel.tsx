import { useState, type ReactNode } from "react";
import type {
  EvaluationMode,
  ExperimentEvaluation,
} from "@/lib/experiments";
import { WorkflowPageLayout } from "./shared";
import { EvaluationContractPage } from "./evaluation/evaluation-contract-page";
import { EvaluationInterviewPage } from "./evaluation/evaluation-interview-page";
import { EvaluationRunSettingsPage } from "./evaluation/evaluation-run-settings-page";
import { EvaluationRunbookPage } from "./evaluation/evaluation-runbook-page";
import { EvaluationSetupPage } from "./evaluation/evaluation-setup-page";
import {
  defaultEvaluationPage,
  getEvaluationPages,
} from "./evaluation/page-config";
import type {
  EvaluationPageId,
  EvaluationPanelProps,
  EvaluationRunSettingField,
} from "./evaluation/types";

export function EvaluationPanel({
  experiment,
  pendingAction,
  onChange,
  onChangeRunSettings,
  onStartInterview,
  onSendSetupReply,
  onApproveGenerated,
}: EvaluationPanelProps) {
  const [reply, setReply] = useState("");
  const [pageSelection, setPageSelection] = useState<{
    experimentId: string;
    page: EvaluationPageId;
  }>(() => ({
    experimentId: experiment.id,
    page: defaultEvaluationPage(experiment.evaluation),
  }));
  const evaluation = experiment.evaluation;
  const activePage =
    pageSelection.experimentId === experiment.id
      ? pageSelection.page
      : defaultEvaluationPage(evaluation);
  const isEvalSetupPending = Boolean(pendingAction);
  const canUseSetupChat =
    !evaluation.generatedScriptApproved && !isEvalSetupPending;
  const isReady = evaluation.status === "ready";
  const hasActiveEvalContract = evaluation.mode === "existing" || isReady;
  const canEditRunSettings = experiment.status === "setup";
  const pages = getEvaluationPages({
    experiment,
    pendingAction,
    hasActiveEvalContract,
  });

  const submitReply = (text: string) => {
    if (!canUseSetupChat) return;

    const trimmed = text.trim();
    if (!trimmed) return;

    onSendSetupReply(experiment, trimmed);
    setReply("");
  };

  const setEvaluationPage = (page: EvaluationPageId) => {
    setPageSelection({ experimentId: experiment.id, page });
  };
  const startInterview = () => {
    setEvaluationPage("interview");
    onStartInterview(experiment);
  };
  const updateEvaluation = (patch: Partial<ExperimentEvaluation>) => {
    onChange(experiment, patch);
  };
  const updateMode = (mode: EvaluationMode) => {
    updateEvaluation({ mode });
    setEvaluationPage(mode === "generated" ? "interview" : "setup");
  };
  const updateRunSetting = (
    field: EvaluationRunSettingField,
    value: string,
  ) => {
    const parsed = Number.parseInt(value, 10);
    const next = Number.isFinite(parsed) ? Math.max(1, parsed) : 1;

    onChangeRunSettings(experiment, { [field]: next });
  };

  const pageContent: Record<EvaluationPageId, ReactNode> = {
    setup: (
      <EvaluationSetupPage
        evaluation={evaluation}
        pendingAction={pendingAction}
        isEvalSetupPending={isEvalSetupPending}
        isReady={isReady}
        onChange={updateEvaluation}
        onModeChange={updateMode}
        onStartInterview={startInterview}
        onPageChange={setEvaluationPage}
      />
    ),
    interview: (
      <EvaluationInterviewPage
        evaluation={evaluation}
        pendingAction={pendingAction}
        reply={reply}
        canUseSetupChat={canUseSetupChat}
        isEvalSetupPending={isEvalSetupPending}
        onReplyChange={setReply}
        onStartInterview={startInterview}
        onSubmitReply={submitReply}
      />
    ),
    contract: (
      <EvaluationContractPage
        evaluation={evaluation}
        pendingAction={pendingAction}
        isEvalSetupPending={isEvalSetupPending}
        hasActiveEvalContract={hasActiveEvalContract}
        onApproveGenerated={() => onApproveGenerated(experiment)}
      />
    ),
    "run-settings": (
      <EvaluationRunSettingsPage
        experiment={experiment}
        canEditRunSettings={canEditRunSettings}
        onUpdateRunSetting={updateRunSetting}
      />
    ),
    runbook: <EvaluationRunbookPage runbook={experiment.runbook} />,
  };

  return (
    <WorkflowPageLayout
      pages={pages}
      activePage={activePage}
      onPageChange={(pageId) => setEvaluationPage(pageId as EvaluationPageId)}
      ariaLabel="Evaluation pages"
    >
      {pageContent[activePage]}
    </WorkflowPageLayout>
  );
}
