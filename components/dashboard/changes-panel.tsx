import { useEffect, useState } from "react";
import { readTrialDiff } from "@/app/actions";
import type { Experiment } from "@/lib/experiments";
import {
  EmptyState,
  TRIAL_TONE,
  WorkflowPageLayout,
  statusLabel,
} from "./shared";
import type { WorkflowPageItem } from "./shared";
import {
  DiffContent,
  type TrialDiff,
  type TrialDiffState,
} from "./trial-diff-content";
import { getBestTrial, getTrialDelta } from "./trial-score";

export function ChangesPanel({ experiment }: { experiment: Experiment }) {
  const scoreName =
    experiment.evaluation.scoreName || experiment.metricLabel || "Score";
  const bestTrial = getBestTrial(
    experiment.trials,
    experiment.evaluation.scoreDirection,
  );
  const defaultTrialId = bestTrial?.id ?? experiment.trials[0]?.id ?? null;
  const [manualSelection, setManualSelection] = useState<{
    experimentId: string;
    trialId: string;
  } | null>(null);
  const [diffState, setDiffState] = useState<TrialDiffState>({
    status: "idle",
  });
  const [diffCache, setDiffCache] = useState<Record<string, TrialDiff>>({});
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
    experiment.trials.find((trial) => trial.id === defaultTrialId) ??
    null;
  const selectedTrialTarget =
    selectedTrial?.commitSha ?? selectedTrial?.branchName ?? "";
  const selectedDiffKey =
    selectedTrial && experiment.baseCommit && selectedTrialTarget
      ? [
          experiment.id,
          experiment.baseCommit,
          selectedTrial.id,
          selectedTrialTarget,
        ].join(":")
      : null;
  const cachedDiff = selectedDiffKey ? diffCache[selectedDiffKey] : undefined;
  const renderedDiffState: TrialDiffState = (() => {
    if (!selectedTrial) {
      return { status: "idle" };
    }

    if (!selectedDiffKey) {
      return { status: "empty", message: "No diff available." };
    }

    if (cachedDiff) {
      return { status: "loaded", key: selectedDiffKey, data: cachedDiff };
    }

    if (diffState.status === "loaded" && diffState.key === selectedDiffKey) {
      return diffState;
    }

    if (diffState.status === "error" && diffState.key === selectedDiffKey) {
      return diffState;
    }

    return { status: "loading", trialId: selectedTrial.id };
  })();

  useEffect(() => {
    if (!selectedTrial || !experiment.baseCommit || !selectedDiffKey) {
      return;
    }

    if (cachedDiff) {
      return;
    }

    let canceled = false;

    readTrialDiff({
      experimentId: experiment.id,
      repoPath: experiment.repo,
      baseCommit: experiment.baseCommit,
      trialId: selectedTrial.id,
      commitSha: selectedTrial.commitSha,
      branchName: selectedTrial.branchName,
    })
      .then((result) => {
        if (canceled) {
          return;
        }

        if (result.ok) {
          setDiffCache((current) => ({
            ...current,
            [selectedDiffKey]: result.data,
          }));
          setDiffState({
            status: "loaded",
            key: selectedDiffKey,
            data: result.data,
          });
          return;
        }

        setDiffState({
          status: "error",
          key: selectedDiffKey,
          message: result.error,
        });
      })
      .catch((error: unknown) => {
        if (!canceled) {
          setDiffState({
            status: "error",
            key: selectedDiffKey,
            message: error instanceof Error ? error.message : "Request failed.",
          });
        }
      });

    return () => {
      canceled = true;
    };
  }, [
    cachedDiff,
    experiment.baseCommit,
    experiment.id,
    experiment.repo,
    selectedTrial,
    selectedDiffKey,
    selectedTrialTarget,
  ]);
  const pages: WorkflowPageItem[] =
    experiment.trials.length === 0
      ? [
          {
            id: "no-trials",
            label: "Trial changes",
            detail: "No trials yet",
          },
        ]
      : experiment.trials.map((trial) => {
          const delta = getTrialDelta(trial, experiment.baselineScore);
          const detail = [
            trial.metricValue,
            trial.duration,
            delta?.value,
          ].filter(Boolean);

          return {
            id: trial.id,
            label: trial.id,
            detail: detail.join(" | "),
            badge: (
              <span className="flex shrink-0 items-center gap-1">
                {bestTrial?.id === trial.id && (
                  <span className="rounded-full bg-emerald-50 px-1.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200/70">
                    Best
                  </span>
                )}
                <span
                  className={`rounded-full px-1.5 text-[11px] font-medium capitalize ring-1 ring-inset ring-black/5 ${
                    TRIAL_TONE[trial.status]
                  }`}
                >
                  {statusLabel(trial.status)}
                </span>
              </span>
            ),
          };
        });

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
      ariaLabel="Change trials"
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
                {bestTrial?.id === selectedTrial.id && (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200/70">
                    Best
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
                <p className="text-xs text-zinc-400">{scoreName}</p>
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
                <p className="text-xs text-zinc-400">Target ref</p>
                <p className="mt-1 truncate font-mono text-xs font-semibold text-zinc-900">
                  {selectedTrialTarget || "None"}
                </p>
              </div>
            </div>

            <DiffContent state={renderedDiffState} />
          </>
        ) : (
          <EmptyState
            title="No trials yet."
            body="Run the experiment to create trial diffs."
          />
        )}
      </section>
    </WorkflowPageLayout>
  );
}
