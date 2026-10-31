'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {parseScheduleCsv,type EventScheduleWorkspace} from '../../../../../../lib/api/event-schedule';
import {isUuid} from '../../../../../../lib/api/validation';
import {deriveOddFieldMakeupPlan,type MakeupSeats} from '../../../../../../lib/results/odd-field-makeup';
import {isOddFieldMakeupRequest,isOddFieldMakeupResult,isOddFieldMakeupRejected,isOddFieldMakeupWorkspace,
  type OddFieldMakeupRequest,type OddFieldMakeupWorkspace} from '../../../../../../lib/api/odd-field-makeup';
import {setAppRecoveryItem} from '../../../../../../lib/recovery-write-coordinator';

type Envelope={kind:'odd-field-makeup-v1';operationId:string;request:OddFieldMakeupRequest};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const isEnvelope=(v:unknown):v is Envelope=>object(v)&&Object.keys(v).sort().join()==='kind,operationId,request'
  &&v.kind==='odd-field-makeup-v1'&&isUuid(v.operationId)&&isOddFieldMakeupRequest(v.request);
const header='Game,Player A ID,Player B ID,Player A Table/Seat,Player B Table/Seat';
export function parseMakeupSeats(csv:string):MakeupSeats[] {
  const rows=csv.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  if(rows.length!==7||rows[0].toLowerCase()!=='player a table/seat,player b table/seat')throw Error('Use the makeup header and six seat pairs.');
  return rows.slice(1).map(row=>{const cells=row.split(',').map(s=>s.trim().toUpperCase());
    if(cells.length!==2)throw Error('Each makeup needs two table/seat values.');
    return{sideATableSeat:cells[0],sideBTableSeat:cells[1]};});
}
export default function OddFieldMakeupClient({actorId,tournamentId,eventId,workspace,initial}:{actorId:string;tournamentId:string;eventId:string;workspace:EventScheduleWorkspace;initial:OddFieldMakeupWorkspace|null}) {
  const [current,setCurrent]=useState(initial),[csv,setCsv]=useState(header+'\n'),[seats,setSeats]=useState('Player A Table/Seat,Player B Table/Seat\n');
  const [reason,setReason]=useState(''),[zeroAnchors,setZeroAnchors]=useState(false),[reviewed,setReviewed]=useState(false);
  const [pending,setPending]=useState<Envelope|null>(null),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[blocked,setBlocked]=useState(false);
  const [message,setMessage]=useState('Checking schedule recovery.');const flight=useRef(false);
  const url=`/api/v1/tournaments/${tournamentId}/events/${eventId}/odd-field-makeup`;
  const key=`event-schedule:${actorId}:${tournamentId}:odd-makeup:${eventId}`;
  const event=workspace.events.find(e=>e.eventId===eventId);
  const participants=useMemo(()=>workspace.participants.filter(p=>p.eventId===eventId),[workspace.participants,eventId]);
  const parsed=useMemo(()=>parseScheduleCsv(csv),[csv]);
  const preview=useMemo(()=>{
    try {
      if(parsed.errors.length)throw Error(parsed.errors.join(' '));
      const makeupSeats=parseMakeupSeats(seats);
      return{plan:deriveOddFieldMakeupPlan(parsed.matches,participants.map(p=>p.verificationId),makeupSeats,workspace.tableCount??0,workspace.seatsPerTable??0),makeupSeats,error:null};
    }catch(e){return{plan:null,makeupSeats:[],error:e instanceof Error?e.message:'Schedule unavailable.'};}
  },[parsed,participants,workspace.tableCount,workspace.seatsPerTable,seats]);
  const display=(id:string)=>participants.find(p=>p.verificationId===id)?.displayName??id;
  async function check(e:Envelope) {
    const r=await fetch(url+'/reconciliation',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'content-type':'application/json'},body:JSON.stringify({operationId:e.operationId,request:e.request})});
    const d:unknown=r.ok?await r.json():null;
    if(!object(d)||Object.keys(d).sort().join()!=='authorized,result'||d.authorized!==true)throw Error('Reconciliation unavailable.');
    return d.result;
  }
  async function finish(raw:string,e:Envelope,result:unknown,isActive=()=>true) {
    if(!isActive())return;
    if(!isOddFieldMakeupResult(result,eventId)&&!isOddFieldMakeupRejected(result)){setMessage('Outcome remains uncertain. Exact schedule retained.');return;}
    if(result.status==='rejected'&&result.code==='idempotency_conflict'){setBlocked(true);setMessage('Operation conflict. Retained schedule preserved for review.');return;}
    try{if(sessionStorage.getItem(key)!==raw)throw Error('Recovery changed.');sessionStorage.removeItem(key);}
    catch{setBlocked(true);setMessage('Outcome received, but retained work could not be cleared safely.');return;}
    setPending(null);setMessage(result.status==='odd_field_schedule_published'?'Published 102 real qualifying games: 96 regular and six makeups. Start play from the Game Schedule page.':`Publication rejected: ${result.code.replaceAll('_',' ')}. Review the current source before a new request.`);
    if(result.status==='odd_field_schedule_published'){
      try{const r=await fetch(url,{cache:'no-store',credentials:'same-origin'}),d:unknown=r.ok?await r.json():null;
        if(!isActive())return;if(!isOddFieldMakeupWorkspace(d,tournamentId,eventId))throw Error('Readback unavailable.');setCurrent(d);
      }catch{if(isActive()){setBlocked(true);setMessage('Publication receipt confirmed. Reload to verify readback before starting play; do not submit another schedule.');}}
    }
    void e;
  }
  useEffect(()=>{
    let active=true;
    async function restore(){
      let raw:string|null;try{raw=sessionStorage.getItem(key);}catch{setBlocked(true);setReady(true);setMessage('Recovery storage unavailable. Publication blocked.');return;}
      if(!raw){setReady(true);setMessage('Review the regular schedule and every makeup pairing before publication.');return;}
      let e:unknown;try{e=JSON.parse(raw);}catch{e=null;}
      if(!isEnvelope(e)){setBlocked(true);setReady(true);setMessage('Unrecognized retained schedule preserved. Publication blocked.');return;}
      setPending(e);setBusy(true);
      try{const result=await check(e);if(!active)return;if(result===null)setMessage('No completed receipt. Retry only the exact retained schedule.');else await finish(raw,e,result,()=>active);}
      catch{if(active)setMessage('Status unavailable. Exact schedule retained; no automatic resubmission.');}
      finally{if(active){setBusy(false);setReady(true);}}
    }
    void restore();return()=>{active=false;};
    // Identity-bound recovery must not rerun on mutable preview state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[key,url]);
  async function submit(e:Envelope,retained:boolean){
    if(flight.current||!ready||blocked)return;flight.current=true;setBusy(true);const raw=JSON.stringify(e);
    try{
      if(retained){if(sessionStorage.getItem(key)!==raw)throw Error('Recovery changed.');const result=await check(e);if(result!==null){await finish(raw,e,result);return;}}
      else{if(sessionStorage.getItem(key))throw Error('Retained work exists.');setAppRecoveryItem(sessionStorage,key,raw);setPending(e);}
      const r=await fetch(url,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'content-type':'application/json','x-idempotency-key':e.operationId},body:JSON.stringify(e.request)});
      await finish(raw,e,await r.json().catch(()=>null));
    }catch{setMessage('Publication could not be confirmed. Keep the exact retained request and check its status before retrying.');}
    finally{flight.current=false;setBusy(false);}
  }
  const request:OddFieldMakeupRequest={regularMatches:parsed.matches,makeupSeats:preview.makeupSeats,anchorCount:0,reason,reviewed:true};
  const published=!!event?.schedulePublished||!!current?.makeups.length;
  return <>
    <p role="status">{message}</p>
    <p>This supported zero-anchor option follows ACC Director Manual section 12.B. Twelve different players sit out once. Afterwards they play six real makeup games, paired first sit-out with last. No points or wins are awarded for sitting out.</p>
    <p>Scheduling batch 13 holds the makeups. Each result fills the player’s original blank line on a twelve-game scorecard; it is not a thirteenth qualifying game.</p>
    {!current?<p role="alert">Makeup service unavailable. Publication is blocked.</p>:current.makeups.length>0?<section><h2>Published makeup card lines</h2>
      <p>{current.current?'The published makeup mapping is current.':'The mapping is not current; speak with the director before scoring.'}</p>
      <ul>{current.makeups.map(m=>{const game=workspace.matches.find(g=>g.canonicalGameId===m.canonicalGameId);return<li key={m.canonicalGameId}>{game?.sideADisplayName??'Side A'}: card game {m.sideACardGameNumber}; {game?.sideBDisplayName??'Side B'}: card game {m.sideBCardGameNumber}. Makeup batch 13.</li>;})}</ul>
    </section>:null}
    <fieldset style={{gridTemplateColumns:'minmax(0,1fr)',minWidth:0,gap:12}} disabled={!ready||busy||blocked||!!pending||published||!current||!workspace.registrationClosed}>
      <legend>Director-reviewed schedule</legend>
      <label htmlFor="odd-regular-csv">Regular schedule CSV (96 matches)</label><textarea className="schedule-csv" id="odd-regular-csv" rows={8} value={csv} onChange={e=>{setCsv(e.target.value);setReviewed(false);}}/>
      <label htmlFor="odd-makeup-seats">Six makeup table/seat pairs, in sit-out pairing order</label><textarea className="schedule-csv" id="odd-makeup-seats" rows={7} value={seats} onChange={e=>{setSeats(e.target.value);setReviewed(false);}}/>
      {preview.error?<p>{preview.error}</p>:<section><h2>Makeup preview</h2><ul>{preview.plan?.makeupMatches.map(m=><li key={m.sideACardGameNumber}>{display(m.sideAVerificationId)} ({m.sideAVerificationId}), card game {m.sideACardGameNumber}, vs {display(m.sideBVerificationId)} ({m.sideBVerificationId}), card game {m.sideBCardGameNumber}; {m.sideATableSeat} / {m.sideBTableSeat}.</li>)}</ul><p>102 matches total; each of 17 players has exactly 12.</p></section>}
      <label>Director review reason<input value={reason} maxLength={500} onChange={e=>{setReason(e.target.value);setReviewed(false);}}/></label>
      <label style={{display:'flex',alignItems:'flex-start',gap:8}}><input type="checkbox" checked={zeroAnchors} onChange={e=>{setZeroAnchors(e.target.checked);setReviewed(false);}}/>This schedule uses zero stationary/anchor seats.</label>
      <label style={{display:'flex',alignItems:'flex-start',gap:8}}><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>I reviewed all regular pairings, the twelve distinct sit-outs, all six makeup pairings and seats, and the original scorecard lines.</label>
      <button className="primary" type="button" disabled={!zeroAnchors||!reviewed||!preview.plan||!isOddFieldMakeupRequest(request)} onClick={()=>void submit({kind:'odd-field-makeup-v1',operationId:crypto.randomUUID(),request},false)}>Publish regular and makeup schedule</button>
    </fieldset>
    {pending&&<><p>The exact retained schedule takes precedence over editable fields.</p><button type="button" disabled={!ready||busy||blocked} onClick={()=>void submit(pending,true)}>Check status and retry exact schedule</button></>}
  </>;
}
