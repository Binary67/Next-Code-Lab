export type Status = "running" | "needs-input" | "completed";

export type Experiment = {
  id: string;
  repo: string;
  title: string;
  description: string;
  status: Status;
  metricLabel: string;
  metricValue: string;
  /** Improvement shown next to the metric, e.g. a 18% reduction. */
  delta?: { dir: "down" | "up"; value: string };
  /** Right-hand timing text for running / completed experiments. */
  timing?: string;
};

export const experiments: Experiment[] = [
  {
    id: "bundle-size-reduction",
    repo: "frontend-monorepo",
    title: "Bundle Size Reduction",
    description:
      "Iterative tree-shaking optimization and dynamic import restructuring to reduce initial load footprint by 20%.",
    status: "running",
    metricLabel: "Current Size",
    metricValue: "1.2 MB",
    delta: { dir: "down", value: "18%" },
    timing: "4h 12m elapsed",
  },
  {
    id: "database-indexing-strategy",
    repo: "core-services-api",
    title: "Database Indexing Strategy",
    description:
      "Agent encountered ambiguous schema relations. Human verification required before applying compound index changes…",
    status: "needs-input",
    metricLabel: "P99 Latency",
    metricValue: "142 ms",
  },
  {
    id: "token-validation-cache",
    repo: "auth-gateway",
    title: "Token Validation Cache",
    description:
      "Implemented distributed memory caching for JWT validation, bypassing DB lookups for active sessions.",
    status: "completed",
    metricLabel: "CPU Load",
    metricValue: "42%",
    delta: { dir: "down", value: "35%" },
    timing: "Done in 2h 5m",
  },
];

/** Fabricated log stream shown when a halted experiment is reviewed. */
export const sampleLogs: { time: string; level: "info" | "warn" | "halt"; text: string }[] = [
  { time: "14:02:11", level: "info", text: "scanning schema graph — 142 tables, 318 relations" },
  { time: "14:02:39", level: "info", text: "candidate compound index on (tenant_id, created_at)" },
  { time: "14:02:54", level: "info", text: "estimated p99 latency improvement: 142ms → 38ms" },
  { time: "14:03:05", level: "warn", text: "ambiguous FK: orders.customer ↔ customers.id (2 paths)" },
  { time: "14:03:05", level: "halt", text: "halted — human verification required before apply" },
];
