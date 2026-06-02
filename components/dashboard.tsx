"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  approveGeneratedEvaluation as approveGeneratedEvaluationAction,
  saveExperiments,
  sendEvalSetupReply as sendEvalSetupReplyAction,
  startExperiment as startExperimentAction,
  startEvalInterview as startEvalInterviewAction,
} from "@/app/actions";
import ExperimentCard from "@/components/experiment-card";
import type { Experiment, ExperimentEvaluation } from "@/lib/experiments";
import {
  Avatar,
  CheckIcon,
  DocsIcon,
  FlaskIcon,
  PlusIcon,
  RepoIcon,
  SettingsIcon,
  SupportIcon,
  UserGlyph,
} from "@/components/icons";
import { CreateModal, DeleteModal } from "@/components/dashboard/modals";
import { ExperimentDetail } from "@/components/dashboard/experiment-detail";
import type {
  EvalSetupPendingAction,
  NavId,
  TabId,
} from "@/components/dashboard/types";
import { getEvalSetupContract } from "@/components/dashboard/evaluation-utils";
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

const PRIMARY_NAV = [
  { id: "experiments", label: "Experiments", Icon: FlaskIcon },
  { id: "repositories", label: "Repositories", Icon: RepoIcon },
  { id: "settings", label: "Settings", Icon: SettingsIcon },
] as const;

const BOTTOM_NAV = [
  { id: "docs", label: "Docs", Icon: DocsIcon },
  { id: "support", label: "Support", Icon: SupportIcon },
] as const;

const TABS: { id: TabId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "setup", label: "Setup" },
  { id: "running", label: "Running" },
  { id: "needs-input", label: "Needs input" },
  { id: "completed", label: "Completed" },
  { id: "failed", label: "Failed" },
];

function Placeholder({
  label,
  Icon,
}: {
  label: string;
  Icon: (props: { className?: string }) => ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 py-24 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400">
        <Icon className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-zinc-900">{label}</h2>
      <p className="mt-1 max-w-xs text-sm text-zinc-500">
        This area is a front-end demo — no backend is wired up yet.
      </p>
    </div>
  );
}

export default function Dashboard({
  initialExperiments,
}: {
  initialExperiments: Experiment[];
}) {
  const [items, setItems] = useState<Experiment[]>(initialExperiments);
  const [tab, setTab] = useState<TabId>("all");
  const [nav, setNav] = useState<NavId>("experiments");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteFor, setDeleteFor] = useState<Experiment | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [evalSetupPending, setEvalSetupPending] = useState<{
    experimentId: string;
    action: EvalSetupPendingAction;
  } | null>(null);
  const [runPendingId, setRunPendingId] = useState<string | null>(null);
  const didMountRef = useRef(false);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(
      () => setToast((current) => (current === message ? null : current)),
      2600,
    );
  }, []);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    const snapshot = items;
    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(() => saveExperiments(snapshot))
      .catch(() => notify("Could not save experiments"));
  }, [items, notify]);

  const needsInputCount = items.filter((e) => e.status === "needs-input").length;
  const visible = tab === "all" ? items : items.filter((e) => e.status === tab);
  const selected = items.find((experiment) => experiment.id === selectedId);
  const selectedEvalSetupPendingAction =
    selected && evalSetupPending?.experimentId === selected.id
      ? evalSetupPending.action
      : undefined;

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
    notify("Answered - " + experiment.title + " resumed");
  };

  const handleDelete = (experiment: Experiment) => {
    setItems((prev) => prev.filter((e) => e.id !== experiment.id));
    setSelectedId((current) => (current === experiment.id ? null : current));
    setDeleteFor(null);
    notify('Deleted "' + experiment.title + '"');
  };

  return (
    <div className="flex h-screen bg-white text-zinc-900">
      {/* Sidebar */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50/60">
        <div className="flex items-center gap-3 px-5 py-5">
          <Avatar size={38} hue={222}>
            <UserGlyph className="h-5 w-5 text-white" />
          </Avatar>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-zinc-900">Optimizer Lab</p>
            <p className="text-xs text-zinc-500">AI Research Studio</p>
          </div>
        </div>

        <nav className="mt-4 flex-1 px-3">
          <ul className="space-y-0.5">
            {PRIMARY_NAV.map(({ id, label, Icon }) => {
              const active = nav === id;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => setNav(id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                      active
                        ? "bg-blue-50 font-medium text-blue-700"
                        : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                    {label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="px-3 pb-5">
          <div className="mb-2 h-px bg-zinc-200" />
          <ul className="space-y-0.5">
            {BOTTOM_NAV.map(({ id, label, Icon }) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => notify(`${label} is a demo placeholder`)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                >
                  <Icon className="h-[18px] w-[18px]" />
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Main */}
      <main className="relative flex flex-1 flex-col overflow-hidden">
        {nav === "experiments" ? (
          <div className="mx-auto w-full max-w-5xl overflow-y-auto px-8 py-8">
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                Experiments
              </h1>
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-800 active:scale-[0.99]"
              >
                <PlusIcon className="h-4 w-4" />
                New Experiment
              </button>
            </div>

            <div className="mt-5 flex items-center gap-6 border-b border-zinc-200">
              {TABS.map((t) => {
                const active = tab === t.id;
                const count =
                  t.id === "setup"
                    ? items.filter((experiment) => experiment.status === "setup")
                        .length
                    : t.id === "needs-input"
                      ? needsInputCount
                      : 0;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`-mb-px flex items-center gap-2 border-b-2 pb-3 text-sm transition-colors ${
                      active
                        ? "border-blue-700 font-medium text-blue-700"
                        : "border-transparent text-zinc-500 hover:text-zinc-800"
                    }`}
                  >
                    {t.label}
                    {count > 0 && (
                      <span className="rounded-full bg-zinc-200 px-1.5 text-xs font-medium text-zinc-600">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {visible.length === 0 ? (
              <div className="py-24 text-center text-sm text-zinc-400">
                No experiments in this view.
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-1 items-stretch gap-5 lg:grid-cols-2">
                {visible.map((experiment, i) => (
                  <div
                    key={experiment.id}
                    className="h-full animate-slide-up"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <ExperimentCard
                      experiment={experiment}
                      onDelete={setDeleteFor}
                      onOpen={(next) => setSelectedId(next.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <Placeholder
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
          onNotify={notify}
          startPending={runPendingId === selected.id}
        />
      )}

      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />
      )}
      {deleteFor && (
        <DeleteModal
          experiment={deleteFor}
          onClose={() => setDeleteFor(null)}
          onConfirm={handleDelete}
        />
      )}

      {toast && (
        <div className="fixed bottom-5 right-5 z-[60] flex animate-slide-up items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm text-white shadow-lg">
          <CheckIcon className="h-4 w-4 text-emerald-400" />
          {toast}
        </div>
      )}
    </div>
  );
}
