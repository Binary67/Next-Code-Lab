import ExperimentCard from "@/components/experiment-card";
import { PlusIcon } from "@/components/icons";
import type { Experiment } from "@/lib/experiments";
import type { TabId } from "./types";

const TABS: { id: TabId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "setup", label: "Setup" },
  { id: "running", label: "Running" },
  { id: "needs-input", label: "Needs input" },
  { id: "completed", label: "Completed" },
  { id: "failed", label: "Failed" },
];

export function ExperimentList({
  experiments,
  activeTab,
  onTabChange,
  onCreate,
  onOpen,
  onDelete,
}: {
  experiments: Experiment[];
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  onCreate: () => void;
  onOpen: (experiment: Experiment) => void;
  onDelete: (experiment: Experiment) => void;
}) {
  const needsInputCount = experiments.filter(
    (experiment) => experiment.status === "needs-input",
  ).length;
  const setupCount = experiments.filter(
    (experiment) => experiment.status === "setup",
  ).length;
  const visible =
    activeTab === "all"
      ? experiments
      : experiments.filter((experiment) => experiment.status === activeTab);

  return (
    <div className="mx-auto w-full max-w-5xl overflow-y-auto px-8 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Experiments
        </h1>
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-800 active:scale-[0.99]"
        >
          <PlusIcon className="h-4 w-4" />
          New Experiment
        </button>
      </div>

      <div className="mt-5 flex items-center gap-6 border-b border-zinc-200">
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          const count =
            tab.id === "setup"
              ? setupCount
              : tab.id === "needs-input"
                ? needsInputCount
                : 0;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`-mb-px flex items-center gap-2 border-b-2 pb-3 text-sm transition-colors ${
                active
                  ? "border-blue-700 font-medium text-blue-700"
                  : "border-transparent text-zinc-500 hover:text-zinc-800"
              }`}
            >
              {tab.label}
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
                onDelete={onDelete}
                onOpen={onOpen}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
