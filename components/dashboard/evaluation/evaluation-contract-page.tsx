import type { ExperimentEvaluation } from "@/lib/experiments";
import type { EvalSetupPendingAction } from "../types";
import { directionLabel } from "../evaluation-utils";

export function EvaluationContractPage({
  evaluation,
  pendingAction,
  isEvalSetupPending,
  hasActiveEvalContract,
  onApproveGenerated,
}: {
  evaluation: ExperimentEvaluation;
  pendingAction?: EvalSetupPendingAction;
  isEvalSetupPending: boolean;
  hasActiveEvalContract: boolean;
  onApproveGenerated: () => void;
}) {
  const unsetContractValue = (
    <span className="shrink-0 font-medium text-zinc-500">Not set</span>
  );

  return (
    <div className="h-full overflow-y-auto bg-sky-50/45 p-4 scrollbar-hidden">
      <div className="grid gap-5 xl:grid-cols-2">
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
              onClick={onApproveGenerated}
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
      </div>
    </div>
  );
}
