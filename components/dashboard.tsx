"use client";

import { useEffect, useState, type ReactNode } from "react";
import ExperimentCard from "@/components/experiment-card";
import {
  experiments as seed,
  type EvaluationMode,
  type EvaluationStatus,
  type Experiment,
  type ExperimentChange,
  type ExperimentEvaluation,
  type ExperimentMetric,
  type ExperimentTrial,
  type ProgressStep,
  type ScoreDirection,
  type Status,
  type TrendPoint,
} from "@/lib/experiments";
import {
  ArrowRightIcon,
  Avatar,
  CheckIcon,
  CloseIcon,
  DocsIcon,
  FlaskIcon,
  PauseIcon,
  PlusIcon,
  RepoIcon,
  SettingsIcon,
  SupportIcon,
  TrashIcon,
  UserGlyph,
  WarningIcon,
} from "@/components/icons";

type NavId = "experiments" | "repositories" | "settings";
type TabId = "all" | Status;
type DetailTabId =
  | "evaluation"
  | "overview"
  | "progress"
  | "collab"
  | "trials"
  | "changes";
type SourceType = "git" | "local";

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
];

const DETAIL_TABS: { id: DetailTabId; label: string }[] = [
  { id: "evaluation", label: "Evaluation" },
  { id: "overview", label: "Overview" },
  { id: "progress", label: "Progress" },
  { id: "collab", label: "Agent Collab" },
  { id: "trials", label: "Trials" },
  { id: "changes", label: "Changes" },
];

const inputClass =
  "w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

const SCORE_DIRECTIONS: {
  id: ScoreDirection;
  label: string;
  detail: string;
}[] = [
  { id: "minimize", label: "Minimize", detail: "Lower score is better" },
  { id: "maximize", label: "Maximize", detail: "Higher score is better" },
];

function getEvaluationStatus(
  evaluation: Pick<
    ExperimentEvaluation,
    "scriptPath" | "runCommand" | "scoreDirection"
  >,
): EvaluationStatus {
  const hasScript = Boolean(evaluation.scriptPath.trim());
  const hasCommand = Boolean(evaluation.runCommand.trim());
  const hasDirection = Boolean(evaluation.scoreDirection);

  if (hasScript && hasCommand && hasDirection) return "ready";
  if (hasScript || hasCommand || !hasDirection) return "incomplete";
  return "missing";
}

function getMissingEvaluationFields(evaluation: ExperimentEvaluation) {
  const missing = [];
  if (!evaluation.scriptPath.trim()) missing.push("eval script path");
  if (!evaluation.runCommand.trim()) missing.push("run command");
  if (!evaluation.scoreDirection) missing.push("score direction");
  return missing;
}

function normalizeEvaluation(
  evaluation: ExperimentEvaluation,
): ExperimentEvaluation {
  const next = {
    ...evaluation,
    scoreName: evaluation.scoreName.trim() || "score",
  };

  return {
    ...next,
    status: getEvaluationStatus(next),
  };
}

function evaluationStatusLabel(status: EvaluationStatus) {
  if (status === "ready") return "Ready";
  if (status === "incomplete") return "Incomplete";
  return "Needed";
}

function directionLabel(direction: ScoreDirection) {
  return direction === "minimize" ? "Minimize" : "Maximize";
}

