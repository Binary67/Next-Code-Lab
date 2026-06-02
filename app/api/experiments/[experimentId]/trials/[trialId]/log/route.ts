import { readTrialLog } from "@/lib/trial-log-store";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      experimentId: string;
      trialId: string;
    }>;
  },
) {
  try {
    const { experimentId, trialId } = await context.params;
    const log = await readTrialLog(experimentId, trialId);

    return Response.json(log, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed.";

    return Response.json({ error: message }, { status: 400 });
  }
}
