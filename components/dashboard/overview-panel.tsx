import type {
  Experiment,
  ExperimentMetric,
  ExperimentTrial,
  TrendPoint,
} from "@/lib/experiments";
import { CloseIcon, PauseIcon } from "@/components/icons";
import {
  ComingSoonPanel,
  EmptyState,
  TRIAL_TONE,
  statusLabel,
} from "./shared";

function MetricsList({ metrics }: { metrics: ExperimentMetric[] }) {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
        Metrics
      </h2>
      {metrics.length === 0 ? (
        <div className="mt-3">
          <EmptyState title="Metrics will appear after the first trial completes." />
        </div>
      ) : (
        <div className="mt-3 divide-y divide-zinc-200/70 overflow-hidden rounded-2xl bg-white/55 ring-1 ring-zinc-950/5">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium text-zinc-500">
                  {metric.label}
                </p>
                <p className="mt-0.5 truncate text-xs text-zinc-400">
                  {metric.detail}
                </p>
              </div>
              <p className="text-right text-base font-semibold tracking-tight text-zinc-900">
                {metric.value}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function TrendChart({
  points,
  target,
  targetLabel,
}: {
  points: TrendPoint[];
  target: number;
  targetLabel: string;
}) {
  const width = 640;
  const height = 260;
  const padding = { top: 18, right: 26, bottom: 34, left: 42 };
  const values = points.map((point) => point.value);
  const max = Math.max(...values, target) + 12;
  const min = Math.min(0, ...values, target);
  const xSpan = width - padding.left - padding.right;
  const ySpan = height - padding.top - padding.bottom;
  const xStep = points.length > 1 ? xSpan / (points.length - 1) : 0;
  const yFor = (value: number) =>
    padding.top + ((max - value) / (max - min || 1)) * ySpan;
  const xFor = (index: number) => padding.left + index * xStep;
  const line = points
    .map((point, index) => `${xFor(index)},${yFor(point.value)}`)
    .join(" ");
  const area = `${padding.left},${height - padding.bottom} ${line} ${
    width - padding.right
  },${height - padding.bottom}`;
  const targetY = yFor(target);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Optimization trend by trial"
      className="mt-4 aspect-[16/7] max-h-[280px] w-full overflow-visible"
    >
      {[0, 1, 2, 3].map((tick) => {
        const y = padding.top + (ySpan / 3) * tick;
        return (
          <line
            key={tick}
            x1={padding.left}
            x2={width - padding.right}
            y1={y}
            y2={y}
            stroke="#e4e4e7"
            opacity="0.72"
            strokeWidth="1"
          />
        );
      })}
      <line
        x1={padding.left}
        x2={width - padding.right}
        y1={targetY}
        y2={targetY}
        stroke="#d97706"
        opacity="0.72"
        strokeDasharray="4 4"
        strokeWidth="1.2"
      />
      <text
        x={width - padding.right}
        y={targetY - 7}
        textAnchor="end"
        className="fill-amber-600 text-[11px] font-medium"
      >
        {targetLabel}
      </text>
      <polygon points={area} fill="url(#trend-area)" opacity="0.9" />
      <polyline
        points={line}
        fill="none"
        stroke="#0a84ff"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.6"
        className="animate-draw"
      />
      {points.map((point, index) => (
        <g key={point.label}>
          <circle
            cx={xFor(index)}
            cy={yFor(point.value)}
            r={index === points.length - 1 ? 4.5 : 3}
            fill={index === points.length - 1 ? "#0a84ff" : "#ffffff"}
            stroke="#0a84ff"
            strokeWidth="1.6"
          />
          {(index === 0 ||
            index === points.length - 1 ||
            index % 4 === 0) && (
            <text
              x={xFor(index)}
              y={height - 10}
              textAnchor="middle"
              className="fill-zinc-400 text-[11px] font-medium"
            >
              {point.label}
            </text>
          )}
        </g>
      ))}
      <defs>
        <linearGradient id="trend-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#dbeafe" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.15" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function TrialsList({
  trials,
  metricName,
}: {
  trials: ExperimentTrial[];
  metricName: string;
}) {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
        Recent trials
      </h2>
      <p className="mt-1 text-xs text-zinc-500">
        Latest attempts and measured outcomes.
      </p>

      {trials.length === 0 ? (
        <div className="mt-3">
          <EmptyState title="No trials yet." />
        </div>
      ) : (
        <div className="mt-3 divide-y divide-zinc-200/70 overflow-hidden rounded-2xl bg-white/55 ring-1 ring-zinc-950/5">
          {trials.map((trial) => (
            <article key={trial.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-xs font-semibold text-zinc-900">
                      {trial.id}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ring-1 ring-inset ring-black/5 ${
                        TRIAL_TONE[trial.status]
                      }`}
                    >
                      {statusLabel(trial.status)}
                    </span>
                  </div>
                  <h3 className="mt-2 truncate text-sm font-medium text-zinc-900">
                    {trial.title}
                  </h3>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-zinc-400">{metricName}</p>
                  <p className="mt-0.5 text-sm font-semibold text-zinc-900">
                    {trial.metricValue}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                {trial.summary}
              </p>
              <p className="mt-2 text-xs text-zinc-400">{trial.duration}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function OverviewPanel({
  experiment,
  metricName,
  onNotify,
}: {
  experiment: Experiment;
  metricName: string;
  onNotify: (message: string) => void;
}) {
  const latestPoint: TrendPoint | undefined =
    experiment.trend[experiment.trend.length - 1];
  const previousPoint: TrendPoint | undefined =
    experiment.trend[experiment.trend.length - 2];
  const movement =
    latestPoint && previousPoint ? latestPoint.value - previousPoint.value : 0;
  const movementUnit = experiment.metricValue.includes("ms") ? "ms" : "";
  const activeTrial: ExperimentTrial | undefined = experiment.trials[0];
  const hasTrend = experiment.trend.length > 0;

  return (
    <section className="grid gap-5 xl:grid-cols-[1.45fr_0.85fr]">
      <div className="space-y-5">
        <section className="rounded-2xl bg-zinc-50/70 p-4 ring-1 ring-zinc-950/5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-zinc-900">
                Overview
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Trend direction and latest trial state.
              </p>
            </div>
            {hasTrend && (
              <div className="rounded-2xl bg-blue-50/80 px-3 py-2 text-right ring-1 ring-blue-100">
                <p className="text-xs font-medium text-blue-700">
                  Current {experiment.metricValue}
                </p>
                <p
                  className={`mt-0.5 text-xs ${
                    movement > 0 ? "text-amber-600" : "text-emerald-600"
                  }`}
                >
                  {movement > 0 ? "+" : ""}
                  {movement}
                  {movementUnit} from previous
                </p>
              </div>
            )}
          </div>
          {hasTrend ? (
            <TrendChart
              points={experiment.trend}
              target={experiment.targetMetric}
              targetLabel={`${experiment.targetLabel}: ${experiment.targetValue}`}
            />
          ) : (
            <div className="mt-4">
              <EmptyState title="Trend appears after the first trial completes." />
            </div>
          )}
        </section>

        <div className="grid gap-3 lg:grid-cols-2">
          <section className="rounded-2xl bg-white/65 p-4 ring-1 ring-zinc-950/5">
            <h3 className="text-sm font-semibold text-zinc-900">Active run</h3>
            {activeTrial ? (
              <>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-semibold text-zinc-900">
                      {activeTrial.id}
                    </p>
                    <p className="mt-1 truncate text-sm font-medium text-zinc-900">
                      {activeTrial.title}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ring-1 ring-inset ring-black/5 ${
                      TRIAL_TONE[activeTrial.status]
                    }`}
                  >
                    {statusLabel(activeTrial.status)}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-zinc-500">
                  {activeTrial.summary}
                </p>
              </>
            ) : (
              <div className="mt-3">
                <EmptyState
                  title="No active run yet."
                  body="Start the experiment after evaluation setup to create the first trial."
                />
              </div>
            )}
          </section>

          <section className="rounded-2xl bg-white/65 p-4 ring-1 ring-zinc-950/5">
            <h3 className="text-sm font-semibold text-zinc-900">Measurement</h3>
            {activeTrial ? (
              <div className="mt-3 divide-y divide-zinc-200/70 text-sm">
                <div className="flex items-center justify-between gap-3 py-2 first:pt-0">
                  <span className="text-zinc-500">{metricName}</span>
                  <span className="font-semibold text-zinc-900">
                    {activeTrial.metricValue}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 py-2">
                  <span className="text-zinc-500">{experiment.targetLabel}</span>
                  <span className="font-semibold text-zinc-900">
                    {experiment.targetValue}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 py-2 last:pb-0">
                  <span className="text-zinc-500">Duration</span>
                  <span className="font-semibold text-zinc-900">
                    {activeTrial.duration}
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-3">
                <EmptyState title="Measurements will appear after a trial records a score." />
              </div>
            )}
          </section>
        </div>
      </div>

      <aside className="space-y-5">
        <section className="rounded-2xl bg-white/65 p-4 ring-1 ring-zinc-950/5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Run controls
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onNotify(`${experiment.title} paused`)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-medium text-zinc-700 ring-1 ring-zinc-950/5 transition-colors hover:bg-zinc-50"
            >
              <PauseIcon className="h-4 w-4" />
              Pause
            </button>
            <button
              type="button"
              onClick={() => onNotify(`${experiment.title} stopped`)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 ring-1 ring-rose-200/70 transition-colors hover:bg-rose-100"
            >
              <CloseIcon className="h-4 w-4" />
              Stop
            </button>
          </div>
        </section>

        <MetricsList metrics={experiment.metrics} />

        <ComingSoonPanel title="Guardrails and spend" />
      </aside>
    </section>
  );
}
