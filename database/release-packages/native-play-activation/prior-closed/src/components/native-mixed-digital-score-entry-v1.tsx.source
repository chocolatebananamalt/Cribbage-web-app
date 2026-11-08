'use client';
import {useEffect,useId,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {PlayerPageFrame} from './player-page-frame';
import {GamePlayerLocation} from './game-player-location';
import {deriveScore,isScoreEntryReady} from '../lib/score';
import {NativeMixedGamePendingControllerV1} from '../lib/seating/native-mixed-game-pending-v1';
import {isNativeMixedDigitalEntryBindingV1,projectNativeMixedDigitalEntryV1,buildNativeMixedDigitalEntryRequestV1,type NativeMixedDigitalEntryBindingV1,type NativeMixedDigitalEntryViewV1} from '../lib/seating/native-mixed-digital-entry-view-v1';
import type {createNativeMixedGameEvidenceTransportV1} from '../lib/api/native-mixed-game-evidence-transport-v1';
import type {SeriesGameRetainedPortV1} from '../lib/playoffs/series-game-retained-v1';
import './native-mixed-digital-score-entry-v1.css';

type Runtime={retained:SeriesGameRetainedPortV1;transport:ReturnType<typeof createNativeMixedGameEvidenceTransportV1>;makeOperationId:()=>string};
type PendingSnapshot=ReturnType<NativeMixedGamePendingControllerV1['getSnapshot']>;
type Navigation={entryHref:string;cardHref:string};
type Props={navigation?:Navigation;enabled?:boolean;binding:NativeMixedDigitalEntryBindingV1|null;initialState:unknown;online:boolean;runtime:Runtime|null};
const keys=[1,2,3,4,5,6,7,8,9,'clear',0,'backspace']as const;
type Choice='player'|'opponent'|null;
type Commands={choose:(winner:Choice)=>void;key:(key:(typeof keys)[number])=>void;submit:()=>void;confirm:()=>void;send:()=>void;check:()=>void;resolve:()=>void;refresh:()=>void;beforeNavigate:()=>boolean};
type ScreenProps={navigation?:Navigation;binding:NativeMixedDigitalEntryBindingV1;view:NativeMixedDigitalEntryViewV1|null;snapshot:PendingSnapshot|null;winner:Choice;margin:string;busy:boolean;online:boolean;message:string;commands:Commands};
const safeClone=(value:unknown)=>{try{return structuredClone(value);}catch{return null;}};
/** Presentational screen reuses the approved player frame/classes and score
 * arithmetic. Commands are an injected client-host seam, never server props. */
export function NativeMixedDigitalScoreScreenV1({binding:b,view,snapshot,winner,margin,busy,online,message,commands:c,navigation}:ScreenProps){
 const base=useId(),own=view?.ownResult,shownWinner=own?(own.winnerSide===b.ownSide?'player':'opponent'):winner,shownMargin=own?String(own.margin):margin;
 const derived=shownWinner&&isScoreEntryReady(Number(shownMargin),shownWinner)?deriveScore(Number(shownMargin),shownWinner):null;
 const pending=snapshot?.pending,locked=busy||!snapshot?.initialized||snapshot.blocked||!!pending||view?.phase!=='entry';
 const phaseMessage=snapshot?.blocked?snapshot.message:pending?pending.phase==='retryable'?'The server was busy. Check or retry the exact saved entry.':pending.phase==='staged'?'Saved on this device. Reconnect and send this entry.':'A saved action needs checking. Do not enter another result.':view?.message||'Current rehearsal information is unavailable. Your saved work is preserved.';
 const actionMessage=message||snapshot?.message;
 return <PlayerPageFrame tournamentId={b.target.tournamentId} tournamentName={b.tournamentName} eventId={b.target.eventId} eventName={b.eventName} activeTab="entry" player={{displayName:b.player.displayName,verificationId:b.player.fixedTournamentId}} navigation={navigation} beforeNavigate={c.beforeNavigate}>
  <section className="player-entry native-mixed-entry" aria-labelledby={`${base}-title`} aria-busy={busy}>
   <p className="native-mixed-notice"><strong>Practice Only</strong> — Simulated results and fees. This does not record official play or move money.</p>
   <h1 id={`${base}-title`}>Game {b.gameNumber}</h1>
   <div className="player-matchup"><GamePlayerLocation label={b.player.displayName} playerId={b.player.fixedTournamentId} tableSeat={b.player.currentSeat} identityLabel="Tournament ID#"/><GamePlayerLocation label={b.opponent.displayName} playerId={b.opponent.fixedTournamentId} tableSeat={b.opponent.currentSeat} identityLabel="Tournament ID#"/></div>
   {b.opponent.mode==='paper'&&<p>Fictional paper opponent. Enter your own rehearsal result; assigned officials record and independently review the paper evidence.</p>}
   <fieldset className="player-result-choices"><legend className="sr-only">Your Result</legend>{(['player','opponent']as const).map(choice=><button key={choice} type="button" className={`${choice==='player'?'player-won':'player-lost'}${shownWinner===choice?' selected':''}`} aria-pressed={shownWinner===choice} disabled={locked} onClick={()=>c.choose(choice)}>{b.player.displayName} {choice==='player'?'WON':'LOST'}{shownWinner===choice&&<span>{'\u2713 Selected'}</span>}</button>)}</fieldset>
   <div className="player-spread-entry"><label htmlFor={`${base}-spread`}>Spread Points</label><output id={`${base}-spread`} aria-live="polite">{shownMargin||'-'}</output>{!!derived?.skunkLevel&&<span className="skunk" role="status" aria-label={['','Skunk','Double Skunk','Triple Skunk'][derived.skunkLevel]}><b aria-hidden="true">{'\u{1f9a8}'.repeat(derived.skunkLevel)}</b><span>{['','Skunk','Double Skunk','Triple Skunk'][derived.skunkLevel]}</span></span>}</div>
   <div className="keypad player-keypad" aria-label="Spread Points Keypad">{keys.map(k=><button key={k} type="button" disabled={locked} onClick={()=>c.key(k)} aria-label={k==='clear'?'Clear Result':k==='backspace'?'Delete Last Digit':undefined}>{k==='clear'?'Clear':k==='backspace'?'Delete':k}</button>)}</div>
   {derived&&<section className="player-result-summary" aria-label="Your Result"><h2>Your Result:</h2><p>{derived.winner==='player'?'WON':'LOST'} - Points: {derived.playerGamePoints} Game | {derived.winner==='player'?`+${derived.playerPlus}`:`-${derived.playerMinus}`} Spread</p></section>}
   {!pending&&view?.phase==='entry'&&<button type="button" className="primary full" disabled={locked||!derived} onClick={c.submit}>Submit result</button>}
   {!pending&&view?.phase==='confirm'&&<button type="button" className="primary full" disabled={busy||!online||!snapshot?.initialized||!!snapshot?.blocked} onClick={c.confirm}>Confirm My Entry</button>}
   {pending&&(pending.phase==='staged'||pending.phase==='retryable')&&<button type="button" className="primary full" disabled={busy||!online||!!snapshot?.blocked} onClick={c.send}>{pending.phase==='retryable'?'Retry Exact Saved Entry':'Send Saved Entry'}</button>}
   {pending&&<button type="button" className="primary full" disabled={busy||!online||!!snapshot?.blocked} onClick={c.check}>Check Saved Entry</button>}
  {pending?.phase==='attempted'&&<button type="button" className="primary full" disabled={busy||!online||!!snapshot?.blocked} title="Only a server-proven terminal request with no recorded score can be closed. Committed entries are recovered instead." onClick={c.resolve}>Resolve Saved Entry</button>}
   <p role="status" className="player-entry-status">{phaseMessage}</p>{actionMessage&&actionMessage!==phaseMessage&&<p role="status">{actionMessage}</p>}
   {!online&&<p>Offline: submitted choices stay on this device until you reconnect and send them. Confirmations require a connection.</p>}
   <button type="button" className="primary full" disabled={busy||!online} onClick={c.refresh}>{snapshot?.blocked?'Reload Saved Entry':'Refresh Game'}</button>
  </section>
 </PlayerPageFrame>;
}
/** Default off, not imported by any app route. No ordinary score endpoint,
 * automatic provider request, storage factory, credential or ID creation. */
export function NativeMixedDigitalScoreEntryV1(props:Props){
 if(props.enabled!==true||!props.runtime||!isNativeMixedDigitalEntryBindingV1(props.binding))return <section aria-label="Rehearsal Score Entry"><h2>Rehearsal Score Entry</h2><p>These practice controls are not enabled. Existing scoring and saved work are unchanged.</p></section>;
 return <ActiveEntry key={JSON.stringify(props.binding)} {...props} binding={props.binding} runtime={props.runtime}/>;
}
function ActiveEntry({binding:inputBinding,initialState:inputState,online,runtime,navigation}:Props&{binding:NativeMixedDigitalEntryBindingV1;runtime:Runtime}){
 const [binding]=useState(()=>structuredClone(inputBinding)),[initialState]=useState(()=>safeClone(inputState));
 const [snapshot,setSnapshot]=useState<PendingSnapshot|null>(null),[loaded,setLoaded]=useState<unknown>(null),[winner,setWinner]=useState<Choice>(null),[margin,setMargin]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const epoch=useMemo(()=>({runtime}),[runtime]),[activation,setActivation]=useState<object|null>(null);
 const owner=useRef<{controller:NativeMixedGamePendingControllerV1;runtime:Runtime;epoch:object}|null>(null),onlineRef=useRef(online),flight=useRef<NativeMixedGamePendingControllerV1|null>(null);
 useLayoutEffect(()=>{onlineRef.current=online;},[online]);
 const view=projectNativeMixedDigitalEntryV1(binding,loaded),dirty=view?.phase==='entry'&&(winner!==null||margin.length>0)&&!snapshot?.pending;
 const snapshotKey=JSON.stringify(snapshot),sourceKey=JSON.stringify(view?.state??null);
 const lease=useMemo(()=>({epoch,runtime,inputState,snapshotKey,sourceKey,activation,busy,online}),[epoch,runtime,inputState,snapshotKey,sourceKey,activation,busy,online]);
 const intent=useMemo(()=>({lease,winner,margin}),[lease,winner,margin]),latestLease=useRef<object|null>(null),latestIntent=useRef<object|null>(null);
 useLayoutEffect(()=>{latestLease.current=lease;latestIntent.current=intent;return()=>{if(latestLease.current===lease)latestLease.current=null;if(latestIntent.current===intent)latestIntent.current=null;};},[lease,intent]);
 const currentLease=()=>latestLease.current===lease&&activation===epoch&&owner.current?.epoch===epoch&&owner.current.runtime===runtime&&JSON.stringify(owner.current.controller.getSnapshot())===snapshotKey;
 const currentIntent=()=>currentLease()&&latestIntent.current===intent;
 useEffect(()=>{
  const current={controller:null as unknown as NativeMixedGamePendingControllerV1,runtime,epoch};
  current.controller=new NativeMixedGamePendingControllerV1({target:binding.target,ownParticipantId:binding.player.participantId,retained:runtime.retained,transport:runtime.transport,enabled:()=>owner.current===current,online:()=>onlineRef.current});owner.current=current;
  void current.controller.initialize().then(()=>{if(owner.current===current){setSnapshot(current.controller.getSnapshot());setLoaded(initialState);setBusy(false);setMessage('');setActivation(epoch);}});
  return()=>{if(owner.current===current)owner.current=null;if(flight.current===current.controller)flight.current=null;current.controller.dispose();};
 },[binding,initialState,runtime,epoch]);
 useEffect(()=>{if(!dirty)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
 async function run(work:(controller:NativeMixedGamePendingControllerV1)=>Promise<unknown>,refresh=false){
  const current=owner.current;if(!currentLease()||!current||busy||flight.current)return;flight.current=current.controller;setBusy(true);setMessage('');
  try{
   await work(current.controller);if(owner.current!==current)return;const next=current.controller.getSnapshot();setSnapshot(next);
   if(refresh&&!next.pending&&!next.blocked&&onlineRef.current){setLoaded(null);const response=await runtime.transport.state(binding.target);if(owner.current===current)setLoaded(response.data);}
  }catch{if(owner.current===current)setMessage('The step could not be confirmed. Your saved work is kept.');}
  finally{if(flight.current===current.controller)flight.current=null;if(owner.current===current){setBusy(false);setSnapshot(current.controller.getSnapshot());}}
 }
 async function record(action:'digital-submit'|'digital-confirm'){
  if(!currentIntent()||flight.current||busy||!snapshot?.initialized||snapshot.pending||snapshot.blocked||!view||action==='digital-confirm'&&!onlineRef.current)return;
  const result=winner&&isScoreEntryReady(Number(margin),winner)?{winnerSide:winner==='player'?binding.ownSide:binding.ownSide==='a'?'b' as const:'a' as const,margin:Number(margin)}:null;
  if(action==='digital-submit'&&(view.phase!=='entry'||!result)||action==='digital-confirm'&&view.phase!=='confirm')return;
  let operationId:string;try{operationId=runtime.makeOperationId();}catch{if(currentIntent())setMessage('A safe request could not be prepared. Nothing was sent.');return;}
  if(!currentIntent())return;
  const request=buildNativeMixedDigitalEntryRequestV1(binding,loaded,action,operationId,result);if(!request){setMessage('Refresh the rehearsal game before submitting.');return;}
  await run(async controller=>{if(await controller.save(request,loaded)&&onlineRef.current)await controller.sendExact();},true);
 }
 const commands:Commands={choose:choice=>{if(currentIntent()&&!busy&&!snapshot?.pending&&view?.phase==='entry'&&choice!==winner){latestIntent.current=null;setWinner(choice);}},key:k=>{if(currentIntent()&&!busy&&!snapshot?.pending&&view?.phase==='entry'){const next=k==='clear'?'':k==='backspace'?margin.slice(0,-1):margin.length>=3?margin:margin==='0'?String(k):margin+String(k);if(next===margin&&(k!=='clear'||winner===null))return;latestIntent.current=null;if(k==='clear')setWinner(null);setMargin(next);}},submit:()=>{void record('digital-submit');},confirm:()=>{void record('digital-confirm');},send:()=>{void run(c=>c.sendExact(),true);},check:()=>{void run(c=>c.checkOutcome(),true);},resolve:()=>{void run(c=>c.resolveExact(),true);},refresh:()=>{if(!currentIntent())return;void run(async c=>{if(c.getSnapshot().blocked)await c.initialize();if(c.getSnapshot().pending)await c.checkOutcome();},true);},beforeNavigate:()=>{if(!currentIntent())return false;if(flight.current||busy||dirty){setMessage('Finish the current save, or clear an unsubmitted choice before leaving.');return false;}return true;}};
 const safe=activation===epoch;
 return <NativeMixedDigitalScoreScreenV1 navigation={navigation} binding={binding} view={safe?view:null} snapshot={safe?snapshot:null} winner={safe?winner:null} margin={safe?margin:''} busy={busy||!safe} online={online} message={safe?message:'Checking saved entries.'} commands={commands}/>;
}
