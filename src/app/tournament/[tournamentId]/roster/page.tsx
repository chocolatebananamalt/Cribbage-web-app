import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { isUuid } from "../../../../lib/api/validation";
import { getRosterWorkspace } from "../../../../lib/roster/workspace";
import { getRegistrationClaimReviewWorkspace } from "../../../../lib/registration-claim-review-workspace";
import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";
import RosterClient from "./roster-client";
import RegistrationClaimReviewClient from "./registration-claim-review-client";
import { readRosterIntakeState } from "../../../../lib/director-checklist-reader";

export const dynamic = "force-dynamic";

export default async function RosterPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  if (!isUuid(tournamentId)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  if (!["director", "co_director"].includes(access.role)) notFound();
  const [workspace, claims, intakeState] = await Promise.all([getRosterWorkspace(tournamentId), getRegistrationClaimReviewWorkspace(tournamentId), readRosterIntakeState(access.user.id, tournamentId)]);
  return <main className="auth-shell"><section className="auth-card corrections-card" aria-labelledby="roster-title"><p className="eyebrow">OPERATIONS</p><h1 id="roster-title">Players and Registration</h1><p className="auth-note">Review signup requests, add players directly, or import a player list. A roster identity is not an account, payment, check-in, event enrollment, Table/Seat, or verification-ID assignment.</p><Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to tournament</Link><RegistrationClaimReviewClient actorId={access.user.id} tournamentId={tournamentId} claims={claims} /><RosterClient intakeState={intakeState} actorId={access.user.id} tournamentId={tournamentId} {...workspace} /><SharedDeviceSignOut /></section></main>;
}
