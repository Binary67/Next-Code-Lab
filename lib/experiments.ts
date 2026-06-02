export type Status = "running" | "needs-input" | "completed";

export type ExperimentMetric = {
  label: string;
  value: string;
  detail: string;
};

export type TrialStatus = "completed" | "needs-input" | "running";

export type ExperimentTrial = {
  id: string;
  title: string;
  summary: string;
  metricValue: string;
  duration: string;
  status: TrialStatus;
};

export type TrendPoint = {
  label: string;
  value: number;
};

export type AgentMessage = {
  id: string;
  author: "agent" | "user";
  text: string;
  time: string;
};

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
  objective: string;
  targetLabel: string;
  targetValue: string;
  targetMetric: number;
  metrics: ExperimentMetric[];
  trend: TrendPoint[];
  trials: ExperimentTrial[];
  agentMessages: AgentMessage[];
  pendingQuestion?: {
    title: string;
    body: string;
    options: string[];
  };
};

export const experiments: Experiment[] = [
  {
    id: "latency-optimization-42",
    repo: "api-gateway",
    title: "Latency Optimization #42",
    description: "Reduce p95 latency below 50ms on /api/v2/data.",
    status: "needs-input",
    metricLabel: "Current p95",
    metricValue: "62 ms",
    delta: { dir: "down", value: "48%" },
    objective:
      "Lower p95 latency for the data endpoint without increasing error rate or memory pressure.",
    targetLabel: "Target p95",
    targetValue: "< 50 ms",
    targetMetric: 50,
    metrics: [
      { label: "Current p95", value: "62 ms", detail: "latest trial" },
      { label: "Target", value: "< 50 ms", detail: "objective" },
      { label: "Best trial", value: "57 ms", detail: "T-13" },
      { label: "Error rate", value: "0.08%", detail: "within guardrail" },
      { label: "Trials", value: "14", detail: "4h 12m elapsed" },
      { label: "Spend", value: "$12.40", detail: "82k tokens" },
    ],
    trend: [
      { label: "T-01", value: 118 },
      { label: "T-02", value: 109 },
      { label: "T-03", value: 96 },
      { label: "T-04", value: 74 },
      { label: "T-05", value: 82 },
      { label: "T-06", value: 68 },
      { label: "T-07", value: 78 },
      { label: "T-08", value: 61 },
      { label: "T-09", value: 66 },
      { label: "T-10", value: 53 },
      { label: "T-11", value: 58 },
      { label: "T-12", value: 85 },
      { label: "T-13", value: 57 },
      { label: "T-14", value: 62 },
    ],
    trials: [
      {
        id: "T-14",
        title: "Cache header tuning",
        summary: "Modified cache-control max-age for the largest JSON response.",
        metricValue: "62 ms",
        duration: "12m",
        status: "needs-input",
      },
      {
        id: "T-13",
        title: "Connection pooling",
        summary: "Increased upstream max connections from 180 to 500.",
        metricValue: "57 ms",
        duration: "18m",
        status: "completed",
      },
      {
        id: "T-12",
        title: "Payload compression",
        summary: "Enabled gzip for high-volume JSON endpoints.",
        metricValue: "85 ms",
        duration: "21m",
        status: "completed",
      },
      {
        id: "T-11",
        title: "Response field pruning",
        summary: "Removed unused relationship metadata from the default payload.",
        metricValue: "58 ms",
        duration: "16m",
        status: "completed",
      },
    ],
    agentMessages: [
      {
        id: "m1",
        author: "agent",
        text: "Payload sizes on /api/v2/data are large. Compression reduced transfer time, but I need a decision before testing a stronger default.",
        time: "10:42 AM",
      },
      {
        id: "m2",
        author: "user",
        text: "Good idea. Proceed with testing compression.",
        time: "10:47 AM",
      },
    ],
    pendingQuestion: {
      title: "Pending input",
      body: "Which compression algorithm should I prioritize testing first for JSON payloads?",
      options: ["Brotli", "Gzip"],
    },
  },
];
