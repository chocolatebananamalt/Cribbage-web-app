import Link from "next/link";
import { TournamentDashboard } from "../tournament-dashboard";

export default function DemonstrationPage() {
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
