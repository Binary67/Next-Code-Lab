import { useState } from "react";
import type {
  Experiment,
  ExperimentChange,
  ExperimentTrial,
  ProgressStep,
} from "@/lib/experiments";
import {
  ArrowDownIcon,
  Avatar,
  FlaskIcon,
  WarningIcon,
} from "@/components/icons";
import {
  CHANGE_TONE,
  ComingSoonPanel,
  EmptyState,
  PROGRESS_TONE,
  TRIAL_TONE,
  inputClass,
  statusLabel,
} from "./shared";

function evalProgressLabel(trial: ExperimentTrial, evalBudgetPerTrial: number) {
  if (trial.evalsUsed === undefined) {
    return undefined;
  }

  return `${trial.evalsUsed} of ${evalBudgetPerTrial} ${
    evalBudgetPerTrial === 1 ? "eval" : "evals"
  }`;
}

function RunProgressSteps({ steps }: { steps: ProgressStep[] }) {
  if (steps.length === 0) {
    return <EmptyState title="Progress will appear after setup starts." />;
  }

  const current =
    steps.find((step) => step.status === "blocked") ??
    steps.find((step) => step.status === "active") ??
    steps[0];
  const queued = steps.filter((step) => step.status === "queued");

  return (
    <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-2xl bg-white/65 p-4 ring-1 ring-zinc-950/5">
        <h2 className="text-base font-semibold tracking-tight text-zinc-900">
          Run progress
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Current step, recent work, and queued actions.
        </p>

        <div className="mt-5 divide-y divide-zinc-200/70">
          {steps.map((step) => (
            <article
              key={step.id}
              className="grid gap-3 py-4 first:pt-0 sm:grid-cols-[8rem_1fr]"
            >
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

export function RunPanel({
  experiment,
  metricName,
}: {
  experiment: Experiment;
  metricName: string;
}) {
  const currentTrial =
    experiment.trials.find((trial) => trial.status === "running") ??
    experiment.trials[0];
  const currentTrialId = currentTrial?.id ?? null;
  const [expandedState, setExpandedState] = useState<{
    currentTrialId: string | null;
    expandedTrialId: string | null;
  } | null>(null);
  const expandedTrialId =
    expandedState?.currentTrialId === currentTrialId
      ? expandedState.expandedTrialId
      : currentTrialId;

  return (
    <section className="space-y-5">
      <RunProgressSteps steps={experiment.progressSteps} />

      <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <section className="rounded-2xl bg-zinc-50/70 p-4 ring-1 ring-zinc-950/5">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Current trial
          </p>
          {currentTrial ? (
            <>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs font-semibold text-zinc-900">
                    {currentTrial.id}
                  </p>
                  <h2 className="mt-1 truncate text-base font-semibold text-zinc-900">
                    {currentTrial.title}
                  </h2>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ring-1 ring-inset ring-black/5 ${
                    TRIAL_TONE[currentTrial.status]
                  }`}
                >
                  {statusLabel(currentTrial.status)}
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-zinc-500">
                {currentTrial.summary}
              </p>
              <div className="mt-4 divide-y divide-zinc-200/70 text-sm">
                <div className="flex items-center justify-between gap-3 py-2 first:pt-0">
                  <span className="text-zinc-500">{metricName}</span>
                  <span className="font-semibold text-zinc-900">
                    {currentTrial.metricValue}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 py-2">
                  <span className="text-zinc-500">Duration</span>
                  <span className="font-semibold text-zinc-900">
                    {currentTrial.duration}
                  </span>
                </div>
                {currentTrial.evalsUsed !== undefined && (
                  <div className="flex items-center justify-between gap-3 py-2 last:pb-0">
                    <span className="text-zinc-500">Eval progress</span>
                    <span className="font-semibold text-zinc-900">
                      {evalProgressLabel(
                        currentTrial,
                        experiment.evalBudgetPerTrial,
                      )}
                    </span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="mt-3">
              <EmptyState
                title="No trials yet."
                body="Start the experiment after evaluation setup to create the first trial."
              />
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-white/65 p-4 ring-1 ring-zinc-950/5">
          <h2 className="text-base font-semibold tracking-tight text-zinc-900">
            Trial history
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Latest attempts and measured outcomes.
          </p>

          {experiment.trials.length === 0 ? (
            <div className="mt-5">
              <EmptyState title="No trials yet." />
            </div>
          ) : (
            <div className="mt-5 divide-y divide-zinc-200/70 overflow-hidden rounded-2xl bg-white/55 ring-1 ring-zinc-950/5">
              {experiment.trials.map((trial) => {
                const expanded = expandedTrialId === trial.id;
                const evalProgress = evalProgressLabel(
                  trial,
                  experiment.evalBudgetPerTrial,
                );

                return (
                  <article key={trial.id}>
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={`trial-${trial.id}-details`}
                      onClick={() =>
                        setExpandedState({
                          currentTrialId,
                          expandedTrialId: expanded ? null : trial.id,
                        })
                      }
                      className="grid w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50/80 sm:grid-cols-[1fr_auto]"
                    >
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
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-400">
                          <span>{trial.duration}</span>
                          {evalProgress && (
                            <span>Eval progress: {evalProgress}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-start justify-between gap-3 sm:justify-end">
                        <div className="text-left sm:text-right">
                          <p className="text-xs text-zinc-400">{metricName}</p>
                          <p className="mt-0.5 text-sm font-semibold text-zinc-900">
                            {trial.metricValue}
                          </p>
                        </div>
                        <ArrowDownIcon
                          className={`mt-0.5 h-4 w-4 shrink-0 text-zinc-400 transition-transform ${
                            expanded ? "rotate-180" : ""
                          }`}
                        />
                      </div>
                    </button>

                    {expanded && (
                      <div
                        id={`trial-${trial.id}-details`}
                        className="px-4 pb-4 text-sm leading-relaxed text-zinc-500"
                      >
                        {trial.summary}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </section>
  );
}

export function ChangesPanel({ changes }: { changes: ExperimentChange[] }) {
  return (
    <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
      <section className="rounded-2xl bg-white/65 p-4 ring-1 ring-zinc-950/5">
        <h2 className="text-base font-semibold tracking-tight text-zinc-900">
          Changes
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Files, patches, and validation state for this experiment.
        </p>

        {changes.length === 0 ? (
          <div className="mt-5">
            <EmptyState title="No changes recorded yet." />
          </div>
        ) : (
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
        )}
      </section>

      <aside className="space-y-5">
        <ComingSoonPanel title="Validation summary" />
        <ComingSoonPanel title="Review focus" />
      </aside>
    </section>
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
  const canReply = experiment.status !== "setup";

  const addReply = (text: string) => {
    if (!canReply) return;

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

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 scrollbar-hidden">
        {experiment.agentMessages.length === 0 && !experiment.pendingQuestion && (
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
}
