import Link from "next/link";
import { connection } from "next/server";
import { TournamentDashboard } from "../tournament-dashboard";

export default async function DemonstrationPage() {
  // The site uses a per-request CSP nonce. Dynamic rendering lets Next.js
  // apply that nonce to its scripts so every demonstration control hydrates.
  await connection();

  return (
    <>
      <aside className="demo-notice" aria-label="Demonstration notice">
        <div>
          <strong>Public Demonstration · Sample Data Only</strong>
          <span>Explore and share these screens freely. Nothing here is saved, and no real tournament information is available or changed.</span>
        </div>
        <Link href="/sign-in">Tournament sign-in</Link>
      </aside>
      <TournamentDashboard />
    </>
  );
}
