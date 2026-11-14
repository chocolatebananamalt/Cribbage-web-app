"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import type { PlayoffDisplay, PlayoffDisplayMatch } from "../lib/results/player-playoff-display";
import { bracketSections } from "../lib/results/playoff-bracket-layout";
import styles from "./playoff-bracket-diagram.module.css";

type Available = Extract<PlayoffDisplay, { status: "available" }>;
const label = (id: string) => id.replace(/^r(\d+)-m(\d+)$/, "Round $1, match $2");
function CompactMatch({ match }: { match: PlayoffDisplayMatch }) {
  return <article className={styles.card} data-testid="diagram-match" data-match-id={match.matchId} aria-label={label(match.matchId)}>
    <h4>{label(match.matchId)}</h4>
    <ol>{match.sides.map((side, index) => <li key={index} className={side.player?.participantId === match.winnerId ? styles.advanced : undefined}>
      {side.player ? <><strong>{side.player.displayName}</strong><span>Tournament ID <b>{side.player.tournamentId}</b></span><small>Seed {side.player.seed}</small>{side.player.participantId === match.winnerId && <b>{match.status === "bye" ? "Advances by bye" : "Advances · simulated winner"}</b>}</>
        : <span>{side.absentSeed !== null ? "Bye · no qualifier" : side.fromMatch ? `Winner of ${label(side.fromMatch)}` : "Opponent pending"}</span>}
    </li>)}</ol>
    <p>{match.status === "bye" ? "First-round bye · no match played" : match.status === "recorded" ? "Simulated result · advancing player highlighted" : match.status === "ready" ? "Awaiting result" : "Awaiting earlier results"}</p>
  </article>;
}

/** Local fictional renderer only. Geometry can accommodate 256; the caller must supply a validated draw. */
export default function PlayoffBracketDiagram({ display }: { display: Available }) {
  const sections = bracketSections(display.bracketSize);
  const [sectionId, setSectionId] = useState(sections[0].id);
  const section = sections.find(s => s.id === sectionId) ?? sections[0];
  const firstCount = section.columns[0].matchNumbers.length;
  return <section className={styles.diagram} aria-labelledby="diagram-title">
    <h2 id="diagram-title">Connected playoff bracket</h2>
    <p>Follow each pair of matches into the next round. Every path leads to one championship. Names and Tournament IDs stay with each player.</p>
    {sections.length > 1 && <label>Bracket Region<select value={section.id} onChange={event => setSectionId(event.target.value)}>{sections.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>}
    <p id="diagram-scroll-help">Scroll inside the bracket to see later rounds. Use Round details for a stacked phone view.</p>
    <div className={styles.scroller} tabIndex={0} role="region" aria-label={`${section.label} diagram`} aria-describedby="diagram-scroll-help">
      <div className={styles.headings} style={{ "--columns": section.columns.length } as CSSProperties}>{section.columns.map(column => <h3 key={column.round}>{display.rounds.find(round => round.round === column.round)?.label}</h3>)}</div>
      <div className={styles.grid} style={{ "--columns": section.columns.length, "--rows": firstCount * 2 } as CSSProperties}>
        {section.columns.flatMap((column, columnIndex) => column.matchNumbers.map((number, index) => {
          const match = display.rounds.find(round => round.round === column.round)?.matches.find(match => match.number === number);
          if (!match) return null;
          const span = 2 ** (columnIndex + 1);
          return <div key={match.matchId} className={`${styles.cell} ${columnIndex < section.columns.length - 1 ? index % 2 === 0 ? styles.topFeed : styles.bottomFeed : ""} ${columnIndex > 0 ? styles.receives : ""}`}
            style={{ gridColumn: columnIndex + 1, gridRow: `${index * span + 1} / span ${span}` }}><CompactMatch match={match}/></div>;
        }))}
      </div>
    </div>
    <p className={styles.champion}>{section.advancesTo ? `This region feeds ${label(section.advancesTo)} in Final rounds.` : display.champion ? `Example champion: ${display.champion.displayName}, Tournament ID ${display.champion.tournamentId}.` : "One championship · winner pending."}</p>
  </section>;
}
