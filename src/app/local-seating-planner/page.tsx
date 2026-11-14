import { headers } from "next/headers";
import { notFound } from "next/navigation";
import LocalSeatingPlanner from "../../components/local-seating-planner";
import { isLocalSeatingPlannerEnabled, isLoopbackPlannerUrl } from "../../lib/api/local-seating-planner";
export default async function LocalSeatingPlannerPage() {
  if (!isLocalSeatingPlannerEnabled(process.env)) notFound();
  const host = (await headers()).get("host");
  if (!host || !isLoopbackPlannerUrl(`http://${host}`)) notFound();
  // No tournament, auth, roster or publication client is created by this page.
  // The existing app-wide authenticated layout is unchanged; isolated tests
  // use their own layout and never launch against a hosted environment.
  return <main className="auth-shell"><section className="auth-card corrections-card"><p className="eyebrow">LOCAL PLANNING ONLY</p><h1>Room layout and random seating</h1><LocalSeatingPlanner /></section></main>;
}
