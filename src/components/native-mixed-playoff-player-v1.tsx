'use client';
import{useId,useLayoutEffect,useRef,useState}from'react';
import{buildNativeMixedPlayoffOwnCommandV1,projectNativeMixedPlayoffOwnV1,isNativeMixedPlayoffOwnScopeV1,type NativeMixedPlayoffOwnCommandV1,type NativeMixedPlayoffOwnScopeV1}from'../lib/playoffs/native-mixed-playoff-own-view-v1';
import './native-mixed-playoff-player-v1.css';
type Props={enabled?:boolean;online?:boolean;connected?:boolean;controlsBlocked?:boolean;scope:NativeMixedPlayoffOwnScopeV1;state:unknown;onCommand?:(command:NativeMixedPlayoffOwnCommandV1)=>void|Promise<void>;onRefresh?:()=>void|Promise<void>};
/** Unwired/default-off review slice. No route, provider, credential, operation
 * ID, pending store or durable-recovery claim. Host owns those future gates. */
export function NativeMixedPlayoffPlayerV1(props:Props){
 if(props.enabled!==true)return <section className="native-mixed-playoff-player" aria-label="Practice Playoffs"><p>Practice playoffs are not enabled.</p></section>;
 if(!isNativeMixedPlayoffOwnScopeV1(props.scope))return <section className="native-mixed-playoff-player" aria-label="Practice Playoffs"><p role="status">Current playoff information is unavailable.</p></section>;
 return <Active key={JSON.stringify([props.scope.tournamentId,props.scope.eventId,props.scope.participantId,props.scope.tournamentIdNumber])} {...props}/>;
}
function Active({scope,state,online=false,connected=false,controlsBlocked=false,onCommand,onRefresh}:Props){
 const id=useId(),v=projectNativeMixedPlayoffOwnV1(state,scope),[choice,setChoice]=useState<'own'|'opponent'|null>(null),[pinned,setPinned]=useState<string|null>(null),[attempted,setAttempted]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const sourceKey=JSON.stringify(v.state),changed=pinned!==null&&pinned!==sourceKey;
 const lease={sourceKey,online,onCommand,onRefresh,busy,choice,pinned,attempted};
 const latest=useRef<object|null>(null),alive=useRef(false),flight=useRef<object|null>(null);
 const activeOwner=useRef({sourceKey,onCommand,onRefresh});
 useLayoutEffect(()=>{activeOwner.current={sourceKey,onCommand,onRefresh};},[sourceKey,onCommand,onRefresh]);
 const ownerCurrent=()=>activeOwner.current.sourceKey===sourceKey&&activeOwner.current.onCommand===onCommand&&activeOwner.current.onRefresh===onRefresh;
 // Commit a fresh render lease every render; held handlers cannot reuse it.
 useLayoutEffect(()=>{alive.current=true;latest.current=lease;return()=>{alive.current=false;if(latest.current===lease)latest.current=null;};});
 const current=()=>alive.current&&latest.current===lease&&!flight.current;
 const locked=busy||attempted||changed||!online||!onCommand||controlsBlocked;
 function select(next:'own'|'opponent'){
  if(!current()||locked||v.phase!=='entry'||choice===next)return;latest.current=null;setChoice(next);setPinned(sourceKey);setMessage('');
 }
 async function dispatch(confirm=false){
  if(!current()||locked||!onCommand||!v.state)return;const fixedScope={tournamentId:v.state.tournamentId,eventId:v.state.eventId,...v.state.own},c=buildNativeMixedPlayoffOwnCommandV1(v.state,fixedScope,confirm?'confirm':choice??'confirm');if(!c)return;
  const token={};flight.current=token;latest.current=null;setPinned(sourceKey);setAttempted(!connected);setBusy(true);setMessage('');
  try{await onCommand(c);if(alive.current&&flight.current===token&&ownerCurrent())setMessage('The command returned. Only refreshed server state can confirm a recorded result.');}
  catch{if(alive.current&&flight.current===token&&ownerCurrent())setMessage('The outcome is unknown. The host must recover the exact operation before another entry.');}
  finally{if(flight.current===token){flight.current=null;if(alive.current)setBusy(false);}}
 }
 async function refresh(){
  if(!current()||!online||!onRefresh||busy)return;const token={};flight.current=token;latest.current=null;setBusy(true);
  try{await onRefresh();}catch{if(alive.current&&flight.current===token&&ownerCurrent())setMessage('Current server state is unavailable. Your local choice remains visible.');}
  finally{if(flight.current===token){flight.current=null;if(alive.current)setBusy(false);}}
 }
 function review(){if(!current()||busy||!changed||!v.state)return;latest.current=null;setChoice(null);setPinned(null);setAttempted(false);setMessage('');}
 const ownId=v.state?.own.tournamentIdNumber,m=v.match;
 const phaseText={unavailable:'Current playoff information is unavailable.',awaiting_playoff_preparation:'The director has not prepared your simulated playoff yet.',not_in_simulated_playoffs:'You are not in this simulated playoff field.',complete:'Your simulated playoff is complete.',eliminated:'Your simulated playoff matches are complete. The remaining bracket may still be playing.','awaiting-opponent':'Waiting for your next playoff opponent.',entry:connected?"Enter your result first. Then check your opponent's entry.":'Enter your own game result before counterevidence is shown.',confirm:connected?'Both results match. Check them before confirming your own entry.':'Matching game evidence is available. Check it before confirming your own entry.','waiting-evidence':connected?"Your entry is recorded. Waiting for the opponent's entry or independent paper review.":'Your own entry is recorded. Waiting for matching opponent or independently reviewed paper evidence.','waiting-verification':'Your confirmation is recorded. Waiting for the server to verify the complete game.'}[v.phase];
 return <section className="native-mixed-playoff-player" aria-labelledby={`${id}-title`} aria-busy={busy}>
  <p className="native-mixed-playoff-banner"><strong>Practice Only</strong> — Simulated playoff results. No official qualification, MRPs or money movement.</p>
  <h1 id={`${id}-title`}>Playoff</h1>
  {ownId&&<p className="native-mixed-playoff-identity">Your Tournament ID <strong>{ownId}</strong></p>}
  <p role="status">{phaseText}</p>
  {m&&<>
   <div className="native-mixed-playoff-matchup"><div><strong>You</strong><span>Tournament ID {ownId}</span></div><div><strong>{m.opponent.displayName??'Opponent'}</strong><span>Tournament ID {m.opponent.tournamentIdNumber}</span></div></div>
   <h2>First to {m.format.winsRequired} Wins</h2><p>Up to {m.format.maximumGames} games. {connected?'Confirmed Wins':'Server-recorded series'}: You {m.ownWins} — Opponent {m.opponentWins}.</p>
   {m.nextGame&&<h2>Game {m.nextGame.gameNumber}</h2>}
   {m.opponent.mode==='paper'&&<p>Fictional paper opponent. Assigned officials capture and independently review the paper evidence.</p>}
   {v.phase==='entry'&&<fieldset disabled={locked}><legend>Your Game Result</legend><div className="native-mixed-playoff-choices">{(['own','opponent']as const).map(x=><button key={x} type="button" aria-pressed={choice===x} onClick={()=>select(x)}>I {x==='own'?'Won':'Lost'}{choice===x?' ✓':''}</button>)}</div><button className="native-mixed-playoff-primary" type="button" disabled={!choice} onClick={()=>void dispatch()}>Submit My Result</button></fieldset>}
   {v.game?.counterEvidenceAvailable&&<section aria-label={connected?"Opponent's Entry":"Recorded Game Evidence"}><h3>{connected?"Opponent's Entry":"Recorded Game Evidence"}</h3><ul>{v.game.entries.map(e=><li key={e.id}>{e.type==='digital-submit'?`${e.participantId===scope.participantId?'Your':'Opponent'} entry: ${e.winnerParticipantId===scope.participantId?'you won':'opponent won'}`:e.type==='digital-confirm'?`${e.participantId===scope.participantId?'Your':'Opponent'} confirmation recorded`:e.type==='paper-capture'?'Fictional paper evidence captured':'Independent paper review recorded'}</li>)}</ul></section>}
   {v.phase==='confirm'&&<button className="native-mixed-playoff-primary" type="button" disabled={locked} onClick={()=>void dispatch(true)}>Confirm My Recorded Result</button>}
  </>}
  {v.state?.status==='simulated_playoff_own_available'&&v.state.ownFinishingGroup&&<p>Your recorded finishing group: {v.state.ownFinishingGroup.firstPlace===v.state.ownFinishingGroup.lastPlace?v.state.ownFinishingGroup.firstPlace:`${v.state.ownFinishingGroup.firstPlace}–${v.state.ownFinishingGroup.lastPlace}`}.</p>}
  {(changed||attempted)&&<p role="status">{changed?'Server information changed. Your prior local choice is retained; review the current state before another action.':'A command was attempted. Do not submit again until the host has recovered it and refreshed server state.'}{choice&&` Your local choice: I ${choice==='own'?'won':'lost'}.`}</p>}
  {changed&&<button type="button" disabled={busy||!v.state} onClick={review}>{connected?'Review Updated Results':'Review Current Server State'}</button>}
  {message&&<p role="status">{message}</p>}
  <button type="button" disabled={!online||!onRefresh||busy} onClick={()=>void refresh()}>{connected?'Refresh Results':'Refresh Server State'}</button>
  {!online&&<p>{connected?'Offline. Saved operations are preserved; reconnect to refresh results.':'Offline. These review controls do not save pending entries on this device.'}</p>}
  {!connected&&<p className="native-mixed-playoff-limitation">Local review screen only. Provider access and durable recovery are not connected.</p>}
 </section>;
}
