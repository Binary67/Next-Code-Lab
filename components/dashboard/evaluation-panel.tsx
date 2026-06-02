import { useState } from "react";
import type {
  EvaluationMode,
  Experiment,
  ExperimentEvaluation,
  ScoreDirection,
} from "@/lib/experiments";
import type { EvalSetupPendingAction } from "./types";
import { inputClass } from "./shared";
import {
  directionLabel,
  evalSetupPendingLabel,
  evaluationStatusLabel,
  getMissingEvaluationFields,
} from "./evaluation-utils";

const SCORE_DIRECTIONS: {
  id: ScoreDirection;
  label: string;
  detail: string;
}[] = [
  { id: "minimize", label: "Minimize", detail: "Lower score is better" },
  { id: "maximize", label: "Maximize", detail: "Higher score is better" },
];
export function EvaluationPanel({
  experiment,
  pendingAction,
  onChange,
  onChangeRunSettings,
  onStartInterview,
  onSendSetupReply,
  onApproveGenerated,
}: {
  experiment: Experiment;
  pendingAction?: EvalSetupPendingAction;
  onChange: (
    experiment: Experiment,
    patch: Partial<ExperimentEvaluation>,
  ) => void;
  onChangeRunSettings: (
    experiment: Experiment,
    patch: Partial<Pick<Experiment, "trialCount" | "evalBudgetPerTrial">>,
  ) => void;
  onStartInterview: (experiment: Experiment) => void;
  onSendSetupReply: (experiment: Experiment, text: string) => void;
  onApproveGenerated: (experiment: Experiment) => void;
}) {
  const [reply, setReply] = useState("");
  const evaluation = experiment.evaluation;
  const isEvalSetupPending = Boolean(pendingAction);
  const canUseSetupChat =
    !evaluation.generatedScriptApproved && !isEvalSetupPending;
  const missingFields = getMissingEvaluationFields(evaluation);
  const isReady = evaluation.status === "ready";
  const hasActiveEvalContract = evaluation.mode === "existing" || isReady;
  const canEditRunSettings = experiment.status === "setup";
  const unsetContractValue = (
    <span className="shrink-0 font-medium text-zinc-500">Not set</span>
  );
  const modeOptions: { id: EvaluationMode; label: string; detail: string }[] = [
    {
      id: "existing",
      label: "Use existing script",
      detail: "Fill the eval contract directly.",
    },
    {
      id: "generated",
      label: "Generate with agent",
      detail: "Interview only for eval creation.",
    },
  ];

  const submitReply = (text: string) => {
    if (!canUseSetupChat) return;

    const trimmed = text.trim();
    if (!trimmed) return;

    onSendSetupReply(experiment, trimmed);
    setReply("");
  };

  const sendReply = () => submitReply(reply);
  const updateRunSetting = (
    field: "trialCount" | "evalBudgetPerTrial",
    value: string,
  ) => {
    const parsed = Number.parseInt(value, 10);
    const next = Number.isFinite(parsed) ? Math.max(1, parsed) : 1;

    onChangeRunSettings(experiment, { [field]: next });
  };

  return (
    <section className="grid h-full min-h-0 overflow-y-auto rounded-2xl bg-white/75 ring-1 ring-zinc-200/80 scrollbar-hidden lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)] lg:divide-x lg:divide-zinc-200/80 lg:overflow-hidden">
      <div className="flex min-h-0 flex-col gap-5 bg-white px-4 py-4 scrollbar-hidden lg:overflow-y-auto">
        <section
          className={`rounded-2xl border border-l-4 bg-white p-4 shadow-sm ${
            isReady
              ? "border-emerald-200 border-l-emerald-500"
              : "border-amber-200 border-l-amber-400"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200/80 pb-4">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-zinc-900">
                Evaluation setup
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Define the runnable score contract before starting the experiment.
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
                isReady
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200/80"
                  : "bg-amber-50 text-amber-700 ring-amber-200/80"
              }`}
            >
              {evaluationStatusLabel(evaluation.status)}
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {modeOptions.map((option) => {
              const selected = evaluation.mode === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onChange(experiment, { mode: option.id })}
                  disabled={isEvalSetupPending}
                  className={`rounded-xl px-3.5 py-3 text-left ring-1 transition-colors ${
                    selected
                      ? "bg-blue-50 text-blue-700 ring-blue-200"
                      : "bg-white text-zinc-700 ring-zinc-200 hover:bg-zinc-50"
                  }`}
                >
                  <span className="block text-sm font-semibold">
                    {option.label}
                  </span>
                  <span
                    className={`mt-1 block text-xs ${
                      selected ? "text-blue-600" : "text-zinc-500"
                    }`}
                  >
                    {option.detail}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {evaluation.mode === "existing" ? (
          <section className="rounded-2xl border border-l-4 border-zinc-200 border-l-blue-500 bg-zinc-50/80 p-4 shadow-sm">
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                  Eval script path
                </label>
                <input
                  value={evaluation.scriptPath}
                  onChange={(e) =>
                    onChange(experiment, { scriptPath: e.target.value })
                  }
                  placeholder=".local/evals/my-eval.mjs"
                  className={`${inputClass} font-mono`}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                  Run command
                </label>
                <input
                  value={evaluation.runCommand}
                  onChange={(e) =>
                    onChange(experiment, { runCommand: e.target.value })
                  }
                  placeholder="node .local/evals/my-eval.mjs"
                  className={`${inputClass} font-mono`}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                  Score name
                </label>
                <input
                  value={evaluation.scoreName}
                  onChange={(e) =>
                    onChange(experiment, { scoreName: e.target.value })
                  }
                  placeholder="score"
                  className={inputClass}
                />
              </div>
              <div>
                <p className="mb-1.5 block text-sm font-medium text-zinc-700">
                  Score direction
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {SCORE_DIRECTIONS.map((direction) => {
                    const selected =
                      evaluation.scoreDirection === direction.id;
                    return (
                      <button
                        key={direction.id}
                        type="button"
                        onClick={() =>
                          onChange(experiment, {
                            scoreDirection: direction.id,
                          })
                        }
                        className={`rounded-lg px-3 py-2 text-left ring-1 transition-colors ${
                          selected
                            ? "bg-blue-600 text-white ring-blue-600"
                            : "bg-white text-zinc-700 ring-zinc-200 hover:bg-zinc-50"
                        }`}
                      >
                        <span className="block text-sm font-semibold">
                          {direction.label}
                        </span>
                        <span
                          className={`mt-0.5 block text-[11px] ${
                            selected ? "text-blue-100" : "text-zinc-500"
                          }`}
                        >
                          {direction.detail}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {missingFields.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 px-3.5 py-3 ring-1 ring-amber-200/80">
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    Missing {missingFields.join(", ")}
                  </p>
                  <p className="mt-0.5 text-xs text-amber-700">
                    Fill the template or let the setup agent collect the details.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onStartInterview(experiment)}
                  disabled={isEvalSetupPending}
                  className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-amber-700 ring-1 ring-amber-200 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pendingAction === "start"
                    ? "Starting..."
                    : "Interview to fill gaps"}
                </button>
              </div>
            )}
          </section>
        ) : (
          <section className="flex min-h-[480px] flex-col overflow-hidden rounded-2xl border border-l-4 border-zinc-200 border-l-blue-500 bg-white shadow-sm lg:min-h-0 lg:flex-1">
            <header className="border-b border-zinc-200/80 bg-blue-50/40 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">
                    Eval setup interview
                  </h3>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Thread{" "}
                    <span className="font-mono">
                      {evaluation.evalSetupThreadId ?? "not started"}
                    </span>
                  </p>
                </div>
                {!evaluation.evalSetupThreadId && (
                  <button
                    type="button"
                    onClick={() => onStartInterview(experiment)}
                    disabled={isEvalSetupPending}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {pendingAction === "start" ? "Starting..." : "Start interview"}
                  </button>
                )}
              </div>
            </header>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-zinc-50/75 px-4 py-5 scrollbar-hidden">
              {evaluation.messages.length === 0 ? (
                <div className="rounded-xl bg-white px-4 py-6 text-center ring-1 ring-zinc-200/80">
                  <p className="text-sm font-medium text-zinc-900">
                    {pendingAction
                      ? evalSetupPendingLabel(pendingAction)
                      : "No eval setup messages yet."}
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">
                    {pendingAction
                      ? "This can take a moment."
                      : "Start the interview or describe what the eval should measure."}
                  </p>
                </div>
              ) : (
                <>
                  {evaluation.messages.map((message) => {
                    const fromUser = message.author === "user";
                    return (
                      <div
                        key={message.id}
                        className={`flex ${
                          fromUser ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-3.5 py-3 text-sm leading-relaxed ${
                            fromUser
                              ? "bg-blue-600 text-white shadow-sm"
                              : "bg-white text-zinc-700 ring-1 ring-zinc-200/80"
                          }`}
                        >
                          <p className="whitespace-pre-line">{message.text}</p>
                          {!fromUser && message.choices && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {message.choices.map((choice) => (
                                <button
                                  key={choice}
                                  type="button"
                                  onClick={() => submitReply(choice)}
                                  disabled={!canUseSetupChat}
                                  className="rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200 transition-colors hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {choice}
                                </button>
                              ))}
                            </div>
                          )}
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
                  {pendingAction && (
                    <div className="flex justify-start">
                      <div className="inline-flex max-w-[85%] items-center gap-2 rounded-2xl bg-white px-3.5 py-3 text-sm text-zinc-600 ring-1 ring-zinc-200/80">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                        {evalSetupPendingLabel(pendingAction)}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendReply();
              }}
              className="border-t border-zinc-200/80 bg-white p-4"
            >
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendReply();
                  }
                }}
                rows={3}
                disabled={!canUseSetupChat}
                placeholder={
                  canUseSetupChat
                    ? "Click a suggested metric or type a custom one..."
                    : "Generated eval has been approved."
                }
                className={`${inputClass} resize-none`}
              />
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-zinc-400">
                  You can choose a suggestion or write your own metric
                </p>
                <button
                  type="submit"
                  disabled={!canUseSetupChat || !reply.trim()}
                  className="rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </form>
          </section>
        )}
      </div>

      <aside className="space-y-5 border-t border-zinc-200/80 bg-sky-50/45 px-4 py-4 scrollbar-hidden lg:min-h-0 lg:overflow-y-auto lg:border-t-0">
        {evaluation.mode === "generated" && (
          <section className="rounded-2xl border border-l-4 border-blue-100 border-l-blue-500 bg-white/90 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
              Generated script
            </p>
            {evaluation.proposedContract ? (
              <div className="mt-3 divide-y divide-zinc-200/70 text-sm">
                <div className="flex items-center justify-between gap-3 py-2 first:pt-0">
                  <span className="text-zinc-500">Proposed script</span>
                  <span className="truncate font-mono font-medium text-zinc-900">
                    {evaluation.proposedContract.scriptPath}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 py-2">
                  <span className="text-zinc-500">Command</span>
                  <span className="truncate font-mono font-medium text-zinc-900">
                    {evaluation.proposedContract.runCommand}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 py-2">
                  <span className="text-zinc-500">Score</span>
                  <span className="font-medium text-zinc-900">
                    {evaluation.proposedContract.scoreName}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 py-2 last:pb-0">
                  <span className="text-zinc-500">Direction</span>
                  <span className="font-medium text-zinc-900">
                    {directionLabel(evaluation.proposedContract.scoreDirection)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-zinc-500">
                The setup agent will propose an eval contract before approval.
              </p>
            )}
            <button
              type="button"
              onClick={() => onApproveGenerated(experiment)}
              disabled={
                !evaluation.evalSetupThreadId ||
                !evaluation.proposedContract ||
                evaluation.generatedScriptApproved ||
                isEvalSetupPending
              }
              className="mt-4 w-full rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pendingAction === "approve"
                ? "Writing..."
                : evaluation.generatedScriptApproved
                  ? "Generated eval approved"
                  : "Approve & write eval"}
            </button>
          </section>
        )}

        <section
          className={`rounded-2xl border border-l-4 bg-white/90 p-4 shadow-sm ${
            hasActiveEvalContract
              ? "border-emerald-100 border-l-emerald-500"
              : "border-zinc-200 border-l-zinc-300"
          }`}
        >
          <p
            className={`text-xs font-semibold uppercase tracking-wide ${
              hasActiveEvalContract ? "text-emerald-700" : "text-zinc-400"
            }`}
          >
            {evaluation.mode === "generated"
              ? "Active eval contract"
              : "Eval contract"}
          </p>
          <div className="mt-3 divide-y divide-zinc-200/70 text-sm">
            <div className="flex items-center justify-between gap-3 py-2 first:pt-0">
              <span className="text-zinc-500">Script</span>
              {hasActiveEvalContract && evaluation.scriptPath ? (
                <span className="truncate font-mono font-medium text-zinc-900">
                  {evaluation.scriptPath}
                </span>
              ) : (
                unsetContractValue
              )}
            </div>
            <div className="flex items-center justify-between gap-3 py-2">
              <span className="text-zinc-500">Command</span>
              {hasActiveEvalContract && evaluation.runCommand ? (
                <span className="truncate font-mono font-medium text-zinc-900">
                  {evaluation.runCommand}
                </span>
              ) : (
                unsetContractValue
              )}
            </div>
            <div className="flex items-center justify-between gap-3 py-2">
              <span className="text-zinc-500">Score</span>
              {hasActiveEvalContract && evaluation.scoreName ? (
                <span className="font-medium text-zinc-900">
                  {evaluation.scoreName}
                </span>
              ) : (
                unsetContractValue
              )}
            </div>
            <div className="flex items-center justify-between gap-3 py-2 last:pb-0">
              <span className="text-zinc-500">Direction</span>
              {hasActiveEvalContract && evaluation.scoreDirection ? (
                <span className="font-medium text-zinc-900">
                  {directionLabel(evaluation.scoreDirection)}
                </span>
              ) : (
                unsetContractValue
              )}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-l-4 border-zinc-200 border-l-zinc-400 bg-white/90 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Run settings
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                Trial count
              </label>
              <input
                type="number"
                min={1}
                step={1}
                value={experiment.trialCount}
                onChange={(e) => updateRunSetting("trialCount", e.target.value)}
                disabled={!canEditRunSettings}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                Eval budget per trial
              </label>
              <input
                type="number"
                min={1}
                step={1}
                value={experiment.evalBudgetPerTrial}
                onChange={(e) =>
                  updateRunSetting("evalBudgetPerTrial", e.target.value)
                }
                disabled={!canEditRunSettings}
                className={inputClass}
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-l-4 border-amber-100 border-l-amber-300 bg-amber-50/55 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Contract behavior
          </p>
          <ul className="mt-3 space-y-2 text-sm text-zinc-500">
            <li>Command exits 0 when the eval runs successfully.</li>
            <li>Stdout prints one numeric score.</li>
            <li>Candidate eval worktree is available as OPTIMIZER_TARGET_REPO.</li>
            <li>Original repo path is available as OPTIMIZER_BASE_REPO.</li>
            <li>Non-zero exit marks the trial invalid.</li>
            <li>Any improvement in the chosen direction counts.</li>
          </ul>
        </section>
      </aside>
    </section>
  );
}
