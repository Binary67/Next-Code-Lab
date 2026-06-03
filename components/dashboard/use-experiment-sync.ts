import { useEffect, useRef, useState } from "react";
import { saveExperiments } from "@/app/actions";
import type { Experiment } from "@/lib/experiments";

export function useExperimentSync({
  initialExperiments,
  runPendingId,
  notify,
}: {
  initialExperiments: Experiment[];
  runPendingId: string | null;
  notify: (message: string) => void;
}) {
  const [items, setItems] = useState<Experiment[]>(initialExperiments);
  const didMountRef = useRef(false);
  const skipNextSaveRef = useRef(false);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const shouldPollExperiments =
    runPendingId !== null ||
    items.some((experiment) => experiment.status === "running");

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    const snapshot = items;
    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(() => saveExperiments(snapshot))
      .catch(() => notify("Could not save experiments"));
  }, [items, notify]);

  useEffect(() => {
    if (!shouldPollExperiments) {
      return;
    }

    let stopped = false;

    const poll = async () => {
      try {
        const response = await fetch("/api/experiments", { cache: "no-store" });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as { experiments?: Experiment[] };

        const experiments = data.experiments;

        if (!Array.isArray(experiments) || stopped) {
          return;
        }

        setItems((current) => {
          if (JSON.stringify(current) === JSON.stringify(experiments)) {
            return current;
          }

          skipNextSaveRef.current = true;
          return experiments;
        });
      } catch {
        // Polling is best-effort; the active server action still returns final state.
      }
    };

    void poll();
    const interval = window.setInterval(() => void poll(), 1000);

    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [shouldPollExperiments]);

  return { items, setItems };
}
