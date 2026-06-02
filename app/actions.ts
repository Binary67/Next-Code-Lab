"use server";

import { writeExperiments } from "@/lib/experiment-store";
import type { Experiment } from "@/lib/experiments";

export async function saveExperiments(experiments: Experiment[]) {
  await writeExperiments(experiments);
}
