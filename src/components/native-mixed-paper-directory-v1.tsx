import{paperDirectoryGameHrefV1,readPaperDirectoryV1,type PaperDirectoryV1}from'../lib/seating/native-mixed-paper-directory-v1';
import styles from'./native-mixed-director-panel-v1.module.css';
export function NativeMixedPaperDirectoryV1({enabled=false,directory}:{enabled?:boolean;directory:PaperDirectoryV1}){
 if(!enabled)return null;
 const d=readPaperDirectoryV1(directory,{actorId:directory.actorId,sessionId:directory.sessionId,tournamentId:directory.tournamentId,eventId:directory.eventId,startId:directory.startId});
 if(!d)return <p role="status">Paper games could not be verified.</p>;
 const rounds=[...new Set(d.games.map(g=>g.gameNumber))].sort((a,b)=>a-b);
 return <main className={styles.panel}><h1>Eligible Paper Games</h1><p>{d.tournamentName} — {d.eventName}</p><p>Simulated rehearsal only. This list shows matchup details checked when this page was loaded. It is not a pending-work list and includes games that may already be complete.</p><p>Open a game to check current access and its next permitted step. Submitted scores and review answers are not shown here. Independent re-entry is still required.</p><p>Tournament ID stays fixed; Current Seat is the chair for that game.</p>
 {!rounds.length&&<p role="status">No eligible paper games were returned for this account. This does not mean all paper work is complete.</p>}
 {rounds.map(round=><details key={round}><summary>Game {round}</summary><ul>{d.games.filter(g=>g.gameNumber===round).map(g=><li key={g.gameId}><a href={paperDirectoryGameHrefV1(d,g.gameId)!}>Open Game {round}: {g.sideA.displayName} (Tournament ID {g.sideA.fixedTournamentId}) vs {g.sideB.displayName} (Tournament ID {g.sideB.fixedTournamentId})</a><p>{g.sideA.mode==='paper'?'Paper':'Digital'} — Current Seat {g.sideA.currentSeat}; {g.sideB.mode==='paper'?'Paper':'Digital'} — Current Seat {g.sideB.currentSeat}</p></li>)}</ul></details>)}
 </main>;
}
