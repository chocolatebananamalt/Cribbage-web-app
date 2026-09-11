import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSubject } from "../../lib/auth/current-subject";
import { TournamentDashboard } from "../tournament-dashboard";

export default async function DemonstrationPage() {
  const subject = await getCurrentSubject();
  if (!subject) redirect("/sign-in?next=%2Fdemo");

  return (
    <>
      <aside className="demo-notice" aria-label="Demonstration notice">
        <div>
          <strong>Demonstration · Sample data only</strong>
          <span>Explore the screens freely. Nothing here is saved and no real tournament record is changed.</span>
        </div>
        <Link href="/">Return to account</Link>
      </aside>
      <TournamentDashboard />
    </>
  );
}
