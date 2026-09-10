import { notFound } from "next/navigation";
import { allowsReviewPrototype } from "../lib/review-prototype-boundary";
import { TournamentDashboard } from "./tournament-dashboard";

export default function HomePage() {
  if (!allowsReviewPrototype({
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
  })) notFound();
  return <TournamentDashboard />;
}
