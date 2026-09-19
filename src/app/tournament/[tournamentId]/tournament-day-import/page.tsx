import Link from "next/link";
import { notFound } from "next/navigation";
import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";
import { isTournamentDayImportWorkspace } from "../../../../lib/api/tournament-day-import";
import { isUuid } from "../../../../lib/api/validation";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { createServerOnlyAdminClient } from "../../../../lib/supabase/private-admin";
import TournamentDayImportClient from "./tournament-day-import-client";

export const dynamic = "force-dynamic";

export default async function TournamentDayImportPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  if (!isUuid(tournamentId)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  if (!["director", "co_director"].includes(access.role)) notFound();
  const { data, error } = await createServerOnlyAdminClient().rpc("get_tournament_day_import_workspace_v1", { p_actor_id: access.user.id, p_tournament_id: tournamentId });
  if (error || !isTournamentDayImportWorkspace(data)) notFound();
  return (
    <main className="auth-shell">
      <section className="auth-card wide-card">
        <p className="eyebrow">REGISTRATION FALLBACK</p>
        <h1>Tournament Day CSV Import</h1>
        <p className="card-context">{data.tournamentName}</p>
        <p className="auth-note">
          Use this when the desk spreadsheet is the registration source. Tournament Setup remains the required place to
          create events, configure Q Pools and Side Pools, and manage co-directors, cross-checkers, and judges. This import
          only creates or reuses roster identities, enrolls them in selected active events, records payment evidence, and
          records Side Pool elections so check-in, seating, schedules, scorecards, standings, playoffs, MRPs, payouts, and
          Consy can use the normal tournament flow.
        </p>
        <TournamentDayImportClient tournamentId={tournamentId} workspace={data} />
        <Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to Tournament</Link>
        <SharedDeviceSignOut />
      </section>
    </main>
  );
}
