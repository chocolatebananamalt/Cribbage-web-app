import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTournamentAccess } from "../../../../../../lib/auth/require-tournament-access";
import { isUuid } from "../../../../../../lib/api/validation";
import { isSetupOfficialRole } from "../../../../../../lib/api/setup-officials";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import { getSetupOfficialsWorkspace } from "../../../../../../lib/setup-officials";
import SetupOfficialsClient from "./setup-officials-client";

export const dynamic = "force-dynamic";

export default async function SetupOfficialsPage({ params }: { params: Promise<{ tournamentId: string; role: string }> }) {
  const { tournamentId, role } = await params;
  if (!isUuid(tournamentId) || !isSetupOfficialRole(role)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  if (access.role !== "director") notFound();
  const workspace = await getSetupOfficialsWorkspace(createServerOnlyAdminClient(), access.user.id, tournamentId, role);
  if (!workspace) notFound();
  return <main className="auth-shell"><section className="auth-card corrections-card wide-card" aria-labelledby="setup-officials-title"><p className="eyebrow">TOURNAMENT OFFICIALS</p><h1 id="setup-officials-title">{role === "co_director" ? "Co-Directors" : role === "cross_checker" ? "Cross-Checkers" : "Judges"}</h1><p className="card-context">{workspace.tournamentName}</p><p className="auth-note">Add the exact first name, last name, email, and ACC #. The person is pre-approved now and receives authority only after secure email sign-in.</p><Link className="guide-link" href={`/tournament/${tournamentId}/setup`}>Back to tournament setup</Link><SetupOfficialsClient tournamentId={tournamentId} role={role} initial={workspace} /></section></main>;
}
