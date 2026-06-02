"use client";

import { useEffect, useState, type ReactNode } from "react";
import ExperimentCard from "@/components/experiment-card";
import {
  experiments as seed,
  sampleLogs,
  type Experiment,
  type Status,
} from "@/lib/experiments";
import {
  ArrowRightIcon,
  Avatar,
  BoltIcon,
  CheckIcon,
  CloseIcon,
  DocsIcon,
  FlaskIcon,
  PlusCircleIcon,
  PlusIcon,
  RepoIcon,
  SettingsIcon,
  SupportIcon,
  TrashIcon,
  UserGlyph,
  WarningIcon,
} from "@/components/icons";

type NavId = "experiments" | "new-experiment" | "repositories" | "settings";
type TabId = "all" | Status;

const PRIMARY_NAV = [
  { id: "experiments", label: "Experiments", Icon: FlaskIcon },
  { id: "new-experiment", label: "New Experiment", Icon: PlusCircleIcon },
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

const LOG_COLOR = {
  info: "text-zinc-400",
  warn: "text-amber-400",
  halt: "text-rose-400",
} as const;

function LogsModal({
  experiment,
  onClose,
  onApprove,
}: {
  experiment: Experiment;
  onClose: () => void;
  onApprove: (experiment: Experiment) => void;
}) {
  return (
    <Overlay onClose={onClose} className="max-w-lg">
      <header className="flex items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4">
        <div>
          <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-500">
            {experiment.repo}
          </span>
          <h2 className="mt-2 text-base font-semibold text-zinc-900">
            {experiment.title}
          </h2>
          <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs font-medium text-amber-600">
            <WarningIcon className="h-3.5 w-3.5" />
            Awaiting human verification
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
        <div className="space-y-1.5 rounded-xl bg-zinc-950 p-4 font-mono text-xs leading-relaxed">
          {sampleLogs.map((log, i) => (
            <div key={i} className="flex gap-3">
              <span className="shrink-0 text-zinc-600">{log.time}</span>
              <span className={LOG_COLOR[log.level]}>{log.text}</span>
            </div>
          ))}
        </div>
      </div>

      <footer className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-3.5 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100"
        >
          Close
        </button>
        <button
          type="button"
          onClick={() => onApprove(experiment)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-800"
        >
          Approve &amp; resume
          <ArrowRightIcon className="h-4 w-4" />
        </button>
      </footer>
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
  const [showCreate, setShowCreate] = useState(false);
  const [logsFor, setLogsFor] = useState<Experiment | null>(null);
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

  const handleNav = (id: NavId) => {
    if (id === "new-experiment") {
      setShowCreate(true);
      return;
    }
    setNav(id);
  };

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

    let experiment: Experiment;
    if (draft.status === "running") {
      experiment = {
        ...base,
        status: "running",
        metricLabel: "Progress",
        metricValue: "0%",
        timing: "just started",
      };
    } else if (draft.status === "needs-input") {
      experiment = {
        ...base,
        status: "needs-input",
        metricLabel: "Status",
        metricValue: "Pending",
      };
    } else {
      experiment = {
        ...base,
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
            }
          : e,
      ),
    );
    setLogsFor(null);
    notify(`Approved — ${experiment.title} resumed`);
  };

  const handleDelete = (experiment: Experiment) => {
    setItems((prev) => prev.filter((e) => e.id !== experiment.id));
    setLogsFor((current) => (current?.id === experiment.id ? null : current));
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

        <div className="px-3">
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-3 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-800 active:scale-[0.99]"
          >
            <BoltIcon className="h-4 w-4" />
            New Optimization
          </button>
        </div>

        <nav className="mt-4 flex-1 px-3">
          <ul className="space-y-0.5">
            {PRIMARY_NAV.map(({ id, label, Icon }) => {
              const active = nav === id;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => handleNav(id)}
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
      <main className="flex flex-1 flex-col overflow-y-auto">
        {nav === "experiments" ? (
          <div className="mx-auto w-full max-w-5xl px-8 py-8">
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
                      onReviewLogs={setLogsFor}
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
      {logsFor && (
        <LogsModal
          experiment={logsFor}
          onClose={() => setLogsFor(null)}
          onApprove={handleApprove}
        />
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
