"use client";

import { useEffect, useState, type ReactNode } from "react";
import ExperimentCard from "@/components/experiment-card";
import {
  experiments as seed,
  type AgentMessage,
  type Experiment,
  type ExperimentMetric,
  type ExperimentTrial,
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
  { id: "running", label: "Running" },
  { id: "needs-input", label: "Needs input" },
  { id: "completed", label: "Completed" },
];

const inputClass =
  "w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

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
    status: Status;
  }) => void;
}) {
  const [repo, setRepo] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Status>("running");

  return (
    <Overlay onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          onCreate({ repo, title, description, status });
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
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
              Repository
            </label>
            <input
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="frontend-monorepo"
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
              autoFocus
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
              Objective
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What should the agent optimize, and by how much?"
              className={`${inputClass} resize-none`}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
              Initial state
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(["running", "needs-input", "completed"] as Status[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`rounded-lg border px-2 py-1.5 text-xs font-medium capitalize transition-colors ${
                    status === s
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                  }`}
                >
                  {s === "needs-input" ? "Needs input" : s}
                </button>
              ))}
            </div>
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
            disabled={!title.trim()}
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
  running: "bg-blue-50 text-blue-700",
  "needs-input": "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  completed: "bg-emerald-50 text-emerald-700",
};

const TRIAL_TONE = {
  completed: "bg-emerald-50 text-emerald-700",
  "needs-input": "bg-amber-50 text-amber-700",
  running: "bg-blue-50 text-blue-700",
} as const;

function statusLabel(status: Status | "needs-input") {
  return status === "needs-input" ? "Needs input" : status;
}

