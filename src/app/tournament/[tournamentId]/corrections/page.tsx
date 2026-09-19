import { notFound } from "next/navigation";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { isUuid } from "../../../../lib/api/validation";
import { getCorrectionWorkspace } from "../../../../lib/corrections/workspace";
import CorrectionsClient from "./corrections-client";
import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";
import Link from "next/link";
import { rule12CorrectionEnabled } from "../../../../lib/api/rule12-correction-release";

export default async function CorrectionsPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  if (!rule12CorrectionEnabled()) notFound();
  const { tournamentId } = await params;
  if (!isUuid(tournamentId)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  const workspace = await getCorrectionWorkspace(access.user.id, tournamentId);
  return <main className="auth-shell"><section className="auth-card corrections-card" aria-labelledby="corrections-title"><p className="eyebrow">CROSS CHECK</p><h1 id="corrections-title">Score Corrections</h1><p className="auth-note">Only actions the tournament server has authorized are shown here. A pending correction does not change scorecards, standings, or exports.</p>{['director', 'co_director'].includes(access.role) ? <Link className="guide-link" href={`/tournament/${tournamentId}/correction-policy`}>Correction policy settings</Link> : null}<CorrectionsClient actorId={access.user.id} actorRole={access.role} {...workspace} /><Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to Tournament</Link><SharedDeviceSignOut /></section></main>;
}
