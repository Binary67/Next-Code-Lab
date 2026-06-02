import { readExperiments } from "@/lib/experiment-store";

export async function GET() {
  const experiments = await readExperiments();

  return Response.json(
    { experiments },
    { headers: { "Cache-Control": "no-store" } },
  );
}
