"use client";
import{useId}from'react';
import styles from'./playoff-series-entry-v1.module.css';

export type PlayoffSeriesEntryStatusV1='ready'|'pending_offline'|'saved_awaiting_confirmation'|'waiting_opponent'|'conflicted'|'server_verified'|'series_complete'|'unavailable'|'source_changed'|'storage_blocked'|'unknown_outcome'|'rejected';
export type PlayoffSeriesEntryViewV1={
 actorParticipantId:string;players:[{participantId:string;displayName:string},{participantId:string;displayName:string}];
 roundLabel:string;matchLabel:string;gameNumber:number;winsRequired:number;maximumGames:number;seriesWins:[number,number];
 cachedState?:boolean;status:PlayoffSeriesEntryStatusV1;selectedWinnerParticipantId:string|null;ownSubmittedWinnerParticipantId:string|null;
 canSubmit:boolean;canConfirm:boolean;canRetry:boolean;canCheckOutcome:boolean;canRefresh:boolean;canReviewSaved?:boolean;canKeepCopy?:boolean;busy:boolean;
 /** Plain user-facing copy only. Never provide raw UUIDs, backend errors or stacks. */
 message:string;
};
export type PlayoffSeriesEntryCommandsV1={selectWinner:(participantId:string)=>void;submitResult:()=>void;confirmOwnEntry:()=>void;retryExact:()=>void;checkOutcome:()=>void;refresh:()=>void;reviewSaved?:()=>void;keepCopyAndContinue?:()=>void};
export type PlayoffSeriesEntryPropsV1={enabled?:boolean;view:PlayoffSeriesEntryViewV1|null;commands:PlayoffSeriesEntryCommandsV1};
const statusCopy:Record<PlayoffSeriesEntryStatusV1,{title:string;detail:string}>={
 ready:{title:'Choose Your Result',detail:'Select WON or LOST, then submit your result. Submission does not confirm it.'},
 pending_offline:{title:'Pending Offline',detail:'Your action is kept on this device. It has not been confirmed by the server.'},
 saved_awaiting_confirmation:{title:'Saved — Awaiting Your Confirmation',detail:'Review your saved entry, then use Confirm My Entry. Submitting alone does not confirm it.'},
 waiting_opponent:{title:'Waiting for Your Opponent',detail:'Your part is complete. The game verifies only after both players submit matching entries and confirm their own entry.'},
 conflicted:{title:'Entries Do Not Match',detail:'This game has not advanced. Review your entry; any change must be submitted and confirmed separately.'},
 server_verified:{title:'Game Verified',detail:'Matching entries and two independent player confirmations were verified by the server.'},
 series_complete:{title:'Series Complete',detail:'No further game entry is available for this series.'},
 unavailable:{title:'Game Entry Unavailable',detail:'Current game information is unavailable. Nothing can be submitted here.'},
 source_changed:{title:'Game Information Changed',detail:'Refresh the game before continuing. Retained work must be reviewed rather than silently changed.'},
 storage_blocked:{title:'Local Recovery Is Unavailable',detail:'Do not submit another action until safe recovery is available. Keep this page and any pending work intact.'},
 unknown_outcome:{title:'Outcome Not Yet Known',detail:'The last action may have reached the server. Check its outcome or retry the exact retained action.'},
 rejected:{title:'Saved Entry Needs Review',detail:'The saved entry was rejected. Review it against the current match before choosing a new action. The saved request and its response must be kept.'},
};
const number=(v:number)=>Number.isSafeInteger(v)&&v>=0?String(v):'—';
/** Controlled presentation only. The injected controller must establish native
 * identity/source authority, persist before transport, and enforce single-flight
 * commands. No fetch, storage, identity selection or automatic confirmation.
 */
