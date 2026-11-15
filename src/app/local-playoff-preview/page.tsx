import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { isLoopbackPlannerUrl } from "../../lib/api/local-seating-planner";
import LocalPlayoffPreview from "../../components/local-playoff-preview";

export default async function LocalPlayoffPreviewPage() {
  if (process.env.CRIBBAGE_LOCAL_PLAYOFF_PREVIEW !== "1" || !["development", "test"].includes(process.env.NODE_ENV ?? "")
    || (process.env.VERCEL_ENV !== undefined && process.env.VERCEL_ENV !== "development")) notFound();
  const host = (await headers()).get("host");
  if (!host || !isLoopbackPlannerUrl(`http://${host}`)) notFound();
  return <LocalPlayoffPreview/>;
}
