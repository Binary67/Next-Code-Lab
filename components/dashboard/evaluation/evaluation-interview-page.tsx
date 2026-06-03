import type { ExperimentEvaluation } from "@/lib/experiments";
import { inputClass } from "../shared";
import type { EvalSetupPendingAction } from "../types";
import { evalSetupPendingLabel } from "../evaluation-utils";

export function EvaluationInterviewPage({
  evaluation,
  pendingAction,
  reply,
  canUseSetupChat,
  isEvalSetupPending,
  onReplyChange,
  onStartInterview,
  onSubmitReply,
}: {
  evaluation: ExperimentEvaluation;
  pendingAction?: EvalSetupPendingAction;
  reply: string;
  canUseSetupChat: boolean;
  isEvalSetupPending: boolean;
  onReplyChange: (reply: string) => void;
  onStartInterview: () => void;
  onSubmitReply: (text: string) => void;
}) {
  const sendReply = () => onSubmitReply(reply);

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-white">
      <header className="shrink-0 border-b border-zinc-200/80 bg-blue-50/40 px-4 py-3">
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
              onClick={onStartInterview}
              disabled={isEvalSetupPending}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pendingAction === "start" ? "Starting..." : "Start interview"}
            </button>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-zinc-50/75 px-4 py-5">
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
                  className={`flex ${fromUser ? "justify-end" : "justify-start"}`}
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
                            onClick={() => onSubmitReply(choice)}
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
        className="shrink-0 border-t border-zinc-200/80 bg-white p-4"
      >
        <textarea
          value={reply}
          onChange={(e) => onReplyChange(e.target.value)}
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
        <div className="mt-2 flex items-center justify-between gap-3">
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
  );
}
