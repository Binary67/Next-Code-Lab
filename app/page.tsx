import Dashboard from "@/components/dashboard";
import { readExperiments } from "@/lib/experiment-store";

export default async function Home() {
  const experiments = await readExperiments();

  return <Dashboard initialExperiments={experiments} />;
}
