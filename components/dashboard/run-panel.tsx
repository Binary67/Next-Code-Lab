import { useEffect, useRef, useState } from "react";
import type { Experiment } from "@/lib/experiments";
import {
  EmptyState,
  TRIAL_TONE,
  WorkflowPageLayout,
  statusLabel,
} from "./shared";
import type { WorkflowPageItem } from "./shared";

type TrialLogState =
  | { status: "idle" }
  | { status: "loading"; trialId: string }
  | {
      status: "loaded";
      trialId: string;
      markdown: string;
      updatedAt?: string;
    }
  | { status: "error"; trialId: string; message: string };

export function RunPanel({
  experiment,
  metricName,
}: {
  experiment: Experiment;
  metricName: string;
}) {
  const defaultTrial =
    experiment.trials.find((trial) => trial.status === "running") ??
    experiment.trials[0];
  const defaultTrialId = defaultTrial?.id ?? null;
  const [manualSelection, setManualSelection] = useState<{
    experimentId: string;
    trialId: string;
  } | null>(null);
  const [logState, setLogState] = useState<TrialLogState>({ status: "idle" });
  const logScrollRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottomRef = useRef(true);
  const manualTrialId =
    manualSelection?.experimentId === experiment.id
      ? manualSelection.trialId
      : null;
  const selectedTrialId =
    manualTrialId &&
    experiment.trials.some((trial) => trial.id === manualTrialId)
      ? manualTrialId
      : defaultTrialId;
  const selectedTrial =
    experiment.trials.find((trial) => trial.id === selectedTrialId) ??
    defaultTrial ??
    null;
  const logIsLive =
    experiment.status === "running" || selectedTrial?.status === "running";

  useEffect(() => {
    shouldStickToBottomRef.current = true;
  }, [selectedTrialId]);

  useEffect(() => {
    if (!selectedTrial) {
      return;
    }

    let canceled = false;
    const url = `/api/experiments/${encodeURIComponent(
      experiment.id,
    )}/trials/${encodeURIComponent(selectedTrial.id)}/log`;

    const loadLog = async () => {
      setLogState((current) =>
        current.status === "loaded" && current.trialId === selectedTrial.id
          ? current
          : { status: "loading", trialId: selectedTrial.id },
      );

      try {
        const response = await fetch(url, { cache: "no-store" });
        const data = (await response.json()) as {
          markdown?: string;
          updatedAt?: string;
          error?: string;
        };

        if (canceled) {
          return;
        }

        if (!response.ok) {
          setLogState({
            status: "error",
            trialId: selectedTrial.id,
            message: data.error ?? "Could not load trial log.",
          });
          return;
        }

        setLogState({
          status: "loaded",
          trialId: selectedTrial.id,
          markdown: data.markdown ?? "",
          updatedAt: data.updatedAt,
        });
      } catch (error) {
        if (!canceled) {
          setLogState({
            status: "error",
            trialId: selectedTrial.id,
            message: error instanceof Error ? error.message : "Request failed.",
          });
        }
      }
    };

    void loadLog();

    if (!logIsLive) {
      return () => {
        canceled = true;
      };
    }

    const interval = window.setInterval(() => void loadLog(), 1000);

    return () => {
      canceled = true;
      window.clearInterval(interval);
    };
  }, [experiment.id, logIsLive, selectedTrial]);

  useEffect(() => {
    const element = logScrollRef.current;

    if (!element || !shouldStickToBottomRef.current) {
      return;
    }

    element.scrollTop = element.scrollHeight;
  }, [logState]);

  const onLogScroll = () => {
    const element = logScrollRef.current;

    if (!element) {
      return;
    }

    const distanceFromBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    shouldStickToBottomRef.current = distanceFromBottom < 48;
  };
  const pages: WorkflowPageItem[] =
    experiment.trials.length === 0
      ? [
          {
            id: "no-trials",
            label: "Trial history",
            detail: "No trials yet",
          },
        ]
      : experiment.trials.map((trial) => ({
          id: trial.id,
          label: trial.id,
          detail: trial.title,
          badge: (
            <span
              className={`rounded-full px-1.5 text-[11px] font-medium capitalize ring-1 ring-inset ring-black/5 ${
                TRIAL_TONE[trial.status]
              }`}
            >
              {statusLabel(trial.status)}
            </span>
          ),
        }));

  return (
    <WorkflowPageLayout
      pages={pages}
      activePage={selectedTrialId ?? "no-trials"}
      onPageChange={(pageId) => {
        if (pageId === "no-trials") return;
        setManualSelection({
          experimentId: experiment.id,
          trialId: pageId,
        });
      }}
      ariaLabel="Run trials"
    >
      <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-white p-4">
        {selectedTrial ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-xs font-semibold text-zinc-500">
                  {selectedTrial.id}
                </p>
                <h2 className="mt-1 truncate text-base font-semibold tracking-tight text-zinc-900">
                  {selectedTrial.title}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {logIsLive && (
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 ring-1 ring-inset ring-blue-200/70">
                    Live
                  </span>
                )}
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ring-1 ring-inset ring-black/5 ${
                    TRIAL_TONE[selectedTrial.status]
                  }`}
                >
                  {statusLabel(selectedTrial.status)}
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs text-zinc-400">{metricName}</p>
                <p className="mt-1 font-semibold text-zinc-900">
                  {selectedTrial.metricValue}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-400">Duration</p>
                <p className="mt-1 font-semibold text-zinc-900">
                  {selectedTrial.duration}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-400">Updated</p>
                <p className="mt-1 truncate font-mono text-xs font-semibold text-zinc-900">
                  {logState.status === "loaded" && logState.updatedAt
                    ? new Date(logState.updatedAt).toLocaleTimeString()
                    : "Waiting"}
                </p>
              </div>
            </div>

            <div
              ref={logScrollRef}
              onScroll={onLogScroll}
              className="mt-5 min-h-0 flex-1 overflow-auto rounded-xl bg-zinc-50/80 text-xs ring-1 ring-zinc-950/10"
            >
              {logState.status === "loading" ? (
                <div className="space-y-2 p-4">
                  <div className="h-3 w-2/5 rounded-full bg-zinc-200" />
                  <div className="h-3 w-4/5 rounded-full bg-zinc-200" />
                  <div className="h-3 w-3/5 rounded-full bg-zinc-200" />
                </div>
              ) : logState.status === "error" ? (
                <div className="p-4">
                  <EmptyState
                    title="Could not load trial log."
                    body={logState.message}
                  />
                </div>
              ) : logState.status === "loaded" && logState.markdown.trim() ? (
                <pre className="whitespace-pre-wrap break-words px-4 py-4 font-mono leading-5 text-zinc-700">
                  {logState.markdown}
                </pre>
              ) : (
                <div className="p-4">
                  <EmptyState title="Trial log will appear when Codex starts work." />
                </div>
              )}
            </div>
          </>
        ) : (
          <EmptyState
            title="No trials yet."
            body="Run the experiment to create live trial logs."
          />
        )}
      </section>
    </WorkflowPageLayout>
  );
}
