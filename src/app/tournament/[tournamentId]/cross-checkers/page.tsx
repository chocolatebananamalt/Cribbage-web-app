import { notFound, redirect } from "next/navigation";
import { isUuid } from "../../../../lib/api/validation";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";

export const dynamic = "force-dynamic";

export default async function CrossCheckerAssignmentPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  if (!isUuid(tournamentId)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  if (access.role !== "director") notFound();
  redirect(`/tournament/${tournamentId}/setup/officials/cross_checker`);
}
