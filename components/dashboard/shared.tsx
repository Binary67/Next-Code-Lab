import type {
  ExperimentChange,
  ExperimentTrial,
  ProgressStep,
  Status,
} from "@/lib/experiments";
import type { ReactNode } from "react";

export const inputClass =
  "w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
export const STATUS_TONE: Record<Status, string> = {
  setup: "bg-zinc-100 text-zinc-700",
  running: "bg-blue-50 text-blue-700",
  "needs-input": "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  completed: "bg-emerald-50 text-emerald-700",
  failed: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
};

export const TRIAL_TONE = {
  setup: "bg-zinc-100 text-zinc-600",
  completed: "bg-emerald-50 text-emerald-700",
  "needs-input": "bg-amber-50 text-amber-700",
  running: "bg-blue-50 text-blue-700",
  failed: "bg-rose-50 text-rose-700",
} as const;

export const PROGRESS_TONE: Record<ProgressStep["status"], string> = {
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200/70",
  active: "bg-blue-50 text-blue-700 ring-blue-200/70",
  queued: "bg-zinc-100 text-zinc-500 ring-zinc-200",
  blocked: "bg-amber-50 text-amber-700 ring-amber-200/80",
};

export const CHANGE_TONE: Record<ExperimentChange["status"], string> = {
  applied: "bg-blue-50 text-blue-700 ring-blue-200/70",
  validated: "bg-emerald-50 text-emerald-700 ring-emerald-200/70",
  planned: "bg-zinc-100 text-zinc-500 ring-zinc-200",
};

export function statusLabel(status: Status | ExperimentTrial["status"]) {
  if (status === "needs-input") return "Needs input";
  if (status === "setup") return "Setup";
  if (status === "running") return "Running";
  if (status === "completed") return "Completed";
  if (status === "failed") return "Failed";
  return status;
}
export function EmptyState({
  title,
  body,
}: {
  title: string;
  body?: string;
}) {
  return (
    <div className="rounded-2xl bg-zinc-50/70 px-4 py-8 text-center ring-1 ring-zinc-950/5">
      <p className="text-sm font-medium text-zinc-900">{title}</p>
      {body && <p className="mt-1 text-sm text-zinc-500">{body}</p>}
    </div>
  );
}

export function ComingSoonPanel({ title }: { title: string }) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-white/65 p-4 ring-1 ring-zinc-950/5">
      <div className="pointer-events-none select-none space-y-3 opacity-50 blur-[1.5px]">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          {title}
        </p>
        <div className="space-y-2">
          <div className="h-3 w-3/4 rounded-full bg-zinc-200" />
          <div className="h-3 w-1/2 rounded-full bg-zinc-200" />
          <div className="h-3 w-2/3 rounded-full bg-zinc-200" />
        </div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-white/45">
        <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white shadow-sm">
          Coming soon
        </span>
      </div>
    </section>
  );
}

export type WorkflowPageItem = {
  id: string;
  label: string;
  detail?: string;
  badge?: ReactNode;
};

export function WorkflowPageLayout({
  pages,
  activePage,
  onPageChange,
  children,
  ariaLabel = "Workflow pages",
}: {
  pages: WorkflowPageItem[];
  activePage: string;
  onPageChange: (pageId: string) => void;
  children: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl bg-white/75 ring-1 ring-zinc-200/80 md:flex-row">
      <aside className="shrink-0 border-b border-zinc-200/80 bg-zinc-50/80 px-3 py-3 md:h-full md:w-64 md:border-b-0 md:border-r md:overflow-y-auto">
        <nav
          aria-label={ariaLabel}
          className="flex gap-2 overflow-x-auto scrollbar-hidden md:flex-col md:overflow-visible"
        >
          {pages.map((page) => {
            const selected = page.id === activePage;

            return (
              <button
                key={page.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onPageChange(page.id)}
                className={`min-w-44 rounded-xl border px-3 py-2.5 text-left transition-colors md:min-w-0 ${
                  selected
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-transparent bg-white/65 text-zinc-600 hover:bg-white hover:text-zinc-900"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">
                    {page.label}
                  </span>
                  {page.badge}
                </span>
                {page.detail && (
                  <span
                    className={`mt-0.5 block truncate text-xs ${
                      selected ? "text-blue-600" : "text-zinc-400"
                    }`}
                  >
                    {page.detail}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="min-h-0 flex-1 overflow-hidden bg-white">{children}</div>
    </section>
  );
}
