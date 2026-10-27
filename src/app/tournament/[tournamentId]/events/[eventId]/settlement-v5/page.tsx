import Link from "next/link";
import { notFound } from "next/navigation";
import { SharedDeviceSignOut } from "../../../../../../components/shared-device-sign-out";
import { getSettlementV5Workspace } from "../../../../../../lib/api/settlement-v5";
import { isUuid } from "../../../../../../lib/api/validation";
import { requireTournamentAccess } from "../../../../../../lib/auth/require-tournament-access";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import LegacySettlementRecovery from "../settlement/legacy-settlement-recovery";
import SettlementV5Client from "./settlement-v5-client";
export const dynamic = "force-dynamic";
export default async function SettlementV5Page({ params }: { params: Promise<{ tournamentId: string; eventId: string }> }) { const { tournamentId, eventId } = await params; if (!isUuid(tournamentId) || !isUuid(eventId)) notFound(); const access = await requireTournamentAccess(tournamentId); if (!["director", "co_director"].includes(access.role)) notFound(); const workspace = await getSettlementV5Workspace(createServerOnlyAdminClient(), access.user.id, tournamentId, eventId); return <main className="auth-shell"><section className="auth-card corrections-card" aria-labelledby="settlement-v5-title"><p className="eyebrow">PRIVATE SETTLEMENT REVIEW</p><h1 id="settlement-v5-title">Settlement review</h1><Link className="guide-link" href={`/tournament/${tournamentId}/events/${eventId}/playoff-outcomes`}>Back to playoff outcomes</Link><SettlementV5Client key={`${workspace?.currentDraftVersion ?? "unavailable"}-${workspace?.draft?.draftId ?? "none"}-${workspace?.currentFinalVersion ?? "unavailable"}-${workspace?.finalization?.finalizationId ?? "none"}`} actorId={access.user.id} tournamentId={tournamentId} eventId={eventId} workspace={workspace} /><LegacySettlementRecovery actorId={access.user.id} tournamentId={tournamentId} eventId={eventId} /><SharedDeviceSignOut /></section></main>; }
