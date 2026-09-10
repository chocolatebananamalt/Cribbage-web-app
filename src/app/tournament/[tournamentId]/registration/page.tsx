import Link from "next/link";
import { notFound } from "next/navigation";
import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";
import { registrationLinkManagementEnabled } from "../../../../lib/api/public-registration-v2";
import { isUuid } from "../../../../lib/api/validation";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { getRegistrationLinkWorkspace } from "../../../../lib/registration-link-workspace";
import RegistrationLinkClient from "./registration-link-client";

export default async function RegistrationLinkPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  if (!isUuid(tournamentId) || !registrationLinkManagementEnabled()) notFound();
  const access = await requireTournamentAccess(tournamentId);
  if (!["director", "co_director"].includes(access.role)) notFound();
  const state = await getRegistrationLinkWorkspace(access.user.id, tournamentId);
  return <main className="auth-shell"><section className="auth-card corrections-card" aria-labelledby="registration-link-title"><p className="eyebrow">OPERATIONS</p><h1 id="registration-link-title">Registration Link</h1><p className="auth-note">Create one QR-ready link for this tournament. The registration credential is shown only once after it is created or replaced.</p><Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to tournament</Link><RegistrationLinkClient tournamentId={tournamentId} initialState={state} /><SharedDeviceSignOut /></section></main>;
}
