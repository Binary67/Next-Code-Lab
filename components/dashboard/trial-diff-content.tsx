import { EmptyState } from "./shared";

export type TrialDiff = {
  trialId: string;
  targetRef: string;
  diff: string;
};

export type TrialDiffState =
  | { status: "idle" }
  | { status: "loading"; trialId: string }
  | { status: "loaded"; key: string; data: TrialDiff }
  | { status: "empty"; message: string }
  | { status: "error"; key: string; message: string };

function diffLineClass(line: string) {
  if (line.startsWith("diff --git")) {
    return "bg-zinc-900 text-white";
  }

  if (
    line.startsWith("index ") ||
    line.startsWith("--- ") ||
    line.startsWith("+++ ")
  ) {
    return "bg-zinc-100 text-zinc-600";
  }

  if (line.startsWith("@@")) {
    return "bg-blue-50 text-blue-700";
  }

  if (line.startsWith("+")) {
    return "bg-emerald-50 text-emerald-800";
  }

  if (line.startsWith("-")) {
    return "bg-rose-50 text-rose-800";
  }

  return "text-zinc-600";
}

export function DiffContent({ state }: { state: TrialDiffState }) {
  if (state.status === "idle") {
    return (
      <div className="mt-5">
        <EmptyState title="Select a trial to inspect its diff." />
      </div>
    );
  }

  if (state.status === "loading") {
    return (
      <div className="mt-5 space-y-2 rounded-xl bg-zinc-50/70 p-4 ring-1 ring-zinc-950/5">
        <div className="h-3 w-2/5 rounded-full bg-zinc-200" />
        <div className="h-3 w-4/5 rounded-full bg-zinc-200" />
        <div className="h-3 w-3/5 rounded-full bg-zinc-200" />
      </div>
    );
  }

  if (state.status === "empty") {
    return (
      <div className="mt-5">
        <EmptyState title={state.message} />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="mt-5">
        <EmptyState title="Could not load diff." body={state.message} />
      </div>
    );
  }

  const lines = state.data.diff.split("\n");

  if (!state.data.diff.trim()) {
    return (
      <div className="mt-5">
        <EmptyState title="No code changes in this trial." />
      </div>
    );
  }

  return (
    <div className="mt-5 min-h-0 flex-1 overflow-auto rounded-xl bg-white text-xs ring-1 ring-zinc-950/10">
      <pre className="min-w-max py-2 font-mono leading-5">
        {lines.map((line, index) => (
          <div
            key={`${state.data.targetRef}-${index}`}
            className={`px-4 ${diffLineClass(line)}`}
          >
            {line === "" ? " " : line}
          </div>
        ))}
      </pre>
    </div>
  );
}
