import { notFound } from "next/navigation";
import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { isUuid } from "../../../../lib/api/validation";
import { getCorrectionPolicy } from "../../../../lib/corrections/policy";
import { CorrectionPolicyClient } from "./policy-client";
import { rule12CorrectionEnabled } from "../../../../lib/api/rule12-correction-release";

export default async function CorrectionPolicyPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  if (!rule12CorrectionEnabled()) notFound();
  const { tournamentId } = await params;
  if (!isUuid(tournamentId)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  if (!['director', 'co_director'].includes(access.role)) notFound();
  const policy = await getCorrectionPolicy(access.user.id, tournamentId);
  return <main className="auth-shell"><section className="auth-card corrections-card" aria-labelledby="policy-title"><p className="eyebrow">DIRECTOR SETTINGS</p><h1 id="policy-title">Correction Policy</h1><p className="auth-note">New tournaments start with immediate correction authority and an optional reason.</p><CorrectionPolicyClient actorId={access.user.id} policy={policy} /><SharedDeviceSignOut /></section></main>;
}
