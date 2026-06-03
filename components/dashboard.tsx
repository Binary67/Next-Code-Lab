"use client";

import { useState } from "react";
import {
  approveGeneratedEvaluation as approveGeneratedEvaluationAction,
  deleteExperiment as deleteExperimentAction,
  sendEvalSetupReply as sendEvalSetupReplyAction,
  startExperiment as startExperimentAction,
  startEvalInterview as startEvalInterviewAction,
} from "@/app/actions";
import type { Experiment, ExperimentEvaluation } from "@/lib/experiments";
import { RepoIcon, SettingsIcon } from "@/components/icons";
import { DashboardPlaceholder } from "@/components/dashboard/dashboard-placeholder";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { ExperimentList } from "@/components/dashboard/experiment-list";
import { CreateModal, DeleteModal } from "@/components/dashboard/modals";
import { ExperimentDetail } from "@/components/dashboard/experiment-detail";
import { Toast } from "@/components/dashboard/toast";
import type {
  EvalSetupPendingAction,
  NavId,
  TabId,
} from "@/components/dashboard/types";
import { getEvalSetupContract } from "@/components/dashboard/evaluation-utils";
import { useDashboardToast } from "@/components/dashboard/use-dashboard-toast";
import { useExperimentSync } from "@/components/dashboard/use-experiment-sync";
import {
  addRuntimeReply,
  answerPendingQuestion,
  applyEvalSetupReply,
  applyEvalSetupStarted,
  applyGeneratedEvaluationApproval,
  approveExperiment,
  createExperimentFromDraft,
  updateExperimentRunSettings,
  updateExperimentEvaluation,
  type ExperimentDraft,
} from "@/components/dashboard/state-transitions";

