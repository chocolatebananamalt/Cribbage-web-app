import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { isUuid } from "../../../../lib/api/validation";
import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";

export default async function TournamentHowToPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  if (!isUuid(tournamentId)) notFound();
  await requireTournamentAccess(tournamentId);
  return <main className="auth-shell"><section className="auth-card" aria-labelledby="how-to-title"><p className="eyebrow">START HERE</p><h1 id="how-to-title">How To Use Tournament Desk</h1><section><h2>Players</h2><p>Check your current Table/Seat before each game. Select the winner, enter the spread points, and submit your own result. A game becomes official only after both players independently submit matching results and each confirms their own entry.</p></section><section><h2>One paper card and one digital card</h2><p>Keep the paper card with the game as the shared reference. Both assigned players still need to sign in as themselves, independently enter that same result, and confirm their own entry. If they share one device, the first player must sign out before the second player signs in; never enter or confirm a result while signed in as the other player.</p><p>If a paper-only player cannot sign in and submit their own entry, do not treat a single digital entry as verified. Leave the game pending and use the authorized cross-check or judge process.</p></section><section><h2>Directors</h2><p>Check in players first. After registration closes, publish the initial Table/Seat assignments and permanent verification IDs. Use the seating list for paper cards. Keep exceptions, missing entries, and mismatches pending for the authorized cross-check or judge workflow; do not mark them verified by hand.</p></section><p className="auth-note">Use the dated ACC Rulebook for the rule text. This guide explains app steps; it does not replace tournament rules.</p><Link className="guide-link" href={`/tournament/${tournamentId}/rulebook`}>Open ACC Rulebook</Link><Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to tournament</Link><SharedDeviceSignOut /></section></main>;
}
