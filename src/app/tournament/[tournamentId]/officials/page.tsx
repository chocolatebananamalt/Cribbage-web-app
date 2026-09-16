import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { getOfficialsWorkspace } from "../../../../lib/officials";
import { createServerOnlyAdminClient } from "../../../../lib/supabase/private-admin";
import OfficialsClient from "./officials-client";
export const dynamic = "force-dynamic";
export default async function OfficialsPage({ params }: { params: Promise<{ tournamentId: string }> }) { const { tournamentId } = await params; const access = await requireTournamentAccess(tournamentId); const workspace = await getOfficialsWorkspace(createServerOnlyAdminClient(), access.user.id, tournamentId); if (!workspace) notFound(); return <main className="auth-shell"><section className="auth-card" aria-labelledby="officials-title"><p className="eyebrow">TOURNAMENT OFFICIALS</p><h1 id="officials-title">Officials</h1><p className="card-context">{workspace.tournamentName}</p><p className="auth-note">One primary director and up to four co-directors. An invite is exact-email, single-use, and expires after seven days.</p><Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to tournament</Link><OfficialsClient tournamentId={tournamentId} initial={workspace}/></section></main>; }
