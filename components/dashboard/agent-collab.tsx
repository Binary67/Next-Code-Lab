import { useState } from "react";
import type { Experiment } from "@/lib/experiments";
import {
  Avatar,
  FlaskIcon,
  WarningIcon,
} from "@/components/icons";
import {
  EmptyState,
  WorkflowPageLayout,
  inputClass,
} from "./shared";
import type { WorkflowPageItem } from "./shared";

type AgentCollabPageId = "conversation" | "pending-input";

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
