import { useEffect, useRef, useState } from "react";
import { readTrialDiff } from "@/app/actions";
import type {
  Experiment,
  ExperimentTrial,
} from "@/lib/experiments";
import {
  Avatar,
  FlaskIcon,
  WarningIcon,
} from "@/components/icons";
import {
  EmptyState,
  TRIAL_TONE,
  WorkflowPageLayout,
  inputClass,
  statusLabel,
} from "./shared";
import type { WorkflowPageItem } from "./shared";

type TrialDiff = {
  trialId: string;
  targetRef: string;
  diff: string;
};

type TrialDiffState =
  | { status: "idle" }
  | { status: "loading"; trialId: string }
  | { status: "loaded"; key: string; data: TrialDiff }
  | { status: "empty"; message: string }
  | { status: "error"; key: string; message: string };

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

type AgentCollabPageId = "conversation" | "pending-input";

function formatScoreValue(value: number) {
  return Number.isInteger(value)
    ? String(value)
    : String(Number(value.toFixed(6)));
}

function getBestTrial(
  trials: ExperimentTrial[],
  direction: Experiment["evaluation"]["scoreDirection"],
) {
  const scored = trials.filter(
    (trial): trial is ExperimentTrial & { score: number } =>
      Boolean(trial.improved && Number.isFinite(trial.score)),
  );

  if (scored.length === 0) {
    return null;
  }

  if (!direction) {
    return scored[0];
  }

  return scored.reduce((best, trial) => {
    const better =
      direction === "minimize" ? trial.score < best.score : trial.score > best.score;
    return better ? trial : best;
  });
}

function getTrialDelta(
  trial: ExperimentTrial,
  baselineScore: number | undefined,
) {
  if (!Number.isFinite(trial.score) || !Number.isFinite(baselineScore)) {
    return null;
  }

  const delta = (trial.score as number) - (baselineScore as number);
  const sign = delta > 0 ? "+" : delta < 0 ? "-" : "";

  return {
    value: `${sign}${formatScoreValue(Math.abs(delta))}`,
    raw: delta,
  };
}

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

function DiffContent({ state }: { state: TrialDiffState }) {
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
          <div key={`${state.data.targetRef}-${index}`} className={`px-4 ${diffLineClass(line)}`}>
            {line === "" ? " " : line}
          </div>
        ))}
      </pre>
    </div>
  );
}

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

export function AgentCollab({
  experiment,
  onAnswer,
  onSendReply,
}: {
  experiment: Experiment;
  onAnswer: (experiment: Experiment, answer: string) => void;
  onSendReply: (experiment: Experiment, text: string) => void;
}) {
  const [reply, setReply] = useState("");
  const [pageSelection, setPageSelection] = useState<{
    experimentId: string;
    page: AgentCollabPageId;
  }>(() => ({
    experimentId: experiment.id,
    page: "conversation",
  }));
  const canReply = experiment.status !== "setup";
  const hasPendingInput =
    experiment.status === "needs-input" && Boolean(experiment.pendingQuestion);
  const selectedPage =
    pageSelection.experimentId === experiment.id
      ? pageSelection.page
      : "conversation";
  const activePage =
    selectedPage === "pending-input" && !hasPendingInput
      ? "conversation"
      : selectedPage;
  const pages: WorkflowPageItem[] = [
    {
      id: "conversation",
      label: "Conversation",
      detail: `${experiment.agentMessages.length} messages`,
    },
    ...(hasPendingInput
      ? [
          {
            id: "pending-input",
            label: "Pending Input",
            detail: "User input required",
            badge: (
              <span className="rounded-full bg-amber-100 px-1.5 text-[11px] font-medium text-amber-700">
                Input
              </span>
            ),
          },
        ]
      : []),
  ];

  const addReply = (text: string) => {
    if (!canReply) return;

    const trimmed = text.trim();
    if (!trimmed) return;

    onSendReply(experiment, trimmed);
    setReply("");
  };
  const setAgentPage = (page: AgentCollabPageId) => {
    setPageSelection({ experimentId: experiment.id, page });
  };

  const conversationPage = (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-zinc-50/70">
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

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5">
        {experiment.agentMessages.length === 0 && (
          <EmptyState title="Runtime collaboration starts after the experiment starts." />
        )}

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
          disabled={!canReply}
          placeholder={
            canReply
              ? "Reply to agent..."
              : "Start the experiment before using runtime collab."
          }
          className={`${inputClass} resize-none`}
        />
        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-zinc-400">
            {canReply ? "Press Enter to send" : "Runtime collab is locked during setup"}
          </p>
          <button
            type="submit"
            disabled={!canReply || !reply.trim()}
            className="rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </section>
  );

  const pendingInputPage = (
    <div className="h-full overflow-y-auto bg-white p-4 scrollbar-hidden">
      {hasPendingInput && experiment.pendingQuestion ? (
        <section className="rounded-2xl bg-amber-50/80 p-4 ring-1 ring-amber-200/80">
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
        </section>
      ) : (
        <EmptyState title="No pending input." />
      )}
    </div>
  );

  return (
    <WorkflowPageLayout
      pages={pages}
      activePage={activePage}
      onPageChange={(pageId) => setAgentPage(pageId as AgentCollabPageId)}
      ariaLabel="Agent collaboration pages"
    >
      {activePage === "pending-input" ? pendingInputPage : conversationPage}
    </WorkflowPageLayout>
  );
}
