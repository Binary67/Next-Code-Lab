export function EvaluationBehaviorPage() {
  return (
    <div className="h-full overflow-y-auto bg-white p-4 scrollbar-hidden">
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
    </div>
  );
}
