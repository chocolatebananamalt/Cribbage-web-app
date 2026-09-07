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
        <div className="brand" aria-label="American Cribbage Congress tournament desk prototype">
          <Image className="brand-logo" src="/branding/acc-logo.jpg" alt="American Cribbage Congress logo" width={1080} height={510} priority />
          <div><strong>AMERICAN<br />CRIBBAGE CONGRESS</strong><small>TOURNAMENT DESK · PROTOTYPE</small></div>
        </div>
        <div className="topbar-meta"><span className="prototype-badge">DESIGN REVIEW</span><span>Grass Roots · April 25, 2025</span></div>
      </header>

      <section className="hero">
        <div><p className="eyebrow">DIRECTOR VIEW / ROUND 3</p><h1>Keep every table moving.</h1><p className="lede">A senior-friendly tournament desk for registration, scoring, cross-checking, and results.</p></div>
        <div className="hero-stat"><strong>24</strong><span>players checked in</span><em>2 cards need review</em></div>
      </section>

      <nav className="section-nav" aria-label="Prototype sections">
        <a className="active" href="#score">Score entry</a><a href="#card">Scorecard</a><a href="#operations">Operations</a><a href="#results">Results</a>
      </nav>

      <div className="dashboard-grid">
        <section className="panel score-panel" id="score" aria-labelledby="score-title">
          <div className="panel-heading"><div><h2 id="score-title">Record game result</h2></div></div>
          <div className="matchup"><div><span>Player</span><strong>Barb Stevens</strong><small>Table A · Seat 7</small></div><div className="versus" aria-hidden="true">VS</div><div className="opponent"><span>Opponent</span><strong>Steve Hall</strong><small>Table A · Seat 8</small></div></div>
          <fieldset className="winner-choice"><legend>Who won this game?</legend><button type="button" aria-pressed={winner === "player"} className={winner === "player" ? "choice selected" : "choice"} onClick={() => setWinner("player")}>Barb won</button><button type="button" aria-pressed={winner === "opponent"} className={winner === "opponent" ? "choice selected" : "choice"} onClick={() => setWinner("opponent")}>Steve won</button></fieldset>
          <div className="margin-entry"><label htmlFor="margin">Winning margin <span>(1–121)</span></label><output id="margin" aria-live="polite" className={score ? "margin-value" : "margin-value invalid"}>{marginText || "—"}</output></div>
          <div className="keypad" aria-label="Winning margin keypad">{keypad.map((key) => <button type="button" key={key} onClick={() => enterKey(key)} aria-label={key === "backspace" ? "Delete last digit" : key === "clear" ? "Clear margin" : `Enter ${key}`}>{key === "backspace" ? "⌫" : key === "clear" ? "Clear" : key}</button>)}</div>
          <div className="derived-result" aria-live="polite">{score ? <><div><strong>{winner === "player" ? "Barb Stevens" : "Steve Hall"} wins by {score.margin}</strong><SkunkNote level={score.skunkLevel} /></div><dl><div><dt>Game points</dt><dd>{score.playerGamePoints}–{score.opponentGamePoints}</dd></div><div><dt>Plus / minus</dt><dd>{score.playerPlus} / {score.playerMinus}</dd></div></dl></> : <p className="error-text">{winner ? "Enter a whole number from 1 through 121." : "Choose the winner to begin score entry."}</p>}</div>
          <button type="button" className="primary-action" disabled={!score}>Review result (demo only)</button>
          <p className="demo-note">Synthetic data only. This review shell does not persist results or verify a tournament.</p>
        </section>

        <section className="panel card-panel" id="card" aria-labelledby="card-title">
          <div className="panel-heading"><div><p className="eyebrow">PAPER-STYLE VIEW</p><h2 id="card-title">Barb Stevens</h2></div><span className="seat-label">TABLE / SEAT <strong>A–7</strong></span></div>
          <div className="card-meta"><span>ACC No. DEMO-296</span><span>Round 3</span><span>Opponent: Steve Hall</span></div>
          <div className="score-table-wrap"><table><caption className="sr-only">Barb Stevens digital scorecard</caption><thead><tr><th>Game</th><th>Pts</th><th>Plus</th><th>Minus</th><th>Opponent</th><th>Table/Seat</th></tr></thead><tbody><tr><th scope="row">1</th><td>2</td><td>10</td><td>0</td><td>Steve Hall</td><td>A–8</td></tr><tr><th scope="row">2</th><td>2</td><td>11</td><td>0</td><td>Robin Lee</td><td>B–3</td></tr></tbody><tfoot><tr><th>Total</th><td>4</td><td>21</td><td>0</td><td colSpan={2}>Net {formatSignedNet(21)}</td></tr></tfoot></table></div>
          <div className="pending-preview" aria-live="polite"><div><span className="pending-label">Pending preview · not certified</span><strong>{score ? `${winner === "player" ? "Barb Stevens" : "Steve Hall"} wins by ${score.margin}` : "No new margin entered"}</strong></div><span>This live entry is not included in scorecard totals until the required independent entries and confirmations are complete.</span></div>
          <div className="card-summary"><div><span>Games</span><strong>2 <small>won</small> · 0 <small>lost</small></strong></div><div><span>Verification</span><strong className="status-text">Pending entry</strong></div><div><span>Checked by</span><strong>—</strong></div></div>
        </section>
      </div>

      <section className="summary-section" id="operations" aria-labelledby="operations-title"><div className="section-heading"><div><p className="eyebrow">AT A GLANCE</p><h2 id="operations-title">Tournament operations</h2></div><span className="section-caption">Static design-review cards</span></div><div className="summary-grid"><article className="summary-card"><span className="icon-chip blue">◎</span><div><span>Verification queue</span><strong>18 verified · 2 pending</strong><small>Two independent entries + two confirmations</small></div></article><article className="summary-card"><span className="icon-chip gold">♢</span><div><span>Cross-check desk</span><strong>2 cards need review</strong><small>Self-card corrections are blocked</small></div></article><article className="summary-card"><span className="icon-chip green">✓</span><div><span>Correction policy</span><strong>Immediate by default</strong><small>Director can require reason or approval</small></div></article><article className="summary-card" id="results"><span className="icon-chip coral">↗</span><div><span>Published results</span><strong>Results not published yet</strong><small>Demo tournament · 24 participants</small></div></article></div></section>

      <footer><span>ACC Tournament Desk · Fresh prototype shell</span><span>Rules, roles, verification, and exports remain subject to approved production gates.</span></footer>
    </main>
  );
}
