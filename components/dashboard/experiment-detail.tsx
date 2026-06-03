import { useEffect, useState } from "react";
import type {
  EvaluationStatus,
  Experiment,
  ExperimentEvaluation,
  ExperimentTrial,
} from "@/lib/experiments";
import {
  ArrowRightIcon,
  CloseIcon,
  PauseIcon,
  WarningIcon,
} from "@/components/icons";
import type { DetailTabId, EvalSetupPendingAction } from "./types";
import { EvaluationPanel } from "./evaluation-panel";
import { OverviewPanel } from "./overview-panel";
import { AgentCollab } from "./agent-collab";
import { ChangesPanel } from "./changes-panel";
import { RunPanel } from "./run-panel";
import { STATUS_TONE, statusLabel } from "./shared";
import { evaluationStatusLabel } from "./evaluation-utils";

const DETAIL_TABS: { id: DetailTabId; label: string }[] = [
  { id: "evaluation", label: "Evaluation" },
  { id: "overview", label: "Overview" },
  { id: "run", label: "Run" },
  { id: "collab", label: "Agent Collab" },
  { id: "changes", label: "Changes" },
];

function formatTokenUnit(value: number) {
  const rounded = Number(value.toFixed(1));
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatTokenCount(value: number) {
  if (value >= 1_000_000) {
    return `${formatTokenUnit(value / 1_000_000)}M`;
  }

  if (value >= 1_000) {
    return `${formatTokenUnit(value / 1_000)}k`;
  }

  return String(value);
}

function experimentTokenUsage(experiment: Experiment) {
  return experiment.trials.reduce(
    (total, trial) => ({
      inputTokens: total.inputTokens + (trial.tokenUsage?.inputTokens ?? 0),
      cachedInputTokens:
        total.cachedInputTokens + (trial.tokenUsage?.cachedInputTokens ?? 0),
      outputTokens: total.outputTokens + (trial.tokenUsage?.outputTokens ?? 0),
    }),
    { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 },
  );
}

type DetailStatusChip = {
  label: string;
  value: string;
  tone?: "default" | "info" | "success" | "warning" | "danger";
};

const DETAIL_STATUS_TONE: Record<NonNullable<DetailStatusChip["tone"]>, string> =
  {
    default: "bg-white/75 text-zinc-700 ring-zinc-200/80",
    info: "bg-blue-50 text-blue-700 ring-blue-200/80",
    success: "bg-emerald-50 text-emerald-700 ring-emerald-200/80",
    warning: "bg-amber-50 text-amber-700 ring-amber-200/80",
    danger: "bg-rose-50 text-rose-700 ring-rose-200/80",
  };

function pluralize(value: number, singular: string) {
  return `${value} ${singular}${value === 1 ? "" : "s"}`;
}

function trialProgress(experiment: Experiment) {
  const completed = experiment.trials.filter(
    (trial) => trial.status !== "running",
  ).length;

  return `${completed}/${experiment.trialCount} trials`;
}

function latestTrialValue(trial: ExperimentTrial) {
  if (trial.metricValue && trial.metricValue !== "pending") {
    return `${trial.id} / ${trial.metricValue}`;
  }

  return trial.id;
}

function DetailStatusStrip({ experiment }: { experiment: Experiment }) {
  const latestTrial: ExperimentTrial | undefined = experiment.trials[0];
  const evaluation = experiment.evaluation;
  const tokenUsage = experimentTokenUsage(experiment);
  const tokenTotal = tokenUsage.inputTokens + tokenUsage.outputTokens;
  const tokenChip: DetailStatusChip | undefined =
    tokenTotal > 0
      ? { label: "Tokens", value: formatTokenCount(tokenTotal) }
      : undefined;
  const items: DetailStatusChip[] = [];

  if (experiment.status === "setup") {
    items.push(
      {
        label: "Evaluation",
        value: evaluationStatusLabel(evaluation.status),
        tone: evaluation.status === "ready" ? "success" : "warning",
      },
      { label: "Trials", value: pluralize(experiment.trialCount, "trial") },
      {
        label: "Eval budget",
        value: `${pluralize(experiment.evalBudgetPerTrial, "eval")}/trial`,
      },
    );
  }

  if (experiment.status === "running") {
    items.push(
      {
        label: experiment.metricLabel.replace(/^Current\s+/i, "") || "Score",
        value: experiment.metricValue,
        tone: "info",
      },
    );

    if (experiment.targetValue && experiment.targetValue !== "Not set") {
      items.push({ label: "Baseline", value: experiment.targetValue });
    }

    items.push({ label: "Trials", value: trialProgress(experiment) });
    if (tokenChip) items.push(tokenChip);
  }

  if (experiment.status === "needs-input") {
    items.push({ label: "Input", value: "Required", tone: "warning" });
    if (latestTrial) {
      items.push({ label: "Latest", value: latestTrialValue(latestTrial) });
    }
    items.push({ label: "Trials", value: trialProgress(experiment) });
  }

  if (experiment.status === "completed") {
    items.push({
      label: experiment.metricValue === "no improvement" ? "Result" : "Best",
      value:
        experiment.metricValue === "no improvement"
          ? "No improvement"
          : experiment.metricValue,
      tone: experiment.metricValue === "no improvement" ? "default" : "success",
    });
    items.push({ label: "Trials", value: trialProgress(experiment) });
    if (tokenChip) items.push(tokenChip);
  }

  if (experiment.status === "failed") {
    items.push({
      label: "Failed",
      value: experiment.timing ?? "Failed",
      tone: "danger",
    });
    if (latestTrial) {
      items.push({ label: "Latest", value: latestTrialValue(latestTrial) });
    }
    if (experiment.trials.length > 0) {
      items.push({ label: "Trials", value: trialProgress(experiment) });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((item) => (
        <span
          key={item.label}
          aria-label={`${item.label}: ${item.value}`}
          className={`inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
            DETAIL_STATUS_TONE[item.tone ?? "default"]
          }`}
        >
          <span className="shrink-0 opacity-70">
            {item.label}
          </span>
          <span className="min-w-0 truncate font-semibold">
            {item.value}
          </span>
        </span>
      ))}
    </div>
  );
}

function DetailTabs({
  active,
  needsInput,
  evaluationStatus,
  onChange,
}: {
  active: DetailTabId;
  needsInput: boolean;
  evaluationStatus: EvaluationStatus;
  onChange: (tab: DetailTabId) => void;
}) {
  return (
    <nav className="flex min-w-0 shrink-0 gap-5 overflow-x-auto border-y border-zinc-200/80 bg-white/70 px-5 scrollbar-hidden md:px-6">
      {DETAIL_TABS.map((tab) => {
        const selected = active === tab.id;
        const showInput = tab.id === "collab" && needsInput;
        const showEvaluation = tab.id === "evaluation";
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 py-3 text-sm transition-colors ${
              selected
                ? "border-blue-700 font-medium text-blue-700"
                : "border-transparent text-zinc-500 hover:text-zinc-900"
            }`}
          >
            {tab.label}
            {showInput && (
              <span className="rounded-full bg-amber-100 px-1.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200/80">
                Input
              </span>
            )}
            {showEvaluation && (
              <span
                className={`rounded-full px-1.5 text-[11px] font-medium ring-1 ${
                  evaluationStatus === "ready"
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200/80"
                    : "bg-amber-50 text-amber-700 ring-amber-200/80"
                }`}
              >
                {evaluationStatusLabel(evaluationStatus)}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

function PendingInputBanner({
  experiment,
  onAnswer,
  onOpenCollab,
}: {
  experiment: Experiment;
  onAnswer: (experiment: Experiment, answer: string) => void;
  onOpenCollab: () => void;
}) {
  if (!experiment.pendingQuestion || experiment.status !== "needs-input") {
    return null;
  }

  return (
    <section className="mb-4 rounded-2xl bg-amber-50/85 p-4 ring-1 ring-amber-200/80">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700">
            <WarningIcon className="h-3.5 w-3.5" />
            {experiment.pendingQuestion.title}
          </p>
          <p className="mt-2 text-sm font-medium leading-relaxed text-zinc-900">
            {experiment.pendingQuestion.body}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          {experiment.pendingQuestion.options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onAnswer(experiment, option)}
              className="rounded-xl bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 ring-1 ring-zinc-950/5 transition-colors hover:text-blue-700"
            >
              {option}
            </button>
          ))}
          <button
            type="button"
            onClick={onOpenCollab}
            className="rounded-xl px-3 py-1.5 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-100"
          >
            Open Collab
          </button>
        </div>
      </div>
    </section>
  );
}
export function ExperimentDetail({
  experiment,
  evalSetupPendingAction,
  onBack,
  onStart,
  onApprove,
  onAnswer,
  onSendReply,
  onUpdateEvaluation,
  onUpdateRunSettings,
  onStartEvalInterview,
  onSendEvalSetupReply,
  onApproveGeneratedEvaluation,
  isRunPaused,
  onPause,
  onResume,
  onStop,
  startPending,
}: {
  experiment: Experiment;
  evalSetupPendingAction?: EvalSetupPendingAction;
  onBack: () => void;
  onStart: (experiment: Experiment) => void;
  onApprove: (experiment: Experiment) => void;
  onAnswer: (experiment: Experiment, answer: string) => void;
  onSendReply: (experiment: Experiment, text: string) => void;
  onUpdateEvaluation: (
    experiment: Experiment,
    patch: Partial<ExperimentEvaluation>,
  ) => void;
  onUpdateRunSettings: (
    experiment: Experiment,
    patch: Partial<Pick<Experiment, "trialCount" | "evalBudgetPerTrial">>,
  ) => void;
  onStartEvalInterview: (experiment: Experiment) => void;
  onSendEvalSetupReply: (experiment: Experiment, text: string) => void;
  onApproveGeneratedEvaluation: (experiment: Experiment) => void;
  isRunPaused: boolean;
  onPause: (experiment: Experiment) => void;
  onResume: (experiment: Experiment) => void;
  onStop: (experiment: Experiment) => void;
  startPending?: boolean;
}) {
  const [detailTab, setDetailTab] = useState<DetailTabId>(
    experiment.status === "setup" ? "evaluation" : "overview",
  );
  const metricName = experiment.metricLabel.replace(/^Current\s+/i, "");
  const canApprove = experiment.status === "needs-input";
  const needsInput = canApprove && Boolean(experiment.pendingQuestion);
  const canStart =
    experiment.status === "setup" &&
    experiment.evaluation.status === "ready" &&
    !startPending;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onBack();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onBack]);

  const activePanel = (() => {
    switch (detailTab) {
      case "evaluation":
        return (
          <EvaluationPanel
            experiment={experiment}
            pendingAction={evalSetupPendingAction}
            onChange={onUpdateEvaluation}
            onChangeRunSettings={onUpdateRunSettings}
            onStartInterview={onStartEvalInterview}
            onSendSetupReply={onSendEvalSetupReply}
            onApproveGenerated={onApproveGeneratedEvaluation}
          />
        );
      case "run":
        return <RunPanel experiment={experiment} metricName={metricName} />;
      case "collab":
        return (
          <AgentCollab
            experiment={experiment}
            onAnswer={onAnswer}
            onSendReply={onSendReply}
          />
        );
      case "changes":
        return <ChangesPanel experiment={experiment} />;
      case "overview":
      default:
        return (
          <OverviewPanel
            experiment={experiment}
            metricName={metricName}
          />
        );
    }
  })();

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4 py-5 md:left-64 md:py-8">
      <button
        type="button"
        aria-label="Close experiment detail"
        onClick={onBack}
        className="absolute inset-0 animate-fade-in bg-zinc-950/10 backdrop-blur-[6px]"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="experiment-detail-title"
        className="relative z-10 flex h-[calc(100vh-2.5rem)] w-full max-w-[1760px] animate-scale-in flex-col overflow-hidden rounded-[28px] border border-white/70 bg-zinc-50/90 shadow-[0_24px_80px_rgba(15,23,42,0.18)] ring-1 ring-zinc-950/5 backdrop-blur-2xl md:h-[calc(100vh-4rem)]"
      >
        <header className="shrink-0 border-b border-zinc-200/80 bg-white/80 px-5 py-4 md:px-6 md:py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900"
              >
                <ArrowRightIcon className="h-4 w-4 rotate-180" />
                Experiments
              </button>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-zinc-100/80 px-2 py-1 font-mono text-xs text-zinc-500 ring-1 ring-zinc-950/5">
                  {experiment.repo}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset ring-black/5 ${
                    STATUS_TONE[experiment.status]
                  }`}
                >
                  {statusLabel(experiment.status)}
                </span>
              </div>

              <h1
                id="experiment-detail-title"
                className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950"
              >
                {experiment.title}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
                {experiment.objective}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {experiment.status === "setup" ? (
                <button
                  type="button"
                  onClick={() => onStart(experiment)}
                  disabled={!canStart}
                  title={
                    startPending
                      ? "Starting..."
                      : canStart
                      ? "Start experiment"
                      : "Complete evaluation setup first"
                  }
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {startPending ? "Starting..." : "Start experiment"}
                  <ArrowRightIcon className="h-4 w-4" />
                </button>
              ) : experiment.status === "running" ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      isRunPaused ? onResume(experiment) : onPause(experiment)
                    }
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
                  >
                    {isRunPaused ? (
                      <ArrowRightIcon className="h-4 w-4" />
                    ) : (
                      <PauseIcon className="h-4 w-4" />
                    )}
                    {isRunPaused ? "Resume" : "Pause"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onStop(experiment)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-50 px-3.5 py-2 text-sm font-medium text-rose-700 ring-1 ring-rose-200/70 transition-colors hover:bg-rose-100"
                  >
                    <CloseIcon className="h-4 w-4" />
                    Stop
                  </button>
                </>
              ) : needsInput ? (
                <button
                  type="button"
                  onClick={() => setDetailTab("collab")}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-amber-600"
                >
                  Answer input
                  <ArrowRightIcon className="h-4 w-4" />
                </button>
              ) : canApprove ? (
                <button
                  type="button"
                  onClick={() => onApprove(experiment)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
                >
                  Approve &amp; resume
                  <ArrowRightIcon className="h-4 w-4" />
                </button>
              ) : (
                <div className="rounded-2xl bg-zinc-100/80 px-3 py-2 text-right ring-1 ring-zinc-950/5">
                  <p className="text-xs text-zinc-500">
                    {experiment.metricLabel}
                  </p>
                  <p className="text-sm font-semibold text-zinc-900">
                    {experiment.metricValue}
                  </p>
                </div>
              )}
              <button
                type="button"
                onClick={onBack}
                aria-label="Close"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100/80 text-zinc-500 ring-1 ring-zinc-950/5 transition-colors hover:bg-white hover:text-zinc-900"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-4">
            <DetailStatusStrip experiment={experiment} />
          </div>
        </header>

        <DetailTabs
          active={detailTab}
          needsInput={needsInput}
          evaluationStatus={experiment.evaluation.status}
          onChange={setDetailTab}
        />

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-zinc-100/70 px-5 py-4 md:px-6">
          {detailTab !== "collab" && (
            <PendingInputBanner
              experiment={experiment}
              onAnswer={onAnswer}
              onOpenCollab={() => setDetailTab("collab")}
            />
          )}

          <div className="min-h-0 w-full flex-1">{activePanel}</div>
        </div>
      </section>
    </div>
  );
}
