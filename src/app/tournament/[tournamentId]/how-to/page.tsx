import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { isUuid } from "../../../../lib/api/validation";
import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";

export default async function TournamentHowToPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  if (!isUuid(tournamentId)) notFound();
  await requireTournamentAccess(tournamentId);
  return <main className="auth-shell"><section className="auth-card" aria-labelledby="how-to-title"><p className="eyebrow">START HERE</p><h1 id="how-to-title">How To Use Tournament Desk</h1><section><h2>Players</h2><p>Check your current Table/Seat before each game. Select the winner, enter the spread points, and submit your own result. A game becomes official only after both players independently submit matching results and each confirms their own entry.</p></section><section><h2>One paper card and one digital card</h2><p>Keep the paper card with the game. Each assigned player independently enters the same paper result on a personal or shared device, then confirms their own entry. If a player cannot enter the result or the entries disagree, leave it pending for cross-checking.</p></section><section><h2>Directors</h2><p>Check in players first. After registration closes, publish the initial Table/Seat assignments and permanent verification IDs. Use the seating list for paper cards. Keep exceptions, missing entries, and mismatches pending for the authorized cross-check or judge workflow; do not mark them verified by hand.</p></section><p className="auth-note">Use the Rulebook area for the dated ACC reference. This guide explains app steps; it does not replace tournament rules.</p><Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to tournament</Link><SharedDeviceSignOut /></section></main>;
}
