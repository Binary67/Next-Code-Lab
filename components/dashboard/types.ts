import type { Status } from "@/lib/experiments";

export type NavId = "experiments" | "repositories" | "settings";
export type TabId = "all" | Status;
export type DetailTabId =
  | "evaluation"
  | "overview"
  | "progress"
  | "collab"
  | "trials"
  | "changes";
export type EvalSetupPendingAction = "start" | "reply" | "approve";
