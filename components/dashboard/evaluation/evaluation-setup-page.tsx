import type {
  EvaluationMode,
  ExperimentEvaluation,
  ScoreDirection,
} from "@/lib/experiments";
import { inputClass } from "../shared";
import type { EvalSetupPendingAction } from "../types";
import {
  evaluationStatusLabel,
  getMissingEvaluationFields,
} from "../evaluation-utils";
import type {
  EvaluationPageChangeHandler,
  EvaluationPatchHandler,
} from "./types";

const SCORE_DIRECTIONS: {
  id: ScoreDirection;
  label: string;
  detail: string;
}[] = [
  { id: "minimize", label: "Minimize", detail: "Lower score is better" },
  { id: "maximize", label: "Maximize", detail: "Higher score is better" },
];

const MODE_OPTIONS: { id: EvaluationMode; label: string; detail: string }[] = [
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

export function EvaluationSetupPage({
  evaluation,
  pendingAction,
  isEvalSetupPending,
  isReady,
  onChange,
  onModeChange,
  onStartInterview,
  onPageChange,
}: {
  evaluation: ExperimentEvaluation;
  pendingAction?: EvalSetupPendingAction;
  isEvalSetupPending: boolean;
  isReady: boolean;
  onChange: EvaluationPatchHandler;
  onModeChange: (mode: EvaluationMode) => void;
  onStartInterview: () => void;
  onPageChange: EvaluationPageChangeHandler;
}) {
  const missingFields = getMissingEvaluationFields(evaluation);

  return (
    <div className="h-full overflow-y-auto bg-white p-4 scrollbar-hidden">
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
          {MODE_OPTIONS.map((option) => {
            const selected = evaluation.mode === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onModeChange(option.id)}
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
        <section className="mt-5 rounded-2xl border border-l-4 border-zinc-200 border-l-blue-500 bg-zinc-50/80 p-4 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                Eval script path
              </label>
              <input
                value={evaluation.scriptPath}
                onChange={(e) => onChange({ scriptPath: e.target.value })}
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
                onChange={(e) => onChange({ runCommand: e.target.value })}
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
                onChange={(e) => onChange({ scoreName: e.target.value })}
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
                  const selected = evaluation.scoreDirection === direction.id;
                  return (
                    <button
                      key={direction.id}
                      type="button"
                      onClick={() =>
                        onChange({
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
                onClick={onStartInterview}
                disabled={isEvalSetupPending}
                className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-amber-700 ring-1 ring-amber-200 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pendingAction === "start" ? "Starting..." : "Interview to fill gaps"}
              </button>
            </div>
          )}
        </section>
      ) : (
        <section className="mt-5 rounded-2xl border border-l-4 border-blue-100 border-l-blue-500 bg-blue-50/60 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-zinc-900">
            Generated eval setup
          </h3>
          <p className="mt-1 text-sm text-zinc-500">
            Continue in Setup Interview to let the agent collect eval details.
          </p>
          <button
            type="button"
            onClick={() => onPageChange("interview")}
            className="mt-4 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Open setup interview
          </button>
        </section>
      )}
    </div>
  );
}
