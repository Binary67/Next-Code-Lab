import type { Experiment } from "@/lib/experiments";
import { inputClass } from "../shared";
import type { EvaluationRunSettingChangeHandler } from "./types";

export function EvaluationRunSettingsPage({
  experiment,
  canEditRunSettings,
  onUpdateRunSetting,
}: {
  experiment: Experiment;
  canEditRunSettings: boolean;
  onUpdateRunSetting: EvaluationRunSettingChangeHandler;
}) {
  return (
    <div className="h-full overflow-y-auto bg-white p-4 scrollbar-hidden">
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
              onChange={(e) =>
                onUpdateRunSetting("trialCount", e.target.value)
              }
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
                onUpdateRunSetting("evalBudgetPerTrial", e.target.value)
              }
              disabled={!canEditRunSettings}
              className={inputClass}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
