import { redirect } from "next/navigation";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
export const dynamic = "force-dynamic";
export default async function OfficialsPage({ params }: { params: Promise<{ tournamentId: string }> }) { const { tournamentId } = await params; await requireTournamentAccess(tournamentId); redirect(`/tournament/${tournamentId}/setup/officials/co_director`); }