export default function Dashboard({
  initialExperiments,
}: {
  initialExperiments: Experiment[];
}) {
  const [tab, setTab] = useState<TabId>("all");
  const [nav, setNav] = useState<NavId>("experiments");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteFor, setDeleteFor] = useState<Experiment | null>(null);
  const [evalSetupPending, setEvalSetupPending] = useState<{
    experimentId: string;
    action: EvalSetupPendingAction;
  } | null>(null);
  const [runPendingId, setRunPendingId] = useState<string | null>(null);
  const [pausedRunIds, setPausedRunIds] = useState<Set<string>>(
    () => new Set(),
  );
  const { toast, notify } = useDashboardToast();
  const { items, setItems } = useExperimentSync({
    initialExperiments,
    runPendingId,
    notify,
  });
  const selected = items.find((experiment) => experiment.id === selectedId);
  const selectedEvalSetupPendingAction =
    selected && evalSetupPending?.experimentId === selected.id
      ? evalSetupPending.action
      : undefined;
  const selectedRunPaused =
    selected?.status === "running" && pausedRunIds.has(selected.id);

  const clearPausedRun = (experimentId: string) => {
    setPausedRunIds((current) => {
      if (!current.has(experimentId)) return current;
      const next = new Set(current);
      next.delete(experimentId);
      return next;
    });
  };

  const handleCreate = (draft: ExperimentDraft) => {
    const experiment = createExperimentFromDraft(draft);
    setItems((prev) => [experiment, ...prev]);
    setTab("all");
    setNav("experiments");
    setSelectedId(experiment.id);
    setShowCreate(false);
    notify('Created "' + experiment.title + '"');
  };

  const handleUpdateEvaluation = (
    experiment: Experiment,
    patch: Partial<ExperimentEvaluation>,
  ) => {
    setItems((prev) =>
      prev.map((e) =>
        e.id === experiment.id ? updateExperimentEvaluation(e, patch) : e,
      ),
    );
  };

  const handleStartEvalInterview = async (experiment: Experiment) => {
    if (evalSetupPending) {
      notify("Codex is already working");
      return;
    }

    setEvalSetupPending({ experimentId: experiment.id, action: "start" });
    notify("Starting eval setup interview...");
    try {
      const result = await startEvalInterviewAction({
        experimentId: experiment.id,
        repoPath: experiment.repo,
        title: experiment.title,
        objective: experiment.objective,
      });

      if (!result.ok) {
        notify(result.error);
        return;
      }

      const { evalSetupThreadId, response } = result.data;
      setItems((prev) =>
        prev.map((e) =>
          e.id === experiment.id
            ? applyEvalSetupStarted(e, evalSetupThreadId, response)
            : e,
        ),
      );
      notify(
        response.status === "ready"
          ? "Eval contract proposed"
          : "Eval setup interview started",
      );
    } finally {
      setEvalSetupPending((current) =>
        current?.experimentId === experiment.id && current.action === "start"
          ? null
          : current,
      );
    }
  };

  const handleEvalSetupReply = async (experiment: Experiment, text: string) => {
    if (evalSetupPending) {
      notify("Codex is already working");
      return;
    }

    const threadId = experiment.evaluation.evalSetupThreadId;

    if (!threadId) {
      notify("Start the eval setup interview first");
      return;
    }

    setEvalSetupPending({ experimentId: experiment.id, action: "reply" });
    notify("Sending eval setup reply...");
    try {
      const result = await sendEvalSetupReplyAction({
        experimentId: experiment.id,
        threadId,
        repoPath: experiment.repo,
        reply: text,
      });

      if (!result.ok) {
        notify(result.error);
        return;
      }

      const { response } = result.data;
      setItems((prev) =>
        prev.map((e) =>
          e.id === experiment.id ? applyEvalSetupReply(e, text, response) : e,
        ),
      );
      notify(
        response.status === "ready" ? "Eval contract proposed" : "Reply sent",
      );
    } finally {
      setEvalSetupPending((current) =>
        current?.experimentId === experiment.id && current.action === "reply"
          ? null
          : current,
      );
    }
  };

  const handleApproveGeneratedEvaluation = async (experiment: Experiment) => {
    if (evalSetupPending) {
      notify("Codex is already working");
      return;
    }

    if (!experiment.evaluation.evalSetupThreadId) {
      notify("Start the eval setup interview first");
      return;
    }

    if (!experiment.evaluation.proposedContract) {
      notify("Wait for the setup agent to propose an eval contract");
      return;
    }

    setEvalSetupPending({ experimentId: experiment.id, action: "approve" });
    notify("Writing generated eval...");
    try {
      const result = await approveGeneratedEvaluationAction({
        experimentId: experiment.id,
        threadId: experiment.evaluation.evalSetupThreadId,
        repoPath: experiment.repo,
        proposedContract: experiment.evaluation.proposedContract,
      });

      if (!result.ok) {
        notify(result.error);
        return;
      }

      const { response } = result.data;
      const contract = getEvalSetupContract(response);

      if (!contract) {
        notify("Codex did not return a generated eval contract");
        return;
      }

      setItems((prev) =>
        prev.map((e) =>
          e.id === experiment.id
            ? applyGeneratedEvaluationApproval(e, response, contract)
            : e,
        ),
      );
      notify("Generated eval approved");
    } finally {
      setEvalSetupPending((current) =>
        current?.experimentId === experiment.id && current.action === "approve"
          ? null
          : current,
      );
    }
  };

  const handleUpdateRunSettings = (
    experiment: Experiment,
    patch: Partial<Pick<Experiment, "trialCount" | "evalBudgetPerTrial">>,
  ) => {
    setItems((prev) =>
      prev.map((e) =>
        e.id === experiment.id ? updateExperimentRunSettings(e, patch) : e,
      ),
    );
  };

  const handleStartExperiment = async (experiment: Experiment) => {
    if (runPendingId) {
      notify("An experiment run is already starting");
      return;
    }

    if (experiment.evaluation.status !== "ready") {
      notify("Complete evaluation setup before starting");
      return;
    }

    clearPausedRun(experiment.id);
    setRunPendingId(experiment.id);
    notify('Starting "' + experiment.title + '"');

    try {
      const result = await startExperimentAction({ experiment });

      if (!result.ok) {
        notify(result.error);
        return;
      }

      setItems((prev) =>
        prev.map((e) => (e.id === experiment.id ? result.data : e)),
      );
      notify('Completed "' + experiment.title + '"');
    } finally {
      setRunPendingId((current) =>
        current === experiment.id ? null : current,
      );
    }
  };

  const handleApprove = (experiment: Experiment) => {
    setItems((prev) =>
      prev.map((e) => (e.id === experiment.id ? approveExperiment(e) : e)),
    );
    clearPausedRun(experiment.id);
    notify("Approved - " + experiment.title + " resumed");
  };

  const handleReply = (experiment: Experiment, text: string) => {
    setItems((prev) =>
      prev.map((e) => (e.id === experiment.id ? addRuntimeReply(e, text) : e)),
    );
    notify("Reply sent");
  };

  const handleAnswer = (experiment: Experiment, answer: string) => {
    setItems((prev) =>
      prev.map((e) =>
        e.id === experiment.id ? answerPendingQuestion(e, answer) : e,
      ),
    );
    clearPausedRun(experiment.id);
    notify("Answered - " + experiment.title + " resumed");
  };

  const handlePause = (experiment: Experiment) => {
    setPausedRunIds((current) => {
      const next = new Set(current);
      next.add(experiment.id);
      return next;
    });
    notify(experiment.title + " paused");
  };

  const handleResume = (experiment: Experiment) => {
    clearPausedRun(experiment.id);
    notify(experiment.title + " resumed");
  };

  const handleStop = (experiment: Experiment) => {
    notify(experiment.title + " stopped");
  };

  const handleDelete = async (experiment: Experiment) => {
    const remainingExperiments = items.filter((e) => e.id !== experiment.id);
    const result = await deleteExperimentAction({
      experiment,
      remainingExperiments,
    });

    if (!result.ok) {
      notify(result.error);
      return;
    }

    setItems(remainingExperiments);
    setSelectedId((current) => (current === experiment.id ? null : current));
    setDeleteFor(null);
    notify('Deleted "' + experiment.title + '"');
  };

  return (
    <div className="flex h-screen bg-white text-zinc-900">
      <DashboardSidebar
        activeNav={nav}
        onNavChange={setNav}
        onPlaceholderClick={(label) =>
          notify(`${label} is a demo placeholder`)
        }
      />

      <main className="relative flex flex-1 flex-col overflow-hidden">
        {nav === "experiments" ? (
          <ExperimentList
            experiments={items}
            activeTab={tab}
            onTabChange={setTab}
            onCreate={() => setShowCreate(true)}
            onDelete={setDeleteFor}
            onOpen={(next) => setSelectedId(next.id)}
          />
        ) : (
          <DashboardPlaceholder
            label={nav === "repositories" ? "Repositories" : "Settings"}
            Icon={nav === "repositories" ? RepoIcon : SettingsIcon}
          />
        )}
      </main>

      {nav === "experiments" && selected && (
        <ExperimentDetail
          key={selected.id}
          experiment={selected}
          evalSetupPendingAction={selectedEvalSetupPendingAction}
          onBack={() => setSelectedId(null)}
          onStart={handleStartExperiment}
          onApprove={handleApprove}
          onAnswer={handleAnswer}
          onSendReply={handleReply}
          onUpdateEvaluation={handleUpdateEvaluation}
          onUpdateRunSettings={handleUpdateRunSettings}
          onStartEvalInterview={handleStartEvalInterview}
          onSendEvalSetupReply={handleEvalSetupReply}
          onApproveGeneratedEvaluation={handleApproveGeneratedEvaluation}
          isRunPaused={selectedRunPaused}
          onPause={handlePause}
          onResume={handleResume}
          onStop={handleStop}
          startPending={runPendingId === selected.id}
        />
      )}

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}
      {deleteFor && (
        <DeleteModal
          experiment={deleteFor}
          onClose={() => setDeleteFor(null)}
          onConfirm={handleDelete}
        />
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}
