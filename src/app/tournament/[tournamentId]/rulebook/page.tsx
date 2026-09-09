import Link from "next/link";
import { notFound } from "next/navigation";
import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";
import { isUuid } from "../../../../lib/api/validation";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import RulebookReference from "./rulebook-reference";

const cachedRulebook = "/rulebook/acc-rulebook-2025.pdf";
const officialRulebook = "https://www.cribbage.org/NewSite/rules/rulebook_2025.pdf";

export default async function TournamentRulebookPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  if (!isUuid(tournamentId)) notFound();
  await requireTournamentAccess(tournamentId);

  return <main className="auth-shell"><section className="auth-card corrections-card" aria-labelledby="rulebook-title"><p className="eyebrow">REFERENCE</p><h1 id="rulebook-title">ACC Rulebook</h1><p className="auth-note">Cached edition: ACC Official Tournament Rules 2025 · captured September 7, 2026 · SHA-256 DB284283420259C99CFCC960BFDF4A6B79C95A5FC1BEE02B1817B4AF4A02F9FD.</p><div className="reference-actions"><a className="primary pdf-link" href={cachedRulebook} target="_blank" rel="noreferrer">ACC Rulebook Cached</a><a className="secondary pdf-link" href={officialRulebook} target="_blank" rel="noreferrer">ACC Rulebook Online</a></div><RulebookReference /><Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to tournament</Link><SharedDeviceSignOut /></section></main>;
}
