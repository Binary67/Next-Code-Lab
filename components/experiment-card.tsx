import type { Experiment, Status } from "@/lib/experiments";
import {
  ArrowDownIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  PauseIcon,
  TrashIcon,
  WarningIcon,
} from "@/components/icons";

const STATUS_BADGE: Record<
  Status,
  { label: string; className: string; icon: "dot" | "warn" | "check" }
> = {
  setup: {
    label: "Setup",
    className: "bg-zinc-100 text-zinc-700",
    icon: "dot",
  },
  running: {
    label: "Running",
    className: "bg-blue-50 text-blue-700",
    icon: "dot",
  },
  "needs-input": {
    label: "Needs input",
    className: "bg-amber-500 text-white",
    icon: "warn",
  },
  completed: {
    label: "Completed",
    className: "bg-zinc-100 text-zinc-500",
    icon: "check",
  },
};

function StatusBadge({ status }: { status: Status }) {
  const badge = STATUS_BADGE[status];
  const dotClass = status === "setup" ? "bg-zinc-500" : "bg-blue-600";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${badge.className}`}
    >
      {badge.icon === "dot" && (
        <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      )}
      {badge.icon === "warn" && <WarningIcon className="h-3.5 w-3.5" />}
      {badge.icon === "check" && <CheckCircleIcon className="h-3.5 w-3.5" />}
      {badge.label}
    </span>
  );
}

export default function ExperimentCard({
  experiment,
  onDelete,
  onOpen,
}: {
  experiment: Experiment;
  onDelete: (experiment: Experiment) => void;
  onOpen: (experiment: Experiment) => void;
}) {
  const needsInput = experiment.status === "needs-input";
  const inSetup = experiment.status === "setup";
  const needsEvaluation =
    inSetup && experiment.evaluation.status !== "ready";

  return (
    <article
      className={`group flex h-full flex-col overflow-hidden rounded-xl bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
        needsInput || needsEvaluation
          ? "border border-amber-400 shadow-sm ring-1 ring-amber-100"
          : "border border-zinc-200 shadow-sm hover:border-zinc-300"
      }`}
    >
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-500">
            {experiment.repo}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <StatusBadge status={experiment.status} />
            <button
              type="button"
              onClick={() => onDelete(experiment)}
              aria-label={`Delete ${experiment.title}`}
              title="Delete experiment"
              className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-100"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onOpen(experiment)}
          className="mt-3 block text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
        >
          <h3 className="text-[17px] font-semibold tracking-tight text-zinc-900 transition-colors group-hover:text-blue-700">
            {experiment.title}
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
            {experiment.description}
          </p>
        </button>

        <div className="mt-auto pt-4">
          <div className="h-px bg-zinc-100" />
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-zinc-400">{experiment.metricLabel}</p>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="text-lg font-semibold text-zinc-900">
                {experiment.metricValue}
              </span>
              {experiment.delta && (
                <span className="inline-flex items-center gap-0.5 text-xs font-medium text-blue-600">
                  <ArrowDownIcon className="h-3.5 w-3.5" />
                  {experiment.delta.value}
                </span>
              )}
              {needsInput && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400">
                  <PauseIcon className="h-3.5 w-3.5" />
                  Halted
                </span>
              )}
              {inSetup && (
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium ${
                    experiment.evaluation.status === "ready"
                      ? "text-emerald-600"
                      : "text-amber-600"
                  }`}
                >
                  {experiment.evaluation.status === "ready" ? (
                    <CheckCircleIcon className="h-3.5 w-3.5" />
                  ) : (
                    <WarningIcon className="h-3.5 w-3.5" />
                  )}
                  {experiment.evaluation.status === "ready"
                    ? "Evaluation ready"
                    : "Evaluation needed"}
                </span>
              )}
            </div>
          </div>

          {needsInput || inSetup ? (
            <button
              type="button"
              onClick={() => onOpen(experiment)}
              className="inline-flex items-center gap-1 text-sm font-medium text-zinc-700 transition-colors hover:text-blue-700"
            >
              {inSetup ? "Configure evaluation" : "Open workspace"}
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onOpen(experiment)}
              className="flex items-center gap-2 text-sm font-medium text-zinc-700 transition-colors hover:text-blue-700"
            >
              <span className="font-mono text-xs text-zinc-400">
                {experiment.timing}
              </span>
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
