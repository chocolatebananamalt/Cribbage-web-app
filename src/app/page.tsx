import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { allowsReviewPrototype } from "../lib/review-prototype-boundary";
import { TournamentDashboard } from "./tournament-dashboard";

export default async function HomePage() {
  const requestHeaders = await headers();
  if (!allowsReviewPrototype({
    host: requestHeaders.get("host"),
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
  })) notFound();
  return <TournamentDashboard />;
}
