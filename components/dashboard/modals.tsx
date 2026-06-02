import { useEffect, useState, type ReactNode } from "react";
import type { Experiment } from "@/lib/experiments";
import { CloseIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { inputClass } from "./shared";

type SourceType = "git" | "local";

function Overlay({
  onClose,
  className = "max-w-md",
  children,
}: {
  onClose: () => void;
  className?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 animate-fade-in bg-zinc-900/40 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full animate-scale-in rounded-2xl bg-white shadow-xl ring-1 ring-zinc-200 ${className}`}
      >
        {children}
      </div>
    </div>
  );
}

export function CreateModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (draft: {
    repo: string;
    title: string;
    description: string;
  }) => void;
}) {
  const [sourceType, setSourceType] = useState<SourceType>("git");
  const [repo, setRepo] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const canCreate = Boolean(repo.trim() && title.trim());
  const sourceLabel = sourceType === "git" ? "Git repository" : "Local path";
  const sourcePlaceholder =
    sourceType === "git"
      ? "https://github.com/acme/frontend-monorepo.git"
      : "/Users/frank/Desktop/Projects/frontend-monorepo";

  return (
    <Overlay onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!canCreate) return;
          onCreate({ repo, title, description });
        }}
      >
        <header className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <h2 className="text-base font-semibold text-zinc-900">New Experiment</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-4 px-5 py-5">
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <label
                htmlFor="experiment-source"
                className="block text-sm font-medium text-zinc-700"
              >
                {sourceLabel}
              </label>
              <div className="relative inline-grid h-8 min-w-[164px] grid-cols-2 rounded-full bg-zinc-100 p-0.5 shadow-inner ring-1 ring-zinc-200/80">
                <span
                  aria-hidden="true"
                  className={`absolute top-0.5 bottom-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.10),0_1px_8px_rgba(0,0,0,0.06)] ring-1 ring-black/5 transition-transform duration-200 ease-out ${
                    sourceType === "local" ? "translate-x-full" : "translate-x-0"
                  }`}
                />
                {(["git", "local"] as SourceType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={sourceType === type}
                    onClick={() => setSourceType(type)}
                    className={`relative z-10 rounded-full px-3 text-[13px] font-medium transition-colors ${
                      sourceType === type
                        ? "text-zinc-900"
                        : "text-zinc-500 hover:text-zinc-700"
                    }`}
                  >
                    {type === "git" ? "Git repo" : "Local path"}
                  </button>
                ))}
              </div>
            </div>
            <input
              id="experiment-source"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder={sourcePlaceholder}
              required
              autoFocus
              className={`${inputClass} font-mono`}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
              Experiment title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Bundle Size Reduction"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
              Goal / context
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional context for the eval setup or optimization run."
              className={`${inputClass} resize-none`}
            />
          </div>
        </div>

        <footer className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3.5 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PlusIcon className="h-4 w-4" />
            Create experiment
          </button>
        </footer>
      </form>
    </Overlay>
  );
}

export function DeleteModal({
  experiment,
  onClose,
  onConfirm,
}: {
  experiment: Experiment;
  onClose: () => void;
  onConfirm: (experiment: Experiment) => void;
}) {
  return (
    <Overlay onClose={onClose}>
      <header className="flex items-start gap-3 border-b border-zinc-100 px-5 py-4">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
          <TrashIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-zinc-900">
            Delete experiment?
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-zinc-500">
            Remove this experiment from local storage.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </header>

      <div className="px-5 py-4">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-3">
          <p className="truncate text-sm font-medium text-zinc-900">
            {experiment.title}
          </p>
          <p className="mt-1 font-mono text-xs text-zinc-500">
            {experiment.repo}
          </p>
        </div>
      </div>

      <footer className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-3.5 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onConfirm(experiment)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-rose-700"
        >
          <TrashIcon className="h-4 w-4" />
          Delete experiment
        </button>
      </footer>
    </Overlay>
  );
}
