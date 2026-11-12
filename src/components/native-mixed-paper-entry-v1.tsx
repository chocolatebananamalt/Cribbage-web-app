'use client';
import {useEffect,useId,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {GamePlayerLocation} from './game-player-location';
import {NativeMixedGamePendingControllerV1} from '../lib/seating/native-mixed-game-pending-v1';
import {projectNativeMixedPaperEntryV1,isNativeMixedPaperEntryBindingV1,buildNativeMixedPaperEntryRequestV1,type NativeMixedPaperEntryBindingV1,type NativeMixedPaperEntryViewV1} from '../lib/seating/native-mixed-paper-entry-view-v1';
import type {createNativeMixedGameEvidenceTransportV1} from '../lib/api/native-mixed-game-evidence-transport-v1';
import type {SeriesGameRetainedPortV1} from '../lib/playoffs/series-game-retained-v1';
import './native-mixed-paper-entry-v1.css';
type Runtime={retained:SeriesGameRetainedPortV1;transport:ReturnType<typeof createNativeMixedGameEvidenceTransportV1>;makeOperationId:()=>string;makeArtifactId:()=>string};
type Props={enabled?:boolean;binding:NativeMixedPaperEntryBindingV1|null;initialState:unknown;online:boolean;runtime:Runtime|null};
type Snapshot=ReturnType<NativeMixedGamePendingControllerV1['getSnapshot']>;
type Fields={a:{winner:string;margin:string};b:{winner:string;margin:string};ack:boolean};
const blank=():Fields=>({a:{winner:'',margin:''},b:{winner:'',margin:''},ack:false});
type Commands={field:(side:'a'|'b',name:'winner'|'margin',value:string)=>void;ack:(value:boolean)=>void;clear:()=>void;record:()=>void;send:()=>void;check:()=>void;resolve:()=>void;refresh:()=>void};
export function NativeMixedPaperEntryScreenV1({binding:b,view,snapshot,fields,busy,online,message,commands:c}:{binding:NativeMixedPaperEntryBindingV1;view:NativeMixedPaperEntryViewV1|null;snapshot:Snapshot|null;fields:Fields;busy:boolean;online:boolean;message:string;commands:Commands}){
 const base=useId(),pending=snapshot?.pending,editable=!busy&&!!snapshot?.initialized&&!snapshot.blocked&&!pending&&(view?.phase==='capture'||view?.phase==='review');
 const valid=!!view&&view.paperSides.every(side=>['a','b'].includes(fields[side].winner)&&/^\d{1,3}$/.test(fields[side].margin)&&Number(fields[side].margin)>=1&&Number(fields[side].margin)<=121);
 const status=snapshot?.blocked?snapshot.message:pending?pending.phase==='retryable'?'The server was busy. Check or retry the exact saved entry.':pending.phase==='staged'?'Saved on this device. Send this exact entry when connected.':'A saved action needs checking. It will not be sent again.':view?.message||'Current paper-review information is unavailable. Saved work is preserved.';
 return <section className="native-mixed-paper-entry" aria-labelledby={`${base}-title`} aria-busy={busy}>
  <h2 id={`${base}-title`}>Paper Review — Game {b.gameNumber}</h2><p>{b.tournamentName} — {b.eventName}</p>
  <p className="practice"><strong>Practice Only.</strong> Use the prepared fictional paper cards. This does not verify physical originals, actual attendance or real money.</p>
  {view&&!snapshot?.blocked&&!pending&&<div className="identities"><GamePlayerLocation label={b.sideA.displayName} playerId={b.sideA.fixedTournamentId} tableSeat={b.sideA.currentSeat} identityLabel="Tournament ID#"/><GamePlayerLocation label={b.sideB.displayName} playerId={b.sideB.fixedTournamentId} tableSeat={b.sideB.currentSeat} identityLabel="Tournament ID#"/></div>}
  {view?.phase==='review'&&<p>Re-enter each paper card independently. These fields are blank; the preparer’s values are not filled in for you.</p>}
  {view&&!snapshot?.blocked&&!pending&&(view.phase==='capture'||view.phase==='review')&&<>
   {view.paperSides.map(side=>{const person=side==='a'?b.sideA:b.sideB;return <fieldset key={side} disabled={!editable}><legend>{person.displayName} — Paper Card</legend><label htmlFor={`${base}-${side}-winner`}>Winner</label><select id={`${base}-${side}-winner`} value={fields[side].winner} onChange={e=>c.field(side,'winner',e.target.value)}><option value="">Choose from This Paper Card</option><option value="a">{b.sideA.displayName} WON</option><option value="b">{b.sideB.displayName} WON</option></select><label htmlFor={`${base}-${side}-margin`}>Spread Points</label><input id={`${base}-${side}-margin`} inputMode="numeric" pattern="[0-9]*" maxLength={3} autoComplete="off" value={fields[side].margin} onChange={e=>c.field(side,'margin',e.target.value.replace(/\D/g,'').slice(0,3))}/></fieldset>;})}
   <label className="ack"><input type="checkbox" disabled={!editable} checked={fields.ack} onChange={e=>c.ack(e.target.checked)}/><span>I independently entered the fictional paper evidence. I do not claim physical originals or genuine play against a fictional person.</span></label>
   <button type="button" disabled={!editable||!fields.ack||!valid||!online} onClick={c.record}>{view.phase==='capture'?'Save Paper Capture':'Record Independent Review'}</button>
   <button type="button" disabled={!editable} onClick={c.clear}>Clear Unsubmitted Entries</button>
  </>}
  {pending&&(pending.phase==='staged'||pending.phase==='retryable')&&<button type="button" disabled={busy||!online||!!snapshot?.blocked} onClick={c.send}>{pending.phase==='retryable'?'Retry Exact Saved Entry':'Send Saved Entry'}</button>}
  {pending&&<button type="button" disabled={busy||!online||!!snapshot?.blocked} onClick={c.check}>Check Saved Entry</button>}
  {pending?.phase==='attempted'&&<button type="button" className="primary full" disabled={busy||!online||!!snapshot?.blocked} title="Only a server-proven terminal request with no recorded score can be closed. Committed entries are recovered instead." onClick={c.resolve}>Resolve Saved Entry</button>}
  <p role="status">{status}</p>{message&&<p role="alert">{message}</p>}
  {!online&&<p>Reconnect before recording paper evidence. Any saved request is kept.</p>}
  <button type="button" disabled={busy||!online} onClick={c.refresh}>Refresh Paper Review</button>
 </section>;
}
/** Private client seam. No route, ordinary paper endpoint, grant or factory. */
export function NativeMixedPaperEntryV1(p:Props){
 if(p.enabled!==true||!p.runtime||!isNativeMixedPaperEntryBindingV1(p.binding))return <section aria-label="Rehearsal Paper Review"><h2>Rehearsal Paper Review</h2><p>These test controls are not enabled. Saved evidence is preserved.</p></section>;
 return <ActivePaper key={JSON.stringify(p.binding)} {...p} binding={p.binding} runtime={p.runtime}/>;
}
function ActivePaper({binding:inputBinding,initialState:inputState,online,runtime}:Props&{binding:NativeMixedPaperEntryBindingV1;runtime:Runtime}){
 const [binding]=useState(()=>structuredClone(inputBinding)),[initial]=useState(()=>{try{return structuredClone(inputState);}catch{return null;}}),[loaded,setLoaded]=useState<unknown>(null),[snapshot,setSnapshot]=useState<Snapshot|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const epoch=useMemo(()=>({runtime}),[runtime]),[activation,setActivation]=useState<object|null>(null),owner=useRef<{controller:NativeMixedGamePendingControllerV1;epoch:object}|null>(null),flight=useRef<NativeMixedGamePendingControllerV1|null>(null),onlineRef=useRef(online);
 useLayoutEffect(()=>{onlineRef.current=online;},[online]);
 useEffect(()=>{const current={controller:null as unknown as NativeMixedGamePendingControllerV1,epoch};current.controller=new NativeMixedGamePendingControllerV1({target:binding.target,ownParticipantId:null,retained:runtime.retained,transport:runtime.transport,enabled:()=>owner.current===current,online:()=>onlineRef.current});owner.current=current;
  void current.controller.initialize().then(()=>{if(owner.current===current){setSnapshot(current.controller.getSnapshot());setLoaded(initial);setBusy(false);setActivation(epoch);}});
  return()=>{if(owner.current===current)owner.current=null;if(flight.current===current.controller)flight.current=null;current.controller.dispose();};
 },[binding,initial,runtime,epoch]);
 const view=projectNativeMixedPaperEntryV1(binding,loaded),signature=JSON.stringify({revision:view?.state.revision,digest:view?.state.historyDigest,phase:view?.phase,capture:view?.capture?.id});
 const [draft,setDraft]=useState<{signature:string;fields:Fields}|null>(null),fields=draft?.signature===signature?draft.fields:blank(),dirty=!snapshot?.pending&&(fields.ack||[fields.a,fields.b].some(f=>f.winner||f.margin));
 const snapshotKey=JSON.stringify(snapshot),sourceKey=JSON.stringify(view?.state??null);
 const lease=useMemo(()=>({epoch,runtime,inputState,snapshotKey,sourceKey,activation,busy,online}),[epoch,runtime,inputState,snapshotKey,sourceKey,activation,busy,online]);
 const intent=useMemo(()=>({lease,fields,signature}),[lease,fields,signature]),latestLease=useRef<object|null>(null),latestIntent=useRef<object|null>(null);
 useLayoutEffect(()=>{latestLease.current=lease;latestIntent.current=intent;return()=>{if(latestLease.current===lease)latestLease.current=null;if(latestIntent.current===intent)latestIntent.current=null;};},[lease,intent]);
 const currentLease=()=>latestLease.current===lease&&activation===epoch&&owner.current?.epoch===epoch&&JSON.stringify(owner.current.controller.getSnapshot())===snapshotKey;
 const currentIntent=()=>currentLease()&&latestIntent.current===intent;
 useEffect(()=>{if(!dirty)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
 async function run(work:(c:NativeMixedGamePendingControllerV1)=>Promise<unknown>){
  const current=owner.current;if(!currentLease()||!current||busy||flight.current)return;flight.current=current.controller;setBusy(true);setMessage('');
  try{await work(current.controller);if(owner.current!==current)return;const next=current.controller.getSnapshot();setSnapshot(next);if(!next.pending&&!next.blocked&&onlineRef.current){setLoaded(null);const response=await runtime.transport.state(binding.target);if(owner.current===current)setLoaded(response.data);}}
  catch{if(owner.current===current)setMessage('The step is not confirmed. Saved work is kept.');}
  finally{if(flight.current===current.controller)flight.current=null;if(owner.current===current){setBusy(false);setSnapshot(current.controller.getSnapshot());}}
 }
 async function record(){
  if(!currentIntent()||flight.current||busy||!snapshot?.initialized||snapshot.pending||snapshot.blocked||!fields.ack||!view||!['capture','review'].includes(view.phase)||!onlineRef.current)return;
  if(!view.paperSides.every(side=>['a','b'].includes(fields[side].winner)&&/^\d{1,3}$/.test(fields[side].margin)&&Number(fields[side].margin)>=1&&Number(fields[side].margin)<=121))return;
  try{const claims=view.paperSides.map(side=>({side,result:{winnerSide:fields[side].winner as 'a'|'b',margin:Number(fields[side].margin)}})),request=buildNativeMixedPaperEntryRequestV1(binding,loaded,runtime.makeOperationId(),view.phase==='capture'?runtime.makeArtifactId():null,claims);
   if(!currentIntent())return;
   if(!request){setMessage('The independently entered cards do not match the saved capture, or the source changed. Nothing was submitted. Check the cards with the director.');return;}
   await run(async c=>{if(await c.save(request,loaded)&&onlineRef.current)await c.sendExact();});
  }catch{setMessage('The request could not be confirmed. Keep any saved entry and check its outcome.');}
 }
 const edit=()=>currentIntent()&&!flight.current&&!busy&&!snapshot?.pending;
 const commands:Commands={field:(side,name,value)=>{if(edit()){latestIntent.current=null;setDraft({signature,fields:{...fields,[side]:{...fields[side],[name]:value}}});}},ack:value=>{if(edit()){latestIntent.current=null;setDraft({signature,fields:{...fields,ack:value}});}},clear:()=>{if(edit()){latestIntent.current=null;setDraft({signature,fields:blank()});setMessage('Unsubmitted entries cleared. Saved evidence is unchanged.');}},record:()=>{void record();},send:()=>{void run(c=>c.sendExact());},check:()=>{void run(c=>c.checkOutcome());},resolve:()=>{void run(c=>c.resolveExact());},refresh:()=>{if(!currentIntent())return;if(dirty){setMessage('Clear unsubmitted entries before refreshing. They have not been sent.');return;}void run(async c=>{if(c.getSnapshot().blocked)await c.initialize();if(c.getSnapshot().pending)await c.checkOutcome();});}};
 const safe=activation===epoch;
 return <NativeMixedPaperEntryScreenV1 binding={binding} view={safe?view:null} snapshot={safe?snapshot:null} fields={safe?fields:blank()} busy={busy||!safe} online={online} message={safe?message:''} commands={commands}/>;
}
