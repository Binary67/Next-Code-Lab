import type { Status } from "@/lib/experiments";

export type NavId = "experiments" | "repositories" | "settings";
export type TabId = "all" | Status;
export type DetailTabId =
  | "evaluation"
  | "overview"
  | "run"
  | "collab"
  | "changes";
export type EvalSetupPendingAction = "start" | "reply" | "approve";
