"use client";
import Link from "next/link";
import FictionalDrawAction from "./fictional-draw-action";
import { useState } from "react";
import type { ReviewedDrawSchedulePreview } from "../lib/seating/reviewed-draw-schedule";
import styles from "./reviewed-draw-publisher.module.css";
export default function ReviewedDrawSchedulePreviewClient({preview,tournamentId,actorId,fictionalEnabled}:{preview:ReviewedDrawSchedulePreview;tournamentId:string;actorId:string;fictionalEnabled:boolean}){
 const[round,setRound]=useState(1);
 if(preview.status==="blocked")return<section className={styles.panel}><h2>Schedule preview unavailable</h2><p role="status">The published draw, enrolled players and event status could not be matched. Keep the existing IDs and schedule unchanged.</p><Link href={`/tournament/${tournamentId}/participants`}>Review event participants</Link></section>;
 const name=(fixedId:string)=>preview.participantBindings.find(p=>p.tournamentId===fixedId)?.displayName??"Tournament player";
 return<section className={styles.panel} aria-label="Schedule from the published draw"><h2>Schedule from the published draw</h2>
 <p>18 players · 12 games each · 108 matches. Tournament IDs stay fixed; Table/Seat changes each game.</p>
 <p role="status">Preview only. No schedule has been published and play has not started.</p>
 <label>Show Game<select value={round} onChange={e=>setRound(Number(e.target.value))}>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>Game {i+1}</option>)}</select></label>
 <div className={styles.table}><table><caption>Game {round} — nine matches</caption><thead><tr><th>Player</th><th>Tournament ID#</th><th>Table/Seat</th><th>Opponent</th><th>Opponent ID#</th><th>Table/Seat</th></tr></thead><tbody>{preview.matches.filter(m=>m.gameNumber===round).map(m=><tr key={m.sideAVerificationId}><td>{name(m.sideAVerificationId)}</td><td>{m.sideAVerificationId}</td><td>{m.sideATableSeat}</td><td>{name(m.sideBVerificationId)}</td><td>{m.sideBVerificationId}</td><td>{m.sideBTableSeat}</td></tr>)}</tbody></table></div>
 {fictionalEnabled?<FictionalDrawAction actorId={actorId} tournamentId={tournamentId} eventId={preview.eventId} reviewedOperationId={preview.reviewedOperationId}/>:null}<p>Check the player enrollment and physical layout before a separate schedule approval. This preview does not change results or start games.</p>
 <Link href={`/tournament/${tournamentId}/participants`}>Event participants</Link><br/><Link href={`/tournament/${tournamentId}/seating-directory`}>Seating assignments</Link><br/><Link href={`/tournament/${tournamentId}`}>Back to tournament</Link>
 </section>;
}

