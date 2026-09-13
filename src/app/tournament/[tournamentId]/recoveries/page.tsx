import Link from "next/link";
import { notFound } from "next/navigation";
import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";
import { isUuid } from "../../../../lib/api/validation";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { getDeviceRecoveryWorkspace } from "../../../../lib/recovery/device-failure-workspace";
import RecoveryClient from "./recovery-client";

export default async function DeviceRecoveryPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  if (!isUuid(tournamentId)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  if (!["director", "co_director", "cross_checker"].includes(access.role)) notFound();
  const workspace = await getDeviceRecoveryWorkspace(access.user.id, tournamentId);
  return <main className="auth-shell"><section className="auth-card corrections-card" aria-labelledby="recovery-title">
    <p className="eyebrow">CROSS CHECK</p>
    <h1 id="recovery-title">Failed-device score recovery</h1>
    <p className="card-context">{workspace.tournamentName}</p>
    <p className="registration-note">Use this only when a player&apos;s unsynchronized device entry cannot be recovered. Record the surviving opponent-device or paper-card evidence exactly. A different eligible official must approve it before any scorecard or standing changes.</p>
    <RecoveryClient actorId={access.user.id} tournamentId={tournamentId} actorRole={workspace.actorRole} proposalCandidates={workspace.proposalCandidates} reviewCases={workspace.reviewCases} />
    <Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to Tournament</Link>
    <SharedDeviceSignOut />
  </section></main>;
}