export function PlayoffSeriesEntryV1({enabled=false,view,commands}:PlayoffSeriesEntryPropsV1){
 const id=useId();
 if(!enabled||!view)return<section className={styles.panel} aria-label="Playoff Game Entry"><h2>Playoff Game Entry</h2><p role="status">Game entry is unavailable. No result can be submitted.</p></section>;
 const ownIndex=view.players.findIndex(p=>p.participantId===view.actorParticipantId),opponentIndex=ownIndex===0?1:0;
 if(ownIndex<0||view.players[0].participantId===view.players[1].participantId||!Number.isSafeInteger(view.gameNumber)||view.gameNumber<1)return<section className={styles.panel} aria-label="Playoff Game Entry"><h2>Playoff Game Entry</h2><p role="status">Current player or game information is unavailable. Refresh before continuing.</p></section>;
 const own=view.players[ownIndex],opponent=view.players[opponentIndex],name=own.displayName||'You',selected=view.selectedWinnerParticipantId;
 const knownWinner=(winner:string|null)=>winner===own.participantId||winner===opponent.participantId;
 const locked=view.busy||!Object.hasOwn(statusCopy,view.status)||['pending_offline','server_verified','series_complete','unavailable','source_changed','storage_blocked','unknown_outcome','rejected'].includes(view.status);
 const canSubmit=!locked&&view.canSubmit&&knownWinner(selected),saved=view.ownSubmittedWinnerParticipantId;
 const unsentChoice=knownWinner(selected)&&knownWinner(saved)&&selected!==saved;
 const canConfirm=!locked&&view.canConfirm&&knownWinner(saved)&&!unsentChoice;
 const status=statusCopy[view.status]??statusCopy.unavailable;
 return<section className={styles.panel} aria-labelledby={`${id}-heading`}>
  <header className={styles.header}><p className={styles.round}>{view.roundLabel}</p><h2 id={`${id}-heading`}>{view.matchLabel}</h2><p className={styles.format}>First to {number(view.winsRequired)} Wins - Up to {number(view.maximumGames)} Games</p><p className={styles.game}>Game {number(view.gameNumber)}</p></header>
  {view.cachedState&&<p>Last checked series wins — saved information, not current verification.</p>}
  <div className={styles.series} aria-label={view.cachedState?"Last Checked Series Wins":"Series Wins"}><div><span>You — {name}</span><strong>{number(view.seriesWins[ownIndex])}<span className={styles.winWord}> Wins</span></strong></div><div><span>Opponent — {opponent.displayName||'Opponent'}</span><strong>{number(view.seriesWins[opponentIndex])}<span className={styles.winWord}> Wins</span></strong></div></div>
  <div className={styles.status} role="status" aria-live="polite" data-status={view.status}><h3>{status.title}</h3><p>{status.detail}</p>{view.message&&<p>{view.message}</p>}</div>
  <div className={styles.choices} role="group" aria-label="Your Game Result">
   <button type="button" className={styles.won} aria-pressed={selected===own.participantId} disabled={locked} onClick={()=>{if(!locked)commands.selectWinner(own.participantId);}}>{name} WON</button>
   <button type="button" className={styles.lost} aria-pressed={selected===opponent.participantId} disabled={locked} onClick={()=>{if(!locked)commands.selectWinner(opponent.participantId);}}>{name} LOST</button>
  </div>
  {knownWinner(saved)&&<p className={styles.saved}>Your Saved Entry: <strong>{name} {saved===own.participantId?'WON':'LOST'}</strong></p>}
  {unsentChoice&&<p className={styles.notice}>Submit your changed choice before confirming it.</p>}
  <div className={styles.actions}><button type="button" disabled={!canSubmit} onClick={()=>{if(canSubmit)commands.submitResult();}}>Submit Result</button><button type="button" disabled={!canConfirm} onClick={()=>{if(canConfirm)commands.confirmOwnEntry();}}>Confirm My Entry</button></div>
  <p className={styles.help}>Submitting and confirming are separate actions. Selecting WON or LOST never confirms a result.</p>
  {(view.canRetry||view.canCheckOutcome||view.canRefresh||view.canReviewSaved||view.canKeepCopy)&&<div className={styles.recovery} aria-label="Game Recovery Actions">
   {view.canRetry&&<button type="button" disabled={view.busy} onClick={()=>{if(!view.busy)commands.retryExact();}}>Sync Saved Entry</button>}
   {view.canCheckOutcome&&<button type="button" disabled={view.busy} onClick={()=>{if(!view.busy)commands.checkOutcome();}}>Check Saved Entry</button>}
   {view.canRefresh&&<button type="button" disabled={view.busy} onClick={()=>{if(!view.busy)commands.refresh();}}>Refresh Match</button>}
   {view.canReviewSaved&&<button type="button" disabled={view.busy||!commands.reviewSaved} onClick={()=>{if(!view.busy)commands.reviewSaved?.();}}>Review Saved Entry</button>}
   {view.canKeepCopy&&<button type="button" disabled={view.busy||!commands.keepCopyAndContinue} onClick={()=>{if(!view.busy)commands.keepCopyAndContinue?.();}}>Keep Saved Copy and Continue</button>}
  </div>}
 </section>;
}
