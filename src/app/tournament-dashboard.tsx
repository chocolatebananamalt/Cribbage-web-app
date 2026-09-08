"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { deriveScore, formatSignedNet, isScoreEntryReady } from "../lib/score";

const keypad = [1, 2, 3, 4, 5, 6, 7, 8, 9, "clear", 0, "backspace"] as const;

function SkunkNote({ level }: { level: 0 | 1 | 2 | 3 }) {
  if (!level) return null;
  return (
    <span className="skunk-note" role="status">
      {"🦨".repeat(level)} {level === 1 ? "Skunk" : level === 2 ? "Double skunk" : "Triple skunk"}
    </span>
  );
}

export function TournamentDashboard() {
  const [marginText, setMarginText] = useState("");
  const [winner, setWinner] = useState<"player" | "opponent" | null>(null);
  const parsedMargin = Number(marginText);
  const score = useMemo(() => {
    if (!isScoreEntryReady(parsedMargin, winner)) return null;
    try {
      return deriveScore(parsedMargin, winner);
    } catch {
      return null;
    }
  }, [parsedMargin, winner]);

  function enterKey(key: (typeof keypad)[number]) {
    if (key === "clear") return setMarginText("");
    if (key === "backspace") return setMarginText((value) => value.slice(0, -1));
    setMarginText((value) => (value === "0" ? String(key) : `${value}${key}`));
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand" aria-label="American Cribbage Congress tournament desk">
          <Image className="brand-logo" src="/branding/acc-logo.jpg" alt="American Cribbage Congress logo" width={1080} height={510} priority />
          <div><strong>AMERICAN<br />CRIBBAGE CONGRESS</strong><small>TOURNAMENT DESK</small></div>
        </div>
        <div className="topbar-meta"><span className="prototype-badge">ROUND 3</span><span>Grass Roots · April 25, 2025</span></div>
      </header>

      <section className="hero">
        <div><p className="eyebrow">DIRECTOR VIEW / ROUND 3</p><h1>Keep every table moving.</h1><p className="lede">A senior-friendly tournament desk for registration, scoring, cross-checking, and results.</p></div>
        <div className="hero-stat"><strong>24</strong><span>players checked in</span><em>2 cards need review</em></div>
      </section>

      <nav className="section-nav" aria-label="Tournament sections">
        <a className="active" href="#score">Score Entry</a><a href="#card">Scorecard</a><a href="#operations">Operations</a><a href="#results">Results</a>
      </nav>

      <div className="dashboard-grid">
        <section className="panel score-panel" id="score" aria-labelledby="score-title">
          <div className="panel-heading"><div><p className="eyebrow">SCORE ENTRY</p><h2 id="score-title">Game Result</h2></div><p className="tournament-context">Grass Roots · Honolulu, HI<br />Apr. 25, 2025 · Main</p></div>
          <div className="matchup"><div><span>Player</span><strong>Barb Stevens</strong><small>Table A · Seat 7</small></div><div className="versus" aria-hidden="true">VS</div><div className="opponent"><span>Opponent</span><strong>Steve Hall</strong><small>Table A · Seat 8</small></div></div>
          <fieldset className="winner-choice"><legend>Game Winner:</legend><button type="button" aria-pressed={winner === "player"} className={winner === "player" ? "choice selected" : "choice"} onClick={() => setWinner("player")}>Barb won</button><button type="button" aria-pressed={winner === "opponent"} className={winner === "opponent" ? "choice selected" : "choice"} onClick={() => setWinner("opponent")}>Steve won</button></fieldset>
          <div className="margin-entry"><label htmlFor="margin">Spread Points</label><SkunkNote level={score?.skunkLevel ?? 0} /><output id="margin" aria-live="polite" className={score ? "margin-value" : "margin-value invalid"}>{marginText || "—"}</output></div>
          <div className="keypad" aria-label="Spread points keypad">{keypad.map((key) => <button type="button" key={key} onClick={() => enterKey(key)} aria-label={key === "backspace" ? "Delete last digit" : key === "clear" ? "Clear spread points" : `Enter ${key}`}>{key === "backspace" ? "⌫" : key === "clear" ? "Clear" : key}</button>)}</div>
          <div className="derived-result" aria-live="polite">{score ? <div className="result-preview"><div className="result-line"><strong>{winner === "player" ? "Barb Stevens" : "Steve Hall"} won by {score.margin}</strong><dl><div><dt>Game Points</dt><dd>{winner === "player" ? score.playerGamePoints : score.opponentGamePoints}</dd></div><div><dt>Spread Points</dt><dd>{winner === "player" ? `+${score.margin}` : `+${score.margin}`}</dd></div></dl></div><div className="result-line opponent-result"><strong>{winner === "player" ? "Steve Hall" : "Barb Stevens"} lost by {score.margin}</strong><dl><div><dt>Game Points</dt><dd>{winner === "player" ? score.opponentGamePoints : score.playerGamePoints}</dd></div><div><dt>Spread Points</dt><dd>-{score.margin}</dd></div></dl></div></div> : <p className="error-text">{winner ? "Enter a valid whole number." : "Choose the winner to begin score entry."}</p>}</div>
          <button type="button" className="primary-action" disabled={!score}>Review Result</button>
        </section>

        <section className="panel card-panel" id="card" aria-labelledby="card-title">
          <div className="panel-heading"><div><p className="eyebrow">SCORECARD</p><h2 id="card-title">Barb Stevens, HI-296</h2></div><span className="seat-label">TABLE/SEAT <strong>A-7</strong></span></div>
          <div className="card-meta"><span>Game 3 of 12</span><span>Opponent: Steve Hall</span><span>Grass Roots · Honolulu, HI · Apr. 25, 2025 · Main</span></div>
          <div className="score-table-wrap"><table><caption className="sr-only">Barb Stevens digital scorecard</caption><thead><tr><th colSpan={2} scope="colgroup">Game</th><th colSpan={2} scope="colgroup">Spread Points</th><th rowSpan={2} scope="col">Opponent</th><th rowSpan={2} scope="col">Verification</th></tr><tr><th scope="col">#</th><th scope="col">Points</th><th scope="col">+</th><th scope="col">−</th><th scope="col">ID #</th></tr></thead><tbody><tr><th scope="row">1</th><td>2</td><td>10</td><td>—</td><td>Steve Hall</td><td>A-8</td></tr><tr><th scope="row">2</th><td>2</td><td>11</td><td>—</td><td>Robin Lee</td><td>B-3</td></tr><tr className="pending-row"><th scope="row">3</th><td>{score ? score.playerGamePoints : "—"}</td><td>{score ? score.playerPlus || "—" : "—"}</td><td>{score ? score.playerMinus || "—" : "—"}</td><td>Steve Hall</td><td>A-8</td></tr>{Array.from({ length: 9 }, (_, index) => <tr key={index + 4}><th scope="row">{index + 4}</th><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>)}</tbody><tfoot><tr><th>Total</th><td>4</td><td>21</td><td>—</td><td colSpan={2}>Net {formatSignedNet(21)}</td></tr></tfoot></table></div>
          <div className="card-summary"><div><span>Games Won</span><strong>2</strong></div><div><span>Verification</span><strong className="status-text">Pending entry</strong></div></div>
        </section>
      </div>

      <section className="summary-section" id="operations" aria-labelledby="operations-title"><div className="section-heading"><div><p className="eyebrow">AT A GLANCE</p><h2 id="operations-title">Tournament operations</h2></div></div><div className="summary-grid"><article className="summary-card"><span className="icon-chip blue">◎</span><div><span>Verification queue</span><strong>18 verified · 2 pending</strong><small>Two independent entries + two confirmations</small></div></article><article className="summary-card"><span className="icon-chip gold">♢</span><div><span>Cross-check desk</span><strong>2 cards need review</strong><small>Self-card corrections are blocked</small></div></article><article className="summary-card"><span className="icon-chip green">✓</span><div><span>Correction policy</span><strong>Immediate by default</strong><small>Director can require reason or approval</small></div></article><article className="summary-card" id="results"><span className="icon-chip coral">↗</span><div><span>Published results</span><strong>Results not published yet</strong><small>24 registered participants</small></div></article></div></section>

      <footer><span>ACC Tournament Desk</span><span>Grass Roots · Honolulu, HI · April 25, 2025</span></footer>
    </main>
  );
}