function MetricsList({ metrics }: { metrics: ExperimentMetric[] }) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-zinc-900">Metrics</h2>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-3"
          >
            <p className="text-xs font-medium text-zinc-400">{metric.label}</p>
            <p className="mt-1 text-lg font-semibold tracking-tight text-zinc-900">
              {metric.value}
            </p>
            <p className="mt-0.5 truncate text-xs text-zinc-500">
              {metric.detail}
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
      className="mt-4 aspect-[16/7] max-h-[300px] w-full overflow-visible"
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
        strokeDasharray="4 4"
        strokeWidth="1.4"
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
        stroke="#0f5fb8"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4"
        className="animate-draw"
      />
      {points.map((point, index) => (
        <g key={point.label}>
          <circle
            cx={xFor(index)}
            cy={yFor(point.value)}
            r={index === points.length - 1 ? 5 : 3.5}
            fill={index === points.length - 1 ? "#0f5fb8" : "#ffffff"}
            stroke="#0f5fb8"
            strokeWidth="2"
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
          <stop offset="0%" stopColor="#bfdbfe" />
          <stop offset="100%" stopColor="#ffffff" />
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
      <h2 className="text-sm font-semibold text-zinc-900">Recent trials</h2>
      <p className="mt-0.5 text-xs text-zinc-500">
        Latest attempts and measured outcomes.
      </p>

      <div className="mt-3 space-y-2">
        {trials.map((trial) => (
          <article
            key={trial.id}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-mono text-xs font-semibold text-zinc-900">
                    {trial.id}
                  </p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
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

function ExperimentSummaryPanel({
  experiment,
  metricName,
  onBack,
  onApprove,
  onNotify,
}: {
  experiment: Experiment;
  metricName: string;
  onBack: () => void;
  onApprove: (experiment: Experiment) => void;
  onNotify: (message: string) => void;
}) {
  return (
    <aside className="flex min-w-0 flex-col overflow-y-auto border-r border-zinc-200 bg-zinc-50/70 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <header className="border-b border-zinc-200 bg-white px-5 py-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900"
        >
          <ArrowRightIcon className="h-4 w-4 rotate-180" />
          Experiments
        </button>

        <div className="mt-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-500">
              {experiment.repo}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                STATUS_TONE[experiment.status]
              }`}
            >
              {statusLabel(experiment.status)}
            </span>
          </div>
          <h1 className="mt-3 text-xl font-semibold tracking-tight text-zinc-900">
            {experiment.title}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
            {experiment.objective}
          </p>
        </div>
      </header>

      <div className="space-y-6 px-5 py-5">
        <section>
          <h2 className="text-sm font-semibold text-zinc-900">Run controls</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onNotify(`${experiment.title} paused`)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              <PauseIcon className="h-4 w-4" />
              Pause
            </button>
            <button
              type="button"
              onClick={() => onNotify(`${experiment.title} stopped`)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-100"
            >
              <CloseIcon className="h-4 w-4" />
              Stop
            </button>
            {experiment.status === "needs-input" && (
              <button
                type="button"
                onClick={() => onApprove(experiment)}
                className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-800"
              >
                Approve &amp; resume
                <ArrowRightIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </section>

        <MetricsList metrics={experiment.metrics} />

        <TrialsList trials={experiment.trials} metricName={metricName} />
      </div>
    </aside>
  );
}

function OptimizationPanel({
  experiment,
  metricName,
}: {
  experiment: Experiment;
  metricName: string;
}) {
  const latestPoint = experiment.trend[experiment.trend.length - 1];
  const previousPoint = experiment.trend[experiment.trend.length - 2];
  const movement =
    latestPoint && previousPoint ? latestPoint.value - previousPoint.value : 0;
  const movementUnit = experiment.metricValue.includes("ms") ? "ms" : "";
  const activeTrial = experiment.trials[0];

  return (
    <section className="flex min-w-0 flex-col overflow-y-auto bg-white">
      <header className="border-b border-zinc-200 px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
              Graph / Active Run
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Track optimization direction and the latest trial state.
            </p>
          </div>
          <div className="rounded-lg bg-blue-50 px-3 py-2 text-right">
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
      </header>

      <div className="px-5 py-5">
        <div className="w-full">
          <section className="rounded-xl border border-zinc-200 bg-white p-5">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">
                Optimization trend
              </h3>
              <p className="mt-0.5 text-xs text-zinc-500">
                Measured across completed trials.
              </p>
            </div>
            <TrendChart
              points={experiment.trend}
              target={experiment.targetMetric}
              targetLabel={`${experiment.targetLabel}: ${experiment.targetValue}`}
            />
          </section>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <section className="rounded-xl border border-zinc-200 bg-white p-5">
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
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
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

            <section className="rounded-xl border border-zinc-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-zinc-900">
                Measurement
              </h3>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-500">{metricName}</span>
                  <span className="font-semibold text-zinc-900">
                    {activeTrial.metricValue}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-500">{experiment.targetLabel}</span>
                  <span className="font-semibold text-zinc-900">
                    {experiment.targetValue}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-500">Duration</span>
                  <span className="font-semibold text-zinc-900">
                    {activeTrial.duration}
                  </span>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}

function AgentCollab({
  experiment,
  onApprove,
}: {
  experiment: Experiment;
  onApprove: (experiment: Experiment) => void;
}) {
  const [messages, setMessages] = useState<AgentMessage[]>(
    experiment.agentMessages,
  );
  const [reply, setReply] = useState("");

  const addReply = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setMessages((current) => [
      ...current,
      {
        id: `local-${Date.now()}`,
        author: "user",
        text: trimmed,
        time: "Just now",
      },
    ]);
    setReply("");
  };

  return (
    <aside className="flex min-w-0 flex-col border-l border-zinc-200 bg-zinc-50/70">
      <header className="border-b border-zinc-200 bg-white px-5 py-4">
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
        {messages.map((message) => {
          const fromUser = message.author === "user";
          return (
            <div
              key={message.id}
              className={`flex ${fromUser ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-3.5 py-3 text-sm leading-relaxed shadow-sm ${
                  fromUser
                    ? "bg-blue-700 text-white"
                    : "border border-zinc-200 bg-white text-zinc-700"
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
          <div className="rounded-xl border border-blue-300 bg-white p-4 shadow-sm ring-1 ring-blue-100">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-blue-700">
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
                  onClick={() => {
                    addReply(option);
                    onApprove(experiment);
                  }}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
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
        className="border-t border-zinc-200 bg-white p-4"
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
            className="rounded-lg bg-blue-700 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </aside>
  );
}

function ExperimentDetail({
  experiment,
  onBack,
  onApprove,
  onNotify,
}: {
  experiment: Experiment;
  onBack: () => void;
  onApprove: (experiment: Experiment) => void;
  onNotify: (message: string) => void;
}) {
  const metricName = experiment.metricLabel.replace(/^Current\s+/i, "");

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[0.9fr_1.15fr_0.95fr] overflow-hidden bg-white">
      <ExperimentSummaryPanel
        experiment={experiment}
        metricName={metricName}
        onBack={onBack}
        onApprove={onApprove}
        onNotify={onNotify}
      />

      <OptimizationPanel experiment={experiment} metricName={metricName} />

      <AgentCollab
        key={experiment.id}
        experiment={experiment}
        onApprove={onApprove}
      />
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
    status: Status;
  }) => {
    const title = draft.title.trim();
    const base = {
      id: `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${items.length}`,
      repo: draft.repo.trim() || "untitled-repo",
      title,
      description: draft.description.trim() || "No objective provided yet.",
    };
    const progress = draft.status === "completed" ? "100%" : "0%";
    const trialStatus = draft.status;
    const detail = {
      objective: base.description,
      targetLabel: "Target",
      targetValue: "100%",
      targetMetric: 100,
      metrics: [
        { label: "Progress", value: progress, detail: "demo session" },
        { label: "Target", value: "100%", detail: "objective" },
        { label: "Best trial", value: progress, detail: "created now" },
        { label: "Error rate", value: "-", detail: "not measured" },
        { label: "Trials", value: "1", detail: "created now" },
        { label: "Spend", value: "$0.00", detail: "0 tokens" },
      ],
      trend: [{ label: "T-01", value: draft.status === "completed" ? 100 : 0 }],
      trials: [
        {
          id: "T-01",
          title: "Experiment created",
          summary: base.description,
          metricValue: progress,
          duration: "Just now",
          status: trialStatus,
        },
      ],
      agentMessages: [
        {
          id: "created-message",
          author: "agent",
          text: "Workspace created. I will report trials and questions here as the optimization runs.",
          time: "Just now",
        },
      ],
      pendingQuestion:
        draft.status === "needs-input"
          ? {
              title: "Pending input",
              body: "What should the agent verify before continuing?",
              options: ["Review changes", "Resume"],
            }
          : undefined,
    } satisfies Pick<
      Experiment,
      | "objective"
      | "targetLabel"
      | "targetValue"
      | "targetMetric"
      | "metrics"
      | "trend"
      | "trials"
      | "agentMessages"
      | "pendingQuestion"
    >;

    let experiment: Experiment;
    if (draft.status === "running") {
      experiment = {
        ...base,
        ...detail,
        status: "running",
        metricLabel: "Progress",
        metricValue: "0%",
        timing: "just started",
      };
    } else if (draft.status === "needs-input") {
      experiment = {
        ...base,
        ...detail,
        status: "needs-input",
        metricLabel: "Status",
        metricValue: "Pending",
      };
    } else {
      experiment = {
        ...base,
        ...detail,
        status: "completed",
        metricLabel: "Result",
        metricValue: "Shipped",
        delta: { dir: "down", value: "0%" },
        timing: "just now",
      };
    }

    setItems((prev) => [experiment, ...prev]);
    setTab("all");
    setNav("experiments");
    setSelectedId(experiment.id);
    setShowCreate(false);
    notify(`Created "${title}"`);
  };

  const handleApprove = (experiment: Experiment) => {
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
            }
          : e,
      ),
    );
    notify(`Approved — ${experiment.title} resumed`);
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
      <main className="flex flex-1 flex-col overflow-hidden">
        {nav === "experiments" && selected ? (
          <ExperimentDetail
            key={selected.id}
            experiment={selected}
            onBack={() => setSelectedId(null)}
            onApprove={handleApprove}
            onNotify={notify}
          />
        ) : nav === "experiments" ? (
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
                const count = t.id === "needs-input" ? needsInputCount : 0;
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
