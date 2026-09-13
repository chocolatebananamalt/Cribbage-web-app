import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { isUuid } from "../../../../lib/api/validation";
import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";

export default async function TournamentHowToPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  if (!isUuid(tournamentId)) notFound();
  await requireTournamentAccess(tournamentId);
  return <main className="auth-shell"><section className="auth-card" aria-labelledby="how-to-title">
    <p className="eyebrow">START HERE</p><h1 id="how-to-title">How To Use Tournament Desk</h1>
    <section><h2>Players</h2><p>Check your current Table/Seat before each game. Select the winner, enter the spread points, and submit your own result. A game becomes official only after the required independent records and confirmations agree.</p></section>
    <section><h2>One paper card and one digital card</h2><p>The digital player submits the result in the app. The paper player records the same game on the original paper card and keeps that card available for cross-checking.</p><p>One independent cross checker matches the digital submission to the paper card. A second distinct authorized official independently re-enters and confirms both sources. The result does not count until that exact second confirmation; a mismatch stays unresolved for investigation.</p></section>
    <section><h2>Two paper scorecards</h2><p>Both players keep their original paper cards. One independent cross checker records both cards after play. A second distinct cross checker, co-director, or director independently enters and confirms the same evidence before the result becomes official. Mismatched or missing cards stay unresolved for review.</p></section>
    <section><h2>Directors</h2><p>Check in players first. After registration closes, publish the initial Table/Seat assignments and permanent verification IDs. Use the seating list for paper cards. Keep exceptions, missing entries, and mismatches pending for the authorized cross-check or judge workflow; do not mark them verified by hand.</p></section>
    <p className="auth-note">Use the dated ACC Rulebook for the rule text. This guide explains app steps; it does not replace tournament rules.</p>
    <Link className="guide-link" href={"/tournament/" + tournamentId + "/rulebook"}>Open ACC Rulebook</Link>
    <Link className="guide-link" href={"/tournament/" + tournamentId}>Back to tournament</Link><SharedDeviceSignOut />
  </section></main>;
}
