"use client";

import { useEffect, useState } from "react";
import { playoffDisplayVersion, playerPlayoffNext, projectPlayerPlayoff, type PlayoffDisplayInput, type PlayoffDisplayMatch, type PlayoffDisplayPlayer, type PlayoffDisplayResult } from "../lib/results/player-playoff-display";
import PlayoffBracketDiagram from "./playoff-bracket-diagram";
import styles from "./local-playoff-preview.module.css";

type Example = "five" | "five-progress" | "thirty-three" | "sixty-four" | "unsupported";
const examples: Array<{ id: Example; label: string; qualifiers: number }> = [
  { id: "five", label: "5 qualifiers — no played results", qualifiers: 5 },
  { id: "five-progress", label: "5 qualifiers — synthetic progress", qualifiers: 5 },
  { id: "thirty-three", label: "33 qualifiers — no played results", qualifiers: 33 },
  { id: "sixty-four", label: "64 qualifiers — no played results", qualifiers: 64 },
  { id: "unsupported", label: "125 qualifiers from 500 entrants — unsupported", qualifiers: 125 },
];
const names = ["Jordan Morgan Ellis", "Alexandra Catherine Montgomery-Sullivan", "Benjamin Thomas Rivera", "Catherine Elizabeth Thompson", "Daniel Joseph Williams", "Eleanor Grace Henderson", "Francisco Miguel Navarro", "Genevieve Anne Richardson"];
const uuid = (n: number) => `a9110000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function exampleInput(example: Example): PlayoffDisplayInput {
  const count = examples.find(e => e.id === example)!.qualifiers;
  const input: PlayoffDisplayInput = {
    kind: "player-playoff-display-input-v2", tournamentId: uuid(1), eventId: uuid(2), qualificationVersionId: uuid(3), sourceDigest: "a".repeat(64),
    sourceCurrent: true, qualificationReviewed: true, tiesResolved: true, eventType: "main", entrantCount: count * 4, qualifierCount: count,
    players: Array.from({ length: count }, (_, i) => ({ participantId: uuid(100 + i), displayName: i === 0 || i === 16 ? names[0] : names[i % names.length], tournamentId: `${String.fromCharCode(65 + Math.floor(i / 20))}-${i % 20 + 1}`, seed: i + 1 })), results: [],
  };
  if (example === "five-progress") {
    // This is generated from the exact projected sides, never a guessed path.
    // One fictional result demonstrates an opponent becoming known after a bye.
    const initial = projectPlayerPlayoff(input);
    const match = initial.status === "available" ? initial.rounds[0].matches.find(m => m.matchId === "r1-m2") : null;
    if (match?.status === "ready" && match.sides[0].player && match.sides[1].player) {
      const result: PlayoffDisplayResult = { matchId: match.matchId, sideAId: match.sides[0].player.participantId, sideBId: match.sides[1].player.participantId,
        parentBindings: [null, null], bracketVersion: playoffDisplayVersion, winnerId: match.sides[1].player.participantId,
        resultId: uuid(900), sourceSeriesOrdinal: null, revision: 1, qualificationVersionId: input.qualificationVersionId, sourceDigest: input.sourceDigest, provenance: "synthetic-example" };
      input.results = [result];
    }
  }
  return input;
}
const matchLabel = (id: string) => { const parsed = /^r(\d+)-m(\d+)$/.exec(id); return parsed ? `Round ${parsed[1]}, match ${parsed[2]}` : "earlier match"; };
function PlayerName({ player }: { player: PlayoffDisplayPlayer }) {
  return <><strong className={styles.playerName}>{player.displayName}</strong><span className={styles.playerId}>Tournament ID <b>{player.tournamentId}</b> · qualifying seed {player.seed}</span></>;
}
function MatchCard({ match, highlighted, example, forwardLabel }: { match: PlayoffDisplayMatch; highlighted: boolean; example: Example; forwardLabel: string | null }) {
  const advanced = match.sides.find(s => s.player?.participantId === match.winnerId)?.player;
  return <article className={`${styles.match} ${highlighted ? styles.highlighted : ""}`} id={`${example}-${match.matchId}`} tabIndex={-1} data-testid="bracket-match" data-match-id={match.matchId}>
    <h4>{matchLabel(match.matchId)}</h4>
    <ol className={styles.sides}>{match.sides.map((side, i) => <li key={i}>{side.player ? <PlayerName player={side.player}/> : <p className={styles.waiting}>{side.absentSeed !== null ? `No qualifier at seed ${side.absentSeed}.` : side.fromMatch ? `Waiting for the result of ${matchLabel(side.fromMatch)}.` : "Opponent is not established."}</p>}</li>)}</ol>
    {match.status === "bye" ? <p className={styles.bye}><strong>First-round bye</strong><br/>{advanced?.displayName} advances without a played match.</p>
      : match.status === "recorded" ? <p className={styles.result}><strong>Simulated result</strong><br/>{advanced?.displayName} advances. This example is not an official result.</p>
        : match.status === "ready" ? <p className={styles.ready}>Both players are known in this example.</p> : <p className={styles.waiting}>Pairing is waiting for an earlier result.</p>}
    <p>{forwardLabel ? `Advancing player goes to ${forwardLabel}.` : "Last match of this example draw."}</p>
  </article>;
}

/** Isolated fictional rendering only. No fetch, storage, auth or record actions. */
export default function LocalPlayoffPreview() {
  const [view, setView] = useState<"rounds" | "diagram">("rounds");
  const [example, setExample] = useState<Example>("five"), [roundNumber, setRoundNumber] = useState(1), [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(uuid(100)), [highlightId, setHighlightId] = useState<string | null>(null);
  const input = exampleInput(example), display = projectPlayerPlayoff(input);
  const query = search.trim().toLocaleLowerCase("en-US"), exactId = display.status === "available" ? display.players.find(p => p.tournamentId.toLocaleLowerCase("en-US") === query) : null;
  const found = display.status === "available" && query ? exactId ? [exactId] : display.players.filter(p => p.displayName.toLocaleLowerCase("en-US").includes(query) || p.tournamentId.toLocaleLowerCase("en-US").includes(query)) : [];
  const next = playerPlayoffNext(display, selectedId), round = display.status === "available" ? display.rounds.find(r => r.round === roundNumber) ?? display.rounds[0] : null;
  useEffect(() => { if (view !== "rounds" || !highlightId) return; document.getElementById(`${example}-${highlightId}`)?.focus({ preventScroll: false }); }, [example, highlightId, roundNumber, view]);
  function choosePlayer(player: PlayoffDisplayPlayer) {
    setSelectedId(player.participantId); setHighlightId(null);
  }
  return <main className={styles.preview}>
    <p className={styles.banner}><strong>LOCAL SYNTHETIC EXAMPLE</strong><br/>Fictional names, IDs, qualification and result data. This page does not show official tournament results.</p>
    <h1>Player playoff bracket preview</h1>
    <p>Find your name and Tournament ID, then read your next pairing. A Tournament ID identifies a player in this example; it is not an ACC membership number or a table or seat assignment.</p>
    <div className={styles.controls}><label>Fictional Bracket Example<select value={example} onChange={e => { setExample(e.target.value as Example); setView("rounds"); setRoundNumber(1); setSearch(""); setSelectedId(uuid(100)); setHighlightId(null); }}>{examples.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}</select></label></div>
    <section className={styles.summary} data-testid="example-summary" aria-label="Example summary"><h2>Example field</h2><p>{input.entrantCount} fictional entrants · {input.qualifierCount} qualifiers.</p>
      {display.status === "available" && <><p>{display.bracketSize}-position draw · {display.byeCount} first-round {display.byeCount === 1 ? "bye" : "byes"}.</p><p>Qualifying seeds {display.byeSeedRanks.length ? display.byeSeedRanks.join(", ") : "none"} have first-round byes. A bye is advancement without a played match.</p></>}
    </section>
    {display.status === "blocked" ? <section className={styles.blocked} role="status"><h2>Bracket display unavailable</h2><p>This fictional case is blocked: <strong>{display.code.replaceAll("_", " ")}</strong>.</p><p>{display.code === "placement_above_64_unverified" ? "The verified ACC chart covers 256 original entrants, which is 64 qualifiers. Larger qualifier fields need a reviewed placement source. The regional layout is prepared for up to 256 positions, but no larger draw is guessed." : "Current source validation is unavailable for this example. No bracket is displayed."}</p></section> : <>
      <section className={styles.finder} aria-labelledby="player-finder-title"><h2 id="player-finder-title">Find a player</h2><label>Find Player by Name or Tournament ID<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Full name or A-1"/></label>
        {query && <><p role="status">{found.length} matching {found.length === 1 ? "player" : "players"}. Match the Tournament ID when names repeat.</p><ul className={styles.searchResults}>{found.map(p => <li key={p.participantId}><button type="button" onClick={() => choosePlayer(p)}>Show {p.displayName}, Tournament ID {p.tournamentId}</button></li>)}</ul></>}
        <div className={styles.next} data-testid="player-next" aria-live="polite"><h3>Next pairing</h3>{"player" in next && next.player && <><p>Selected example player:</p><PlayerName player={next.player}/></>}
          {next.status === "opponent-known" ? <><p>Next opponent in {matchLabel(next.matchId)}:</p><PlayerName player={next.opponent!}/></>
            : next.status === "waiting-opponent" ? <p>Waiting for an opponent in {matchLabel(next.matchId)}{next.fromMatch ? ` — the result of ${matchLabel(next.fromMatch)} is needed` : ""}.</p>
              : next.status === "eliminated" ? <p>This fictional player is out after round {next.round}. There is no next opponent in this draw.</p>
                : next.status === "champion" ? <p>This fictional player has reached the end of this example draw.</p> : <p>A next pairing is not established.</p>}
          {(next.status === "opponent-known" || next.status === "waiting-opponent") && <button type="button" onClick={() => { setView("rounds"); setRoundNumber(next.round); setHighlightId(next.matchId); }}>Show this match</button>}
        </div>
      </section>
      <div className={styles.controls} role="group" aria-label="Bracket view"><button type="button" aria-pressed={view === "rounds"} onClick={() => setView("rounds")}>Round details</button>{" "}<button type="button" aria-pressed={view === "diagram"} onClick={() => setView("diagram")}>Connected bracket</button></div>
      {view === "diagram" ? <PlayoffBracketDiagram key={example} display={display}/> : <section className={styles.round} data-testid="bracket-round" aria-labelledby="round-title"><div className={styles.controls}><label>Round to Display<select value={round?.round ?? 1} onChange={e => { setRoundNumber(Number(e.target.value)); setHighlightId(null); }}>{display.rounds.map(r => <option key={r.round} value={r.round}>{r.label} — {r.matches.length} {r.matches.length === 1 ? "match" : "matches"}</option>)}</select></label></div><h2 id="round-title">{round?.label}</h2><p>Matches stay in bracket order. Each section contains at most four matches.</p>
        {round && Array.from({ length: Math.ceil(round.matches.length / 4) }, (_, group) => {
          const matches = round.matches.slice(group * 4, group * 4 + 4);
          return <section className={styles.matchGroup} key={group} data-testid="round-section" aria-labelledby={`group-${group}`}><h3 id={`group-${group}`}>Matches {matches[0].number}{matches.length > 1 ? `–${matches.at(-1)!.number}` : ""}</h3><div className={styles.matchGrid}>{matches.map(match => { const nextRound = display.rounds.find(r => r.round === match.round + 1), forward = nextRound?.matches[Math.floor((match.number - 1) / 2)]; const forwardLabel = forward ? `${nextRound?.label === 'Championship' ? 'Championship, ' : ''}${matchLabel(forward.matchId)}` : null; return <MatchCard key={match.matchId} match={match} highlighted={highlightId === match.matchId} example={example} forwardLabel={forwardLabel}/>; })}</div></section>;
        })}
      </section>
      }
      <details className={styles.source}><summary>About this local example</summary><p>Only synthetic input is generated here. No table assignment, score entry, qualification approval, payment or account action is available.</p><p>Chart reference: <a href={display.sourceUrl} target="_blank" rel="noreferrer">2025 ACC rulebook placement chart</a>. The layout reference does not make these example results official.</p><p>Display version: {display.version}. Qualification example version: {display.qualificationVersionId}.</p><p>Example source: {display.sourceDigest}.</p></details>
    </>}
  </main>;
}