function refreshEvaluationMetrics(
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
        detail: directionLabel(evaluation.scoreDirection),
      };
    }

    return metric;
  });
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function Overlay({
  onClose,
  className = "max-w-md",
  children,
}: {
  onClose: () => void;
  className?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 animate-fade-in bg-zinc-900/40 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full animate-scale-in rounded-2xl bg-white shadow-xl ring-1 ring-zinc-200 ${className}`}
      >
        {children}
      </div>
    </div>
  );
}

function CreateModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (draft: {
    repo: string;
    title: string;
    description: string;
  }) => void;
}) {
  const [sourceType, setSourceType] = useState<SourceType>("git");
  const [repo, setRepo] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const canCreate = Boolean(repo.trim() && title.trim());
  const sourceLabel = sourceType === "git" ? "Git repository" : "Local path";
  const sourcePlaceholder =
    sourceType === "git"
      ? "https://github.com/acme/frontend-monorepo.git"
      : "/Users/frank/Desktop/Projects/frontend-monorepo";

  return (
    <Overlay onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!canCreate) return;
          onCreate({ repo, title, description });
        }}
      >
        <header className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <h2 className="text-base font-semibold text-zinc-900">New Experiment</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-4 px-5 py-5">
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <label
                htmlFor="experiment-source"
                className="block text-sm font-medium text-zinc-700"
              >
                {sourceLabel}
              </label>
              <div className="relative inline-grid h-8 min-w-[164px] grid-cols-2 rounded-full bg-zinc-100 p-0.5 shadow-inner ring-1 ring-zinc-200/80">
                <span
                  aria-hidden="true"
                  className={`absolute top-0.5 bottom-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.10),0_1px_8px_rgba(0,0,0,0.06)] ring-1 ring-black/5 transition-transform duration-200 ease-out ${
                    sourceType === "local" ? "translate-x-full" : "translate-x-0"
                  }`}
                />
                {(["git", "local"] as SourceType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={sourceType === type}
                    onClick={() => setSourceType(type)}
                    className={`relative z-10 rounded-full px-3 text-[13px] font-medium transition-colors ${
                      sourceType === type
                        ? "text-zinc-900"
                        : "text-zinc-500 hover:text-zinc-700"
                    }`}
                  >
                    {type === "git" ? "Git repo" : "Local path"}
                  </button>
                ))}
              </div>
            </div>
            <input
              id="experiment-source"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder={sourcePlaceholder}
              required
              autoFocus
              className={`${inputClass} font-mono`}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
              Experiment title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Bundle Size Reduction"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
              Goal / context
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional context for the eval setup or optimization run."
              className={`${inputClass} resize-none`}
            />
          </div>
        </div>

        <footer className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3.5 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PlusIcon className="h-4 w-4" />
            Create experiment
          </button>
        </footer>
      </form>
    </Overlay>
  );
}

function DeleteModal({
  experiment,
  onClose,
  onConfirm,
}: {
  experiment: Experiment;
  onClose: () => void;
  onConfirm: (experiment: Experiment) => void;
}) {
  return (
    <Overlay onClose={onClose}>
      <header className="flex items-start gap-3 border-b border-zinc-100 px-5 py-4">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
          <TrashIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-zinc-900">
            Delete experiment?
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-zinc-500">
            Remove this experiment from the current demo session.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </header>

      <div className="px-5 py-4">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-3">
          <p className="truncate text-sm font-medium text-zinc-900">
            {experiment.title}
          </p>
          <p className="mt-1 font-mono text-xs text-zinc-500">
            {experiment.repo}
          </p>
        </div>
      </div>

      <footer className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-3.5 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onConfirm(experiment)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-rose-700"
        >
          <TrashIcon className="h-4 w-4" />
          Delete experiment
        </button>
      </footer>
    </Overlay>
  );
}

const STATUS_TONE: Record<Status, string> = {
  setup: "bg-zinc-100 text-zinc-700",
  running: "bg-blue-50 text-blue-700",
  "needs-input": "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  completed: "bg-emerald-50 text-emerald-700",
};

const TRIAL_TONE = {
  setup: "bg-zinc-100 text-zinc-600",
  completed: "bg-emerald-50 text-emerald-700",
  "needs-input": "bg-amber-50 text-amber-700",
  running: "bg-blue-50 text-blue-700",
} as const;

const PROGRESS_TONE: Record<ProgressStep["status"], string> = {
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200/70",
  active: "bg-blue-50 text-blue-700 ring-blue-200/70",
  queued: "bg-zinc-100 text-zinc-500 ring-zinc-200",
  blocked: "bg-amber-50 text-amber-700 ring-amber-200/80",
};

const CHANGE_TONE: Record<ExperimentChange["status"], string> = {
  applied: "bg-blue-50 text-blue-700 ring-blue-200/70",
  validated: "bg-emerald-50 text-emerald-700 ring-emerald-200/70",
  planned: "bg-zinc-100 text-zinc-500 ring-zinc-200",
};

function statusLabel(status: Status | ExperimentTrial["status"]) {
  if (status === "needs-input") return "Needs input";
  if (status === "setup") return "Setup";
  return status;
}

function MetricsList({ metrics }: { metrics: ExperimentMetric[] }) {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
        Metrics
      </h2>
      <div className="mt-3 divide-y divide-zinc-200/70 overflow-hidden rounded-2xl bg-white/55 ring-1 ring-zinc-950/5">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="text-xs font-medium text-zinc-500">
                {metric.label}
              </p>
              <p className="mt-0.5 truncate text-xs text-zinc-400">
                {metric.detail}
              </p>
            </div>
            <p className="text-right text-base font-semibold tracking-tight text-zinc-900">
              {metric.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function TrendChart({
  points,
  target,
  targetLabel,
}: {
  points: TrendPoint[];
  target: number;
  targetLabel: string;
}) {
  const width = 640;
  const height = 260;
  const padding = { top: 18, right: 26, bottom: 34, left: 42 };
  const values = points.map((point) => point.value);
  const max = Math.max(...values, target) + 12;
  const min = Math.min(0, ...values, target);
  const xSpan = width - padding.left - padding.right;
  const ySpan = height - padding.top - padding.bottom;
  const xStep = points.length > 1 ? xSpan / (points.length - 1) : 0;
  const yFor = (value: number) =>
    padding.top + ((max - value) / (max - min || 1)) * ySpan;
  const xFor = (index: number) => padding.left + index * xStep;
  const line = points
    .map((point, index) => `${xFor(index)},${yFor(point.value)}`)
    .join(" ");
  const area = `${padding.left},${height - padding.bottom} ${line} ${
    width - padding.right
  },${height - padding.bottom}`;
  const targetY = yFor(target);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Optimization trend by trial"
      className="mt-4 aspect-[16/7] max-h-[280px] w-full overflow-visible"
    >
      {[0, 1, 2, 3].map((tick) => {
        const y = padding.top + (ySpan / 3) * tick;
        return (
          <line
            key={tick}
            x1={padding.left}
            x2={width - padding.right}
            y1={y}
            y2={y}
            stroke="#e4e4e7"
            opacity="0.72"
            strokeWidth="1"
          />
        );
      })}
      <line
        x1={padding.left}
        x2={width - padding.right}
        y1={targetY}
        y2={targetY}
        stroke="#d97706"
        opacity="0.72"
        strokeDasharray="4 4"
        strokeWidth="1.2"
      />
      <text
        x={width - padding.right}
        y={targetY - 7}
        textAnchor="end"
        className="fill-amber-600 text-[11px] font-medium"
      >
        {targetLabel}
      </text>
      <polygon points={area} fill="url(#trend-area)" opacity="0.9" />
      <polyline
        points={line}
        fill="none"
        stroke="#0a84ff"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.6"
        className="animate-draw"
      />
      {points.map((point, index) => (
        <g key={point.label}>
          <circle
            cx={xFor(index)}
            cy={yFor(point.value)}
            r={index === points.length - 1 ? 4.5 : 3}
            fill={index === points.length - 1 ? "#0a84ff" : "#ffffff"}
            stroke="#0a84ff"
            strokeWidth="1.6"
          />
          {(index === 0 ||
            index === points.length - 1 ||
            index % 4 === 0) && (
            <text
              x={xFor(index)}
              y={height - 10}
              textAnchor="middle"
              className="fill-zinc-400 text-[11px] font-medium"
            >
              {point.label}
            </text>
          )}
        </g>
      ))}
      <defs>
        <linearGradient id="trend-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#dbeafe" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.15" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function TrialsList({
  trials,
  metricName,
}: {
  trials: ExperimentTrial[];
  metricName: string;
}) {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
        Recent trials
      </h2>
      <p className="mt-1 text-xs text-zinc-500">
        Latest attempts and measured outcomes.
      </p>

      <div className="mt-3 divide-y divide-zinc-200/70 overflow-hidden rounded-2xl bg-white/55 ring-1 ring-zinc-950/5">
        {trials.map((trial) => (
          <article
            key={trial.id}
            className="px-4 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-mono text-xs font-semibold text-zinc-900">
                    {trial.id}
                  </p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ring-1 ring-inset ring-black/5 ${
                      TRIAL_TONE[trial.status]
                    }`}
                  >
                    {statusLabel(trial.status)}
                  </span>
                </div>
                <h3 className="mt-2 truncate text-sm font-medium text-zinc-900">
                  {trial.title}
                </h3>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs text-zinc-400">{metricName}</p>
                <p className="mt-0.5 text-sm font-semibold text-zinc-900">
                  {trial.metricValue}
                </p>
              </div>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">
              {trial.summary}
            </p>
            <p className="mt-2 text-xs text-zinc-400">{trial.duration}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function DetailStatusStrip({ experiment }: { experiment: Experiment }) {
  const latestTrial = experiment.trials[0];
  const trials = experiment.metrics.find((metric) => metric.label === "Trials");
  const spend = experiment.metrics.find((metric) => metric.label === "Spend");
  const evaluation = experiment.evaluation;
  const statusDetail = experiment.pendingQuestion
    ? "User input required"
    : experiment.timing ?? latestTrial.duration;
  const items = [
    {
      label: "State",
      value: statusLabel(experiment.status),
      detail: statusDetail,
    },
    {
      label: experiment.metricLabel,
      value: experiment.metricValue,
      detail: "Current",
    },
    {
      label: "Evaluation",
      value: evaluationStatusLabel(evaluation.status),
      detail: evaluation.mode === "existing" ? "Existing script" : "Generated script",
    },
    {
      label: "Score",
      value: evaluation.scoreName || experiment.targetLabel,
      detail: directionLabel(evaluation.scoreDirection),
    },
    {
      label: "Latest trial",
      value: latestTrial.id,
      detail: latestTrial.metricValue,
    },
    {
      label: "Elapsed",
      value: trials?.detail.replace(" elapsed", "") ?? latestTrial.duration,
      detail: `${trials?.value ?? experiment.trials.length} trials`,
    },
    {
      label: "Spend",
      value: spend?.value ?? "$0.00",
      detail: spend?.detail ?? "not tracked",
    },
  ];

  return (
    <div className="grid gap-px overflow-hidden rounded-2xl bg-zinc-200/70 ring-1 ring-zinc-950/5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {items.map((item) => (
        <div key={item.label} className="min-w-0 bg-white/70 px-3.5 py-3">
          <p className="truncate text-xs font-medium text-zinc-500">
            {item.label}
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-zinc-900">
            {item.value}
          </p>
          <p className="mt-0.5 truncate text-xs text-zinc-400">
            {item.detail}
          </p>
        </div>
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
    <nav className="flex min-w-0 gap-5 overflow-x-auto border-t border-zinc-200/70 px-5 md:px-6">
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

function OverviewPanel({
  experiment,
  metricName,
  onNotify,
}: {
  experiment: Experiment;
  metricName: string;
  onNotify: (message: string) => void;
}) {
  const latestPoint = experiment.trend[experiment.trend.length - 1];
  const previousPoint = experiment.trend[experiment.trend.length - 2];
  const movement =
    latestPoint && previousPoint ? latestPoint.value - previousPoint.value : 0;
  const movementUnit = experiment.metricValue.includes("ms") ? "ms" : "";
  const activeTrial = experiment.trials[0];

  return (
    <section className="grid gap-5 xl:grid-cols-[1.45fr_0.85fr]">
      <div className="space-y-5">
        <section className="rounded-2xl bg-zinc-50/70 p-4 ring-1 ring-zinc-950/5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-zinc-900">
                Overview
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Trend direction and latest trial state.
              </p>
            </div>
            <div className="rounded-2xl bg-blue-50/80 px-3 py-2 text-right ring-1 ring-blue-100">
              <p className="text-xs font-medium text-blue-700">
                Current {experiment.metricValue}
              </p>
              <p
                className={`mt-0.5 text-xs ${
                  movement > 0 ? "text-amber-600" : "text-emerald-600"
                }`}
              >
                {movement > 0 ? "+" : ""}
                {movement}
                {movementUnit} from previous
              </p>
            </div>
          </div>
          <TrendChart
            points={experiment.trend}
            target={experiment.targetMetric}
            targetLabel={`${experiment.targetLabel}: ${experiment.targetValue}`}
          />
        </section>

        <div className="grid gap-3 lg:grid-cols-2">
          <section className="rounded-2xl bg-white/65 p-4 ring-1 ring-zinc-950/5">
            <h3 className="text-sm font-semibold text-zinc-900">Active run</h3>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-xs font-semibold text-zinc-900">
                  {activeTrial.id}
                </p>
                <p className="mt-1 truncate text-sm font-medium text-zinc-900">
                  {activeTrial.title}
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ring-1 ring-inset ring-black/5 ${
                  TRIAL_TONE[activeTrial.status]
                }`}
              >
                {statusLabel(activeTrial.status)}
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-zinc-500">
              {activeTrial.summary}
            </p>
          </section>

          <section className="rounded-2xl bg-white/65 p-4 ring-1 ring-zinc-950/5">
            <h3 className="text-sm font-semibold text-zinc-900">Measurement</h3>
            <div className="mt-3 divide-y divide-zinc-200/70 text-sm">
              <div className="flex items-center justify-between gap-3 py-2 first:pt-0">
                <span className="text-zinc-500">{metricName}</span>
                <span className="font-semibold text-zinc-900">
                  {activeTrial.metricValue}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 py-2">
                <span className="text-zinc-500">{experiment.targetLabel}</span>
                <span className="font-semibold text-zinc-900">
                  {experiment.targetValue}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 py-2 last:pb-0">
                <span className="text-zinc-500">Duration</span>
                <span className="font-semibold text-zinc-900">
                  {activeTrial.duration}
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>

      <aside className="space-y-5">
        <section className="rounded-2xl bg-white/65 p-4 ring-1 ring-zinc-950/5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Run controls
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onNotify(`${experiment.title} paused`)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-medium text-zinc-700 ring-1 ring-zinc-950/5 transition-colors hover:bg-zinc-50"
            >
              <PauseIcon className="h-4 w-4" />
              Pause
            </button>
            <button
              type="button"
              onClick={() => onNotify(`${experiment.title} stopped`)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 ring-1 ring-rose-200/70 transition-colors hover:bg-rose-100"
            >
              <CloseIcon className="h-4 w-4" />
              Stop
            </button>
          </div>
        </section>

        <MetricsList metrics={experiment.metrics} />
      </aside>
    </section>
  );
}

function EvaluationPanel({
  experiment,
  onChange,
  onStartInterview,
  onSendSetupReply,
  onApproveGenerated,
}: {
  experiment: Experiment;
  onChange: (
    experiment: Experiment,
    patch: Partial<ExperimentEvaluation>,
  ) => void;
  onStartInterview: (experiment: Experiment) => void;
  onSendSetupReply: (experiment: Experiment, text: string) => void;
  onApproveGenerated: (experiment: Experiment) => void;
}) {
  const [reply, setReply] = useState("");
  const evaluation = experiment.evaluation;
  const missingFields = getMissingEvaluationFields(evaluation);
  const isReady = evaluation.status === "ready";
  const modeOptions: { id: EvaluationMode; label: string; detail: string }[] = [
    {
      id: "existing",
      label: "Use existing script",
      detail: "Fill the eval contract directly.",
    },
    {
      id: "generated",
      label: "Generate with agent",
      detail: "Interview only for eval creation.",
    },
  ];

  const sendReply = () => {
    const trimmed = reply.trim();
    if (!trimmed) return;

    onSendSetupReply(experiment, trimmed);
    setReply("");
  };

  return (
    <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
      <div className="space-y-5">
        <section className="rounded-2xl bg-white/65 p-4 ring-1 ring-zinc-950/5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-zinc-900">
                Evaluation setup
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Define the runnable score contract before starting the experiment.
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
                isReady
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200/80"
                  : "bg-amber-50 text-amber-700 ring-amber-200/80"
              }`}
            >
              {evaluationStatusLabel(evaluation.status)}
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {modeOptions.map((option) => {
              const selected = evaluation.mode === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onChange(experiment, { mode: option.id })}
                  className={`rounded-xl px-3.5 py-3 text-left ring-1 transition-colors ${
                    selected
                      ? "bg-blue-50 text-blue-700 ring-blue-200"
                      : "bg-white text-zinc-700 ring-zinc-200 hover:bg-zinc-50"
                  }`}
                >
                  <span className="block text-sm font-semibold">
                    {option.label}
                  </span>
                  <span
                    className={`mt-1 block text-xs ${
                      selected ? "text-blue-600" : "text-zinc-500"
                    }`}
                  >
                    {option.detail}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {evaluation.mode === "existing" ? (
          <section className="rounded-2xl bg-zinc-50/70 p-4 ring-1 ring-zinc-950/5">
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                  Eval script path
                </label>
                <input
                  value={evaluation.scriptPath}
                  onChange={(e) =>
                    onChange(experiment, { scriptPath: e.target.value })
                  }
                  placeholder="/path/to/eval.ts"
                  className={`${inputClass} font-mono`}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                  Run command
                </label>
                <input
                  value={evaluation.runCommand}
                  onChange={(e) =>
                    onChange(experiment, { runCommand: e.target.value })
                  }
                  placeholder="pnpm tsx /path/to/eval.ts"
                  className={`${inputClass} font-mono`}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                  Score name
                </label>
                <input
                  value={evaluation.scoreName}
                  onChange={(e) =>
                    onChange(experiment, { scoreName: e.target.value })
                  }
                  placeholder="score"
                  className={inputClass}
                />
              </div>
              <div>
                <p className="mb-1.5 block text-sm font-medium text-zinc-700">
                  Score direction
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {SCORE_DIRECTIONS.map((direction) => {
                    const selected =
                      evaluation.scoreDirection === direction.id;
                    return (
                      <button
                        key={direction.id}
                        type="button"
                        onClick={() =>
                          onChange(experiment, {
                            scoreDirection: direction.id,
                          })
                        }
                        className={`rounded-lg px-3 py-2 text-left ring-1 transition-colors ${
                          selected
                            ? "bg-blue-600 text-white ring-blue-600"
                            : "bg-white text-zinc-700 ring-zinc-200 hover:bg-zinc-50"
                        }`}
                      >
                        <span className="block text-sm font-semibold">
                          {direction.label}
                        </span>
                        <span
                          className={`mt-0.5 block text-[11px] ${
                            selected ? "text-blue-100" : "text-zinc-500"
                          }`}
                        >
                          {direction.detail}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {missingFields.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 px-3.5 py-3 ring-1 ring-amber-200/80">
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    Missing {missingFields.join(", ")}
                  </p>
                  <p className="mt-0.5 text-xs text-amber-700">
                    Fill the template or let the setup agent collect the details.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onStartInterview(experiment)}
                  className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-amber-700 ring-1 ring-amber-200 transition-colors hover:bg-amber-100"
                >
                  Interview to fill gaps
                </button>
              </div>
            )}
          </section>
        ) : (
          <section className="flex min-h-[480px] flex-col overflow-hidden rounded-2xl bg-zinc-50/70 ring-1 ring-zinc-950/5">
            <header className="border-b border-zinc-200/70 bg-white/55 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">
                    Eval setup interview
                  </h3>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Thread{" "}
                    <span className="font-mono">
                      {evaluation.evalSetupThreadId ?? "not started"}
                    </span>
                  </p>
                </div>
                {!evaluation.evalSetupThreadId && (
                  <button
                    type="button"
                    onClick={() => onStartInterview(experiment)}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                  >
                    Start interview
                  </button>
                )}
              </div>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
              {evaluation.messages.length === 0 ? (
                <div className="rounded-xl bg-white/70 px-4 py-6 text-center ring-1 ring-zinc-950/5">
                  <p className="text-sm font-medium text-zinc-900">
                    No eval setup messages yet.
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">
                    Start the interview or describe what the eval should measure.
                  </p>
                </div>
              ) : (
                evaluation.messages.map((message) => {
                  const fromUser = message.author === "user";
                  return (
                    <div
                      key={message.id}
                      className={`flex ${
                        fromUser ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-3 text-sm leading-relaxed ${
                          fromUser
                            ? "bg-blue-600 text-white shadow-sm"
                            : "bg-white/70 text-zinc-700 ring-1 ring-zinc-950/5"
                        }`}
                      >
                        <p>{message.text}</p>
                        <p
                          className={`mt-2 text-[11px] ${
                            fromUser ? "text-blue-100" : "text-zinc-400"
                          }`}
                        >
                          {message.time}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendReply();
              }}
              className="border-t border-zinc-200/70 bg-white/55 p-4"
            >
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendReply();
                  }
                }}
                rows={3}
                placeholder="Tell the setup agent what the eval should measure..."
                className={`${inputClass} resize-none`}
              />
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-zinc-400">
                  This thread is separate from runtime Agent Collab
                </p>
                <button
                  type="submit"
                  disabled={!reply.trim()}
                  className="rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </form>
          </section>
        )}
      </div>

      <aside className="space-y-5">
        <section className="rounded-2xl bg-white/65 p-4 ring-1 ring-zinc-950/5">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Eval contract
          </p>
          <div className="mt-3 divide-y divide-zinc-200/70 text-sm">
            <div className="flex items-center justify-between gap-3 py-2 first:pt-0">
              <span className="text-zinc-500">Script</span>
              <span className="truncate font-mono font-medium text-zinc-900">
                {evaluation.scriptPath || "Not set"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 py-2">
              <span className="text-zinc-500">Command</span>
              <span className="truncate font-mono font-medium text-zinc-900">
                {evaluation.runCommand || "Not set"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 py-2">
              <span className="text-zinc-500">Score</span>
              <span className="font-medium text-zinc-900">
                {evaluation.scoreName || "score"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 py-2 last:pb-0">
              <span className="text-zinc-500">Direction</span>
              <span className="font-medium text-zinc-900">
                {directionLabel(evaluation.scoreDirection)}
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-zinc-50/70 p-4 ring-1 ring-zinc-950/5">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Contract behavior
          </p>
          <ul className="mt-3 space-y-2 text-sm text-zinc-500">
            <li>Command exits 0 when the eval runs successfully.</li>
            <li>Stdout prints one numeric score.</li>
            <li>Non-zero exit marks the trial invalid.</li>
            <li>Any improvement in the chosen direction counts.</li>
          </ul>
        </section>

        {evaluation.mode === "generated" && (
          <section className="rounded-2xl bg-white/65 p-4 ring-1 ring-zinc-950/5">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Generated script
            </p>
            <p className="mt-3 text-sm leading-relaxed text-zinc-500">
              Approving the generated eval stores the script path and command on
              this experiment.
            </p>
            <button
              type="button"
              onClick={() => onApproveGenerated(experiment)}
              disabled={
                !evaluation.evalSetupThreadId ||
                evaluation.generatedScriptApproved
              }
              className="mt-4 w-full rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {evaluation.generatedScriptApproved
                ? "Generated eval approved"
                : "Approve generated eval"}
            </button>
          </section>
        )}
      </aside>
    </section>
  );
}

function ProgressPanel({ steps }: { steps: ProgressStep[] }) {
  const current =
    steps.find((step) => step.status === "blocked") ??
    steps.find((step) => step.status === "active") ??
    steps[0];
  const queued = steps.filter((step) => step.status === "queued");

  return (
    <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-2xl bg-white/65 p-4 ring-1 ring-zinc-950/5">
        <h2 className="text-base font-semibold tracking-tight text-zinc-900">
          Progress monitor
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Current step, recent work, and queued actions.
        </p>

        <div className="mt-5 divide-y divide-zinc-200/70">
          {steps.map((step) => (
            <article key={step.id} className="grid gap-3 py-4 first:pt-0 sm:grid-cols-[8rem_1fr]">
              <div className="flex items-center gap-2 sm:block">
                <p className="font-mono text-xs text-zinc-400">{step.time}</p>
                <span
                  className={`mt-0 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ring-1 ring-inset sm:mt-2 ${
                    PROGRESS_TONE[step.status]
                  }`}
                >
                  {step.status}
                </span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">
                  {step.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-zinc-500">
                  {step.detail}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <aside className="space-y-5">
        <section className="rounded-2xl bg-zinc-50/70 p-4 ring-1 ring-zinc-950/5">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Current focus
          </p>
          <h3 className="mt-3 text-base font-semibold text-zinc-900">
            {current.title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
            {current.detail}
          </p>
          <span
            className={`mt-4 inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset ${
              PROGRESS_TONE[current.status]
            }`}
          >
            {current.status}
          </span>
        </section>

        <section className="rounded-2xl bg-white/65 p-4 ring-1 ring-zinc-950/5">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Next up
          </p>
          <div className="mt-3 space-y-3">
            {queued.length > 0 ? (
              queued.map((step) => (
                <div key={step.id}>
                  <p className="text-sm font-medium text-zinc-900">
                    {step.title}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-500">
                    {step.detail}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-zinc-500">No queued steps.</p>
            )}
          </div>
        </section>
      </aside>
    </section>
  );
}

function ChangesPanel({ changes }: { changes: ExperimentChange[] }) {
  return (
    <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
      <section className="rounded-2xl bg-white/65 p-4 ring-1 ring-zinc-950/5">
        <h2 className="text-base font-semibold tracking-tight text-zinc-900">
          Changes
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Files, patches, and validation state for this experiment.
        </p>

        <div className="mt-5 divide-y divide-zinc-200/70">
          {changes.map((change) => (
            <article key={change.id} className="py-4 first:pt-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs font-medium text-zinc-500">
                    {change.path}
                  </p>
                  <h3 className="mt-2 text-sm font-semibold text-zinc-900">
                    {change.summary}
                  </h3>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ring-1 ring-inset ${
                    CHANGE_TONE[change.status]
                  }`}
                >
                  {change.status}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <aside className="space-y-5">
        <section className="rounded-2xl bg-zinc-50/70 p-4 ring-1 ring-zinc-950/5">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Validation
          </p>
          <h3 className="mt-3 text-base font-semibold text-zinc-900">
            Static checks queued
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
            Fast validation can run after the selected compression path is applied.
          </p>
        </section>

        <section className="rounded-2xl bg-white/65 p-4 ring-1 ring-zinc-950/5">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Review focus
          </p>
          <ul className="mt-3 space-y-2 text-sm text-zinc-500">
            <li>Latency improvement against target p95.</li>
            <li>Error rate and memory pressure guardrails.</li>
            <li>Compression default impact on large JSON responses.</li>
          </ul>
        </section>
      </aside>
    </section>
  );
}

function AgentCollab({
  experiment,
  onAnswer,
  onSendReply,
}: {
  experiment: Experiment;
  onAnswer: (experiment: Experiment, answer: string) => void;
  onSendReply: (experiment: Experiment, text: string) => void;
}) {
  const [reply, setReply] = useState("");

  const addReply = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    onSendReply(experiment, trimmed);
    setReply("");
  };

  return (
    <section className="flex min-h-[520px] w-full flex-col overflow-hidden rounded-2xl bg-zinc-50/70 ring-1 ring-zinc-950/5">
      <header className="border-b border-zinc-200/70 bg-white/55 px-5 py-4">
        <div className="flex items-center gap-2">
          <Avatar size={28} hue={205}>
            <FlaskIcon className="h-4 w-4 text-white" />
          </Avatar>
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Agent Collab</h2>
            <p className="text-xs text-zinc-500">Context and decisions</p>
          </div>
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
        {experiment.agentMessages.map((message) => {
          const fromUser = message.author === "user";
          return (
            <div
              key={message.id}
              className={`flex ${fromUser ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-3 text-sm leading-relaxed ${
                  fromUser
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white/70 text-zinc-700 ring-1 ring-zinc-950/5"
                }`}
              >
                <p>{message.text}</p>
                <p
                  className={`mt-2 text-[11px] ${
                    fromUser ? "text-blue-100" : "text-zinc-400"
                  }`}
                >
                  {message.time}
                </p>
              </div>
            </div>
          );
        })}

        {experiment.pendingQuestion && experiment.status === "needs-input" && (
          <div className="rounded-2xl bg-amber-50/80 p-4 ring-1 ring-amber-200/80">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700">
              <WarningIcon className="h-3.5 w-3.5" />
              {experiment.pendingQuestion.title}
            </p>
            <p className="mt-2 text-sm font-medium leading-relaxed text-zinc-900">
              {experiment.pendingQuestion.body}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {experiment.pendingQuestion.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => onAnswer(experiment, option)}
                  className="rounded-xl bg-white/80 px-3 py-1.5 text-sm font-medium text-zinc-700 ring-1 ring-zinc-950/5 transition-colors hover:bg-white hover:text-blue-700"
                >
                  {option}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-zinc-400">Just now</p>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          addReply(reply);
        }}
        className="border-t border-zinc-200/70 bg-white/55 p-4"
      >
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              addReply(reply);
            }
          }}
          rows={3}
          placeholder="Reply to agent..."
          className={`${inputClass} resize-none`}
        />
        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-zinc-400">Press Enter to send</p>
          <button
            type="submit"
            disabled={!reply.trim()}
            className="rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </section>
  );
}

function ExperimentDetail({
  experiment,
  onBack,
  onStart,
  onApprove,
  onAnswer,
  onSendReply,
  onUpdateEvaluation,
  onStartEvalInterview,
  onSendEvalSetupReply,
  onApproveGeneratedEvaluation,
  onNotify,
}: {
  experiment: Experiment;
  onBack: () => void;
  onStart: (experiment: Experiment) => void;
  onApprove: (experiment: Experiment) => void;
  onAnswer: (experiment: Experiment, answer: string) => void;
  onSendReply: (experiment: Experiment, text: string) => void;
  onUpdateEvaluation: (
    experiment: Experiment,
    patch: Partial<ExperimentEvaluation>,
  ) => void;
  onStartEvalInterview: (experiment: Experiment) => void;
  onSendEvalSetupReply: (experiment: Experiment, text: string) => void;
  onApproveGeneratedEvaluation: (experiment: Experiment) => void;
  onNotify: (message: string) => void;
}) {
  const [detailTab, setDetailTab] = useState<DetailTabId>(
    experiment.status === "setup" ? "evaluation" : "overview",
  );
  const metricName = experiment.metricLabel.replace(/^Current\s+/i, "");
  const canApprove = experiment.status === "needs-input";
  const needsInput = canApprove && Boolean(experiment.pendingQuestion);
  const canStart =
    experiment.status === "setup" && experiment.evaluation.status === "ready";

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
            onChange={onUpdateEvaluation}
            onStartInterview={onStartEvalInterview}
            onSendSetupReply={onSendEvalSetupReply}
            onApproveGenerated={onApproveGeneratedEvaluation}
          />
        );
      case "progress":
        return <ProgressPanel steps={experiment.progressSteps} />;
      case "collab":
        return (
          <AgentCollab
            experiment={experiment}
            onAnswer={onAnswer}
            onSendReply={onSendReply}
          />
        );
      case "trials":
        return <TrialsList trials={experiment.trials} metricName={metricName} />;
      case "changes":
        return <ChangesPanel changes={experiment.changes} />;
      case "overview":
      default:
        return (
          <OverviewPanel
            experiment={experiment}
            metricName={metricName}
            onNotify={onNotify}
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
        className="relative z-10 flex max-h-[calc(100vh-2.5rem)] w-full max-w-[1760px] animate-scale-in flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/80 shadow-[0_24px_80px_rgba(15,23,42,0.18)] ring-1 ring-zinc-950/5 backdrop-blur-2xl md:max-h-[calc(100vh-4rem)]"
      >
        <header className="border-b border-zinc-200/70 bg-white/45 px-5 py-4 md:px-6 md:py-5">
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
                    canStart
                      ? "Start experiment"
                      : "Complete evaluation setup first"
                  }
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Start experiment
                  <ArrowRightIcon className="h-4 w-4" />
                </button>
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

          <div className="mt-5">
            <DetailStatusStrip experiment={experiment} />
          </div>
        </header>

        <DetailTabs
          active={detailTab}
          needsInput={needsInput}
          evaluationStatus={experiment.evaluation.status}
          onChange={setDetailTab}
        />

        <div className="min-h-0 flex-1 overflow-y-auto bg-white/55 px-5 py-4 md:px-6">
          {detailTab !== "collab" && (
            <PendingInputBanner
              experiment={experiment}
              onAnswer={onAnswer}
              onOpenCollab={() => setDetailTab("collab")}
            />
          )}

          <div className="w-full">{activePanel}</div>
        </div>
      </section>
    </div>
  );
}

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

export default function Dashboard() {
  const [items, setItems] = useState<Experiment[]>(seed);
  const [tab, setTab] = useState<TabId>("all");
  const [nav, setNav] = useState<NavId>("experiments");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteFor, setDeleteFor] = useState<Experiment | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(
      () => setToast((current) => (current === message ? null : current)),
      2600,
    );
  };

  const needsInputCount = items.filter((e) => e.status === "needs-input").length;
  const visible = tab === "all" ? items : items.filter((e) => e.status === tab);
  const selected = items.find((experiment) => experiment.id === selectedId);

  const handleCreate = (draft: {
    repo: string;
    title: string;
    description: string;
  }) => {
    const title = draft.title.trim();
    const context =
      draft.description.trim() ||
      "Evaluation setup required before optimization can start.";
    const base = {
      id: `${slugify(title)}-${items.length}`,
      repo: draft.repo.trim(),
      title,
      description: context,
    };
    const progress = "Not started";
    const detail = {
      objective: context,
      targetLabel: "Direction",
      targetValue: "Not set",
      targetMetric: 0,
      evaluation: {
        mode: "existing",
        scriptPath: "",
        scoreDirection: "minimize",
        runCommand: "",
        scoreName: "score",
        status: "missing",
        messages: [],
      },
      metrics: [
        { label: "Evaluation", value: "Needed", detail: "setup required" },
        { label: "Score", value: "-", detail: "not measured" },
        { label: "Best trial", value: "-", detail: "not started" },
        { label: "Error rate", value: "-", detail: "not measured" },
        { label: "Trials", value: "0", detail: "not started" },
        { label: "Spend", value: "$0.00", detail: "0 tokens" },
      ],
      trend: [{ label: "Setup", value: 0 }],
      trials: [
        {
          id: "Setup",
          title: "Evaluation setup",
          summary: "Provide an eval script contract before starting the run.",
          metricValue: progress,
          duration: "Just now",
          status: "setup",
        },
      ],
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
      changes: [
        {
          id: "initial-workspace",
          path: base.repo,
          summary: "Experiment workspace waiting for evaluation setup.",
          status: "planned",
        },
      ],
      agentMessages: [
        {
          id: "created-message",
          author: "agent",
          text: "Workspace created. Runtime collaboration will start after the evaluation contract is ready.",
          time: "Just now",
        },
      ],
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

    const experiment: Experiment = {
      ...base,
      ...detail,
      status: "setup",
      metricLabel: "Evaluation",
      metricValue: "needed",
      timing: "setup",
    };

    setItems((prev) => [experiment, ...prev]);
    setTab("all");
    setNav("experiments");
    setSelectedId(experiment.id);
    setShowCreate(false);
    notify(`Created "${title}"`);
  };

  const handleUpdateEvaluation = (
    experiment: Experiment,
    patch: Partial<ExperimentEvaluation>,
  ) => {
    setItems((prev) =>
      prev.map((e) => {
        if (e.id !== experiment.id) return e;

        const merged = {
          ...e.evaluation,
          ...patch,
        };
        const nextEvaluation = normalizeEvaluation(
          patch.mode === "existing"
            ? {
                ...merged,
                evalSetupThreadId: undefined,
                generatedScriptApproved: undefined,
                messages: [],
              }
            : merged,
        );

        return {
          ...e,
          evaluation: nextEvaluation,
          metricValue:
            e.status === "setup"
              ? nextEvaluation.status === "ready"
                ? "ready"
                : "needed"
              : e.metricValue,
          targetValue: directionLabel(nextEvaluation.scoreDirection),
          metrics: refreshEvaluationMetrics(e.metrics, nextEvaluation),
        };
      }),
    );
  };

  const handleStartEvalInterview = (experiment: Experiment) => {
    const threadId =
      experiment.evaluation.evalSetupThreadId ?? `eval-setup-${Date.now()}`;

    setItems((prev) =>
      prev.map((e) => {
        if (e.id !== experiment.id) return e;

        const messages =
          e.evaluation.messages.length > 0
            ? e.evaluation.messages
            : [
                {
                  id: `eval-agent-${Date.now()}`,
                  author: "agent" as const,
                  text: "I will help create the eval script. What should the score measure, and what output should count as better?",
                  time: "Just now",
                },
              ];
        const nextEvaluation = normalizeEvaluation({
          ...e.evaluation,
          mode: "generated",
          evalSetupThreadId: threadId,
          messages,
        });

        return {
          ...e,
          evaluation: nextEvaluation,
          metrics: refreshEvaluationMetrics(e.metrics, nextEvaluation),
        };
      }),
    );
    notify("Eval setup interview started");
  };

  const handleEvalSetupReply = (experiment: Experiment, text: string) => {
    const threadId =
      experiment.evaluation.evalSetupThreadId ?? `eval-setup-${Date.now()}`;

    setItems((prev) =>
      prev.map((e) => {
        if (e.id !== experiment.id) return e;

        const opening =
          e.evaluation.messages.length === 0
            ? [
                {
                  id: `eval-agent-${Date.now()}`,
                  author: "agent" as const,
                  text: "I will keep this interview scoped to creating the eval script.",
                  time: "Just now",
                },
              ]
            : [];
        const nextEvaluation = normalizeEvaluation({
          ...e.evaluation,
          mode: "generated",
          evalSetupThreadId: threadId,
          messages: [
            ...opening,
            ...e.evaluation.messages,
            {
              id: `eval-user-${Date.now()}`,
              author: "user",
              text,
              time: "Just now",
            },
            {
              id: `eval-agent-reply-${Date.now()}`,
              author: "agent",
              text: "Captured. I will use that to draft the eval script contract for this repository.",
              time: "Just now",
            },
          ],
        });

        return {
          ...e,
          evaluation: nextEvaluation,
          metrics: refreshEvaluationMetrics(e.metrics, nextEvaluation),
        };
      }),
    );
    notify("Eval setup reply sent");
  };

  const handleApproveGeneratedEvaluation = (experiment: Experiment) => {
    if (!experiment.evaluation.evalSetupThreadId) {
      notify("Start the eval setup interview first");
      return;
    }

    setItems((prev) =>
      prev.map((e) => {
        if (e.id !== experiment.id) return e;

        const scriptPath =
          e.evaluation.scriptPath.trim() ||
          `.optimizer/evals/${slugify(e.title)}.eval.ts`;
        const nextEvaluation = normalizeEvaluation({
          ...e.evaluation,
          mode: "generated",
          scriptPath,
          runCommand:
            e.evaluation.runCommand.trim() || `pnpm tsx ${scriptPath}`,
          scoreName: e.evaluation.scoreName.trim() || "score",
          generatedScriptApproved: true,
          messages: [
            ...e.evaluation.messages,
            {
              id: `eval-approved-${Date.now()}`,
              author: "agent",
              text: `Generated eval approved at ${scriptPath}. The runtime agent can now use this eval contract.`,
              time: "Just now",
            },
          ],
        });

        return {
          ...e,
          evaluation: nextEvaluation,
          metricValue:
            e.status === "setup"
              ? nextEvaluation.status === "ready"
                ? "ready"
                : "needed"
              : e.metricValue,
          targetValue: directionLabel(nextEvaluation.scoreDirection),
          metrics: refreshEvaluationMetrics(e.metrics, nextEvaluation),
        };
      }),
    );
    notify("Generated eval approved");
  };

  const handleStartExperiment = (experiment: Experiment) => {
    if (experiment.evaluation.status !== "ready") {
      notify("Complete evaluation setup before starting");
      return;
    }

    setItems((prev) =>
      prev.map((e) => {
        if (e.id !== experiment.id) return e;

        const evaluation = normalizeEvaluation(e.evaluation);
        const metricLabel = `Current ${evaluation.scoreName}`;
        const direction = directionLabel(evaluation.scoreDirection);
        const runtimeInstruction = [
          `Repository: ${e.repo}`,
          `Eval script: ${evaluation.scriptPath}`,
          `Run command: ${evaluation.runCommand}`,
          `Score: ${evaluation.scoreName}`,
          `Direction: ${evaluation.scoreDirection}`,
        ].join("\n");

        return {
          ...e,
          status: "running",
          metricLabel,
          metricValue: "baseline pending",
          timing: "just started",
          targetLabel: "Direction",
          targetValue: direction,
          evaluation,
          metrics: [
            {
              label: metricLabel,
              value: "baseline pending",
              detail: "first eval queued",
            },
            { label: "Direction", value: direction, detail: "score objective" },
            { label: "Best trial", value: "-", detail: "not measured" },
            { label: "Error rate", value: "-", detail: "not measured" },
            { label: "Trials", value: "1", detail: "just started" },
            { label: "Spend", value: "$0.00", detail: "0 tokens" },
          ],
          trials: [
            {
              id: "T-01",
              title: "Baseline evaluation",
              summary: `Run ${evaluation.runCommand} and record ${evaluation.scoreName}.`,
              metricValue: "pending",
              duration: "Just now",
              status: "running",
            },
            ...e.trials.filter((trial) => trial.id !== "Setup"),
          ],
          progressSteps: e.progressSteps.map((step) =>
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
              summary: `Use ${evaluation.scoreName} eval contract for optimization.`,
              status: "planned",
            },
            ...e.changes.filter((change) => change.id !== "eval-contract"),
          ],
          agentMessages: [
            ...e.agentMessages,
            {
              id: `start-${Date.now()}`,
              author: "agent",
              text: `Starting optimization with this eval contract:\n${runtimeInstruction}`,
              time: "Just now",
            },
          ],
        };
      }),
    );
    notify(`Started "${experiment.title}"`);
  };

  const handleApprove = (experiment: Experiment) => {
    const message = "Approved. Resume the run.";
    setItems((prev) =>
      prev.map((e) =>
        e.id === experiment.id
          ? {
              ...e,
              status: "running",
              metricLabel: "Progress",
              metricValue: "resuming",
              timing: "just resumed",
              delta: undefined,
              pendingQuestion: undefined,
              agentMessages: [
                ...e.agentMessages,
                {
                  id: `reply-${Date.now()}`,
                  author: "user",
                  text: message,
                  time: "Just now",
                },
              ],
              progressSteps: e.progressSteps.map((step) =>
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
            }
          : e,
      ),
    );
    notify(`Approved - ${experiment.title} resumed`);
  };

  const handleReply = (experiment: Experiment, text: string) => {
    setItems((prev) =>
      prev.map((e) =>
        e.id === experiment.id
          ? {
              ...e,
              agentMessages: [
                ...e.agentMessages,
                {
                  id: `reply-${Date.now()}`,
                  author: "user",
                  text,
                  time: "Just now",
                },
              ],
            }
          : e,
      ),
    );
    notify("Reply sent");
  };

  const handleAnswer = (experiment: Experiment, answer: string) => {
    setItems((prev) =>
      prev.map((e) =>
        e.id === experiment.id
          ? {
              ...e,
              status: "running",
              metricLabel: "Progress",
              metricValue: "resuming",
              timing: "just resumed",
              delta: undefined,
              pendingQuestion: undefined,
              agentMessages: [
                ...e.agentMessages,
                {
                  id: `answer-${Date.now()}`,
                  author: "user",
                  text: answer,
                  time: "Just now",
                },
              ],
              progressSteps: e.progressSteps.map((step) =>
                step.status === "blocked"
                  ? {
                      ...step,
                      status: "completed",
                      detail: `User selected ${answer}.`,
                      time: "Just now",
                    }
                  : step.status === "queued"
                    ? { ...step, status: "active", time: "Now" }
                    : step,
              ),
              changes: e.changes.map((change) =>
                change.status === "planned"
                  ? { ...change, status: "applied" }
                  : change,
              ),
            }
          : e,
      ),
    );
    notify(`Answered - ${experiment.title} resumed`);
  };

  const handleDelete = (experiment: Experiment) => {
    setItems((prev) => prev.filter((e) => e.id !== experiment.id));
    setSelectedId((current) => (current === experiment.id ? null : current));
    setDeleteFor(null);
    notify(`Deleted "${experiment.title}"`);
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
          onBack={() => setSelectedId(null)}
          onStart={handleStartExperiment}
          onApprove={handleApprove}
          onAnswer={handleAnswer}
          onSendReply={handleReply}
          onUpdateEvaluation={handleUpdateEvaluation}
          onStartEvalInterview={handleStartEvalInterview}
          onSendEvalSetupReply={handleEvalSetupReply}
          onApproveGeneratedEvaluation={handleApproveGeneratedEvaluation}
          onNotify={notify}
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
