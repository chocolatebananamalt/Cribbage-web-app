import Link from "next/link";
import { notFound } from "next/navigation";
import { SharedDeviceSignOut } from "../../../../../../components/shared-device-sign-out";
import { getSettlementV5Workspace } from "../../../../../../lib/api/settlement-v5";
import { getPaybackReviewWorkspace } from "../../../../../../lib/api/payback-review";
import { canStartPaybackFinalization } from "../../../../../../lib/results/payback-finalization-gate";
import { isUuid } from "../../../../../../lib/api/validation";
import { requireTournamentAccess } from "../../../../../../lib/auth/require-tournament-access";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import LegacySettlementRecovery from "../settlement/legacy-settlement-recovery";
import SettlementV5Client from "./settlement-v5-client";
import PaybackReviewClient from "../payback-review/payback-review-client";
export const dynamic = "force-dynamic";
export default async function SettlementV5Page({ params }: { params: Promise<{ tournamentId: string; eventId: string }> }) {
  const { tournamentId, eventId } = await params;
  if (!isUuid(tournamentId) || !isUuid(eventId)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  if (!["director", "co_director"].includes(access.role)) notFound();
  const admin = createServerOnlyAdminClient();
  const [workspace, payback] = await Promise.all([
    getSettlementV5Workspace(admin, access.user.id, tournamentId, eventId),
    getPaybackReviewWorkspace(admin, access.user.id, tournamentId, eventId),
  ]);
  const current = workspace?.draft;
  const paybackReady = canStartPaybackFinalization(payback, current);
  return <main className="auth-shell"><section className="auth-card corrections-card" aria-labelledby="settlement-v5-title">
    <p className="eyebrow">PRIVATE SETTLEMENT REVIEW</p><h1 id="settlement-v5-title">Settlement review</h1>
    <Link className="guide-link" href={`/tournament/${tournamentId}/events/${eventId}/playoff-outcomes`}>Back to playoff outcomes</Link>
    <SettlementV5Client key={`${workspace?.currentDraftVersion ?? "unavailable"}-${current?.draftId ?? "none"}-${workspace?.currentFinalVersion ?? "unavailable"}-${payback?.currentReviewVersion ?? "unavailable"}`}
      actorId={access.user.id} tournamentId={tournamentId} eventId={eventId} workspace={workspace} paybackReady={paybackReady}>
      {payback ? <PaybackReviewClient key={`${current?.draftId ?? "none"}-${payback.currentReviewVersion}`}
        actorId={access.user.id} tournamentId={tournamentId} eventId={eventId} workspace={payback}
        draft={current ? { draftId: current.draftId, version: current.version } : null} />
        : <p role="alert">Structured payback review is unavailable. Historical settlement evidence remains readable; a new finalization cannot be started here.</p>}
    </SettlementV5Client>
    <LegacySettlementRecovery actorId={access.user.id} tournamentId={tournamentId} eventId={eventId} /><SharedDeviceSignOut />
  </section></main>;
}
