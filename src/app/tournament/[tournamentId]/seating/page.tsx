import { adoptionEnabledV8 } from "../../../../lib/identity-adoption-v8/gate";
import { identityAccessV5 } from "../../../../lib/identity-v5/provider";
import type { IdentityAccessV5 } from "../../../../lib/identity-v5/contracts";
import { createClient } from "../../../../lib/supabase/server";
import Link from "next/link";
import { fictionalDrawBoundaryEnabled } from "../../../../lib/api/fictional-draw-enabled";
import { notFound } from "next/navigation";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { isUuid } from "../../../../lib/api/validation";
import { getSeatingWorkspace } from "../../../../lib/seating/workspace";
import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";
import SeatingClient from "./seating-client";

export default async function SeatingPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  if (!isUuid(tournamentId)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  if (!["director", "co_director"].includes(access.role)) notFound();
  const workspace = await getSeatingWorkspace(tournamentId);
  let identityScope: IdentityAccessV5 | null = null;
  if (access.role === "director" && adoptionEnabledV8()) {
    // The optional read affordance must not take down the existing operations page.
    try { identityScope = await identityAccessV5(await createClient(), tournamentId); }
    catch { /* Original tournament access and seating workspace remain authoritative. */ }
  }
  return <main className="auth-shell"><section className="auth-card corrections-card" aria-labelledby="seating-title"><p className="eyebrow">OPERATIONS</p><h1 id="seating-title">Check-in and Seating</h1><p className="auth-note">Record each roster member&apos;s check-in before registration closes. After closure, publish one permanent starting Table/Seat list. That starting assignment becomes the player&apos;s verification ID; it is not a round-by-round seating plan.</p><Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to tournament</Link>{workspace.publication ? <><Link className="guide-link" href={`/tournament/${tournamentId}/participants`}>Manage event participants</Link><Link className="guide-link" href={`/tournament/${tournamentId}/schedule`}>Review schedule and start play</Link></> : null}{fictionalDrawBoundaryEnabled() && workspace.registrationClosed && !workspace.publication ? <Link className="guide-link" href={`/tournament/${tournamentId}/seating/random-draw/admit`}>Enable reviewed random draw (18 players)</Link> : null}<SeatingClient identityScope={identityScope?.actorId === access.user.id ? identityScope : null} actorId={access.user.id} tournamentId={tournamentId} {...workspace} /><SharedDeviceSignOut /></section></main>;
}


