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
    {/* Migration 0223 removed the separation of duties on this path on
        2026-09-18: the cross-checker-only gate, the self-confirmation gate and
        the distinct-reviewer gate were all dropped so one official can complete
        a paper game. It kept the double entry, the match check, and the rule
        that an official may not score a game they are playing in. The old
        wording promised a second person who is no longer required, which is a
        guarantee a director would repeat to players. The digital-versus-paper
        paragraph above is unchanged because 0148:264 still rejects the first
        official as the reviewer on that path. */}
    <section><h2>Two paper scorecards</h2><p>Both players keep their original paper cards. A cross checker, co-director, or director records both cards after play, and the same evidence is then entered a second time and has to match before the result becomes official. One official may do both steps, and the app records who did each. An official may never score a game they are playing in. Mismatched or missing cards stay unresolved for review.</p></section>
    <section><h2>Directors</h2><p>Check in players first. After registration closes, publish the initial Table/Seat assignments and permanent verification IDs. Use the seating list for paper cards. Keep exceptions, missing entries, and mismatches pending for the authorized cross-check or judge workflow; do not mark them verified by hand.</p></section>
    <p className="auth-note">Use the dated ACC Rulebook for the rule text. This guide explains app steps; it does not replace tournament rules.</p>
    <Link className="guide-link" href={"/tournament/" + tournamentId + "/rulebook"}>Open ACC Rulebook</Link>
    <Link className="guide-link" href={"/tournament/" + tournamentId}>Back to tournament</Link><SharedDeviceSignOut />
  </section></main>;
}
