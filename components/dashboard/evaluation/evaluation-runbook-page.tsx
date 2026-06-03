import type { RepoRunbook } from "@/lib/codex/types";
import type { ReactNode } from "react";
import { EmptyState } from "../shared";

function FieldList({
  items,
  empty = "None listed.",
}: {
  items: string[];
  empty?: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-zinc-400">{empty}</p>;
  }

  return (
    <ul className="space-y-1.5 text-sm text-zinc-500">
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  );
}

function CommandList({ commands }: { commands: string[] }) {
  if (commands.length === 0) {
    return <p className="text-sm text-zinc-400">No commands listed.</p>;
  }

  return (
    <div className="space-y-1.5">
      {commands.map((command, index) => (
        <code
          key={`${command}-${index}`}
          className="block overflow-x-auto rounded-lg bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-50"
        >
          {command}
        </code>
      ))}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white/90 p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {title}
      </p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function EvaluationRunbookPage({
  runbook,
}: {
  runbook?: RepoRunbook;
}) {
  if (!runbook) {
    return (
      <div className="h-full overflow-y-auto bg-white p-4 scrollbar-hidden">
        <EmptyState
          title="No runbook yet"
          body="Runbook will appear after repository inspection starts."
        />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-white p-4 scrollbar-hidden">
      <div className="space-y-4">
        <Section title="Summary">
          <p className="text-sm leading-relaxed text-zinc-600">
            {runbook.summary}
          </p>
        </Section>

        <Section title="Setup">
          <div className="space-y-4">
            {runbook.dependencyManagers.length === 0 ? (
              <p className="text-sm text-zinc-400">
                No dependency manager listed.
              </p>
            ) : (
              runbook.dependencyManagers.map((manager, index) => (
                <div
                  key={`${manager.ecosystem}-${manager.manager}-${index}`}
                  className="border-t border-zinc-200/80 py-3 first:border-t-0 first:pt-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">
                        {manager.manager}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {manager.ecosystem}
                      </p>
                    </div>
                    {manager.runPrefix && (
                      <code className="rounded-lg bg-white px-2 py-1 font-mono text-xs text-zinc-700 ring-1 ring-zinc-200">
                        {manager.runPrefix}
                      </code>
                    )}
                  </div>
                  <div className="mt-3">
                    <p className="mb-1.5 text-xs font-medium text-zinc-500">
                      Setup commands
                    </p>
                    <CommandList commands={manager.setupCommands} />
                  </div>
                  <div className="mt-3">
                    <p className="mb-1.5 text-xs font-medium text-zinc-500">
                      Evidence
                    </p>
                    <FieldList items={manager.evidence} />
                  </div>
                </div>
              ))
            )}
          </div>
        </Section>

        <Section title="Runtime Requirements">
          {runbook.runtimeRequirements.length === 0 ? (
            <p className="text-sm text-zinc-400">
              No runtime requirements listed.
            </p>
          ) : (
            <div className="divide-y divide-zinc-200/80 text-sm">
              {runbook.runtimeRequirements.map((requirement, index) => (
                <div
                  key={`${requirement.name}-${requirement.version ?? requirement.source}-${index}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                >
                  <span className="font-medium text-zinc-900">
                    {requirement.name}
                    {requirement.version ? ` ${requirement.version}` : ""}
                  </span>
                  <span className="text-zinc-500">{requirement.source}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Workflows">
          <div className="space-y-3">
            {runbook.workflows.length === 0 ? (
              <p className="text-sm text-zinc-400">No workflows listed.</p>
            ) : (
              runbook.workflows.map((workflow, index) => (
                <article
                  key={`${workflow.name}-${index}`}
                  className="border-t border-zinc-200/80 py-3 first:border-t-0 first:pt-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-900">
                        {workflow.name}
                      </h3>
                      <p className="mt-1 text-sm text-zinc-500">
                        {workflow.purpose}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-zinc-500 ring-1 ring-zinc-200">
                      {workflow.confidence} confidence
                    </span>
                  </div>
                  <div className="mt-3">
                    <p className="mb-1.5 text-xs font-medium text-zinc-500">
                      Commands
                    </p>
                    <CommandList commands={workflow.commands} />
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-zinc-500">
                        Requires
                      </p>
                      <FieldList
                        items={[
                          ...workflow.requiredFiles,
                          ...workflow.requiredEnvVars,
                        ]}
                      />
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-zinc-500">
                        Produces
                      </p>
                      <FieldList items={workflow.produces} />
                    </div>
                  </div>
                  <div className="mt-3">
                    <p className="mb-1.5 text-xs font-medium text-zinc-500">
                      Evidence
                    </p>
                    <FieldList items={workflow.evidence} />
                  </div>
                </article>
              ))
            )}
          </div>
        </Section>

        <Section title="Repo Conventions">
          <FieldList items={runbook.repoConventions} />
        </Section>

        <Section title="Known Risks">
          <FieldList items={runbook.knownRisks} />
        </Section>

        <Section title="Open Questions">
          <FieldList items={runbook.openQuestions} />
        </Section>
      </div>
    </div>
  );
}
