"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { IdentityRecoveryV5 } from './identity-workflow-client-v5';
import { NonmemberIdentityFieldsV1 } from './nonmember-identity-fields-v1';
import { IdentityPreSaveReviewV3 } from './identity-pre-save-review-v3';
import { assertRecoveryStorageOwner } from '../lib/auth/recovery-owner';
import { trackAppRecoveryWrite, transitionAppRecoveryItem } from '../lib/recovery-write-coordinator';
import { createClient } from '../lib/supabase/client';
import { recordedCheckInIdentityV23 } from '../lib/seating/recorded-identity-v23';
import { canonicalV5, type IdentityAccessV5 } from '../lib/identity-v5/contracts';
import { identityMatchFingerprintV3, readDuplicateSnapshotV3, type DuplicateSnapshotV3, type IdentityDraftV3 } from '../lib/registration/identity-pre-save-v3';
import { readPendingV25, readProfileV8, readReplyV25, readWorkspaceV25, requestHashV25, validRegistrationV25, type PendingV25, type RegistrationV25 } from '../lib/legacy-registration-v25/contracts';

type Props = {actorId:string;tournamentId:string;recovery?:IdentityRecoveryV5};
const fresh = ():IdentityDraftV3 => ({kind:'manual-roster-identity-request-v3',idempotencyKey:crypto.randomUUID(),entry:{firstName:'',lastName:'',email:'',city:'',state:'',accNumber:'',nonmemberWithoutNumber:true,scorecardType:'paper',joiningClaim:{status:'none',evidenceReference:''}},address:{street:'',postalCode:'',country:'US'},distinction:{prefix:'',middleName:'',suffix:'',localLabel:''},privateDeskNote:''});
export function LegacyRegistrationClientV25(props:Props) {return <OwnedRegistration key={props.actorId+':'+props.tournamentId} {...props}/>;}

function OwnedRegistration({actorId,tournamentId,recovery}:Props) {
  const alive=useRef(false),epoch=useRef(0),flight=useRef(false),memory=useRef<RegistrationV25|null>(null);
  const key=`manual-roster-operation:legacy-identity-v25:${actorId}:${tournamentId}`;
  const store=useMemo<IdentityRecoveryV5>(()=>recovery??{track:trackAppRecoveryWrite,get:k=>{assertRecoveryStorageOwner(actorId);return sessionStorage.getItem(k);},transition:(k,b,a)=>{assertRecoveryStorageOwner(actorId);return transitionAppRecoveryItem(sessionStorage,k,b,a);}},[recovery,actorId]);
  const [workspace,setWorkspace]=useState<ReturnType<typeof readWorkspaceV25>>(null),[draft,setDraft]=useState<IdentityDraftV3>(fresh),[review,setReview]=useState<DuplicateSnapshotV3|null>(null),[pending,setPending]=useState<PendingV25|null>(null),[raw,setRaw]=useState<string|null>(null),[busy,setBusy]=useState(false),[blocked,setBlocked]=useState(false),[message,setMessage]=useState('Checking the paper registration capability.'),[reason,setReason]=useState('Director reviewed paper identity'),[finished,setFinished]=useState<'recorded'|'rejected'|'open_existing'|null>(null),[profile,setProfile]=useState<ReturnType<typeof readProfileV8>>(null);
  const scope:IdentityAccessV5|null=workspace?{actorId,sessionId:workspace.sessionId,tournamentId,role:'director'}:null;
  const intent=useMemo(()=>({workspace,draft,review,pending,raw,busy,blocked,finished,reason,profile}),[workspace,draft,review,pending,raw,busy,blocked,finished,reason,profile]);
  const committed=useRef<object|null>(null);
  useLayoutEffect(()=>{committed.current=intent;return()=>{if(committed.current===intent)committed.current=null;};},[intent]);
  const liveIntent=()=>alive.current&&committed.current===intent;
  const current=(ticket:number)=>alive.current&&epoch.current===ticket;
  const endpoint=(action:string)=>`/api/v1/tournaments/${tournamentId}/legacy-registration-v25/${action}`;
  async function api(action:string,body?:unknown,rid?:string) {
    const apiEpoch=epoch.current;
    const r=await fetch(endpoint(action)+(rid?'?rosterEntryId='+encodeURIComponent(rid):''),{method:body===undefined?'GET':'POST',cache:'no-store',headers:{'x-identity-actor':actorId,...(scope?{'x-identity-session':scope.sessionId}:{}),...(body===undefined?{}:{'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
    if(!r.ok){const failure:unknown=await r.json().catch(()=>null);if(action==='write'&&current(apiEpoch)&&failure&&typeof failure==='object'&&'error'in failure&&failure.error==='legacy_identity_writes_paused'){committed.current=null;epoch.current++;flight.current=false;setBusy(false);setFinished(null);setWorkspace(w=>w?{...w,writesEnabled:false}:null);setMessage('Paper registration writes are paused. Retained recovery is preserved; check its outcome before another operation.');}throw Error('unconfirmed');}return await r.json()as unknown;
  }
  useLayoutEffect(()=>{alive.current=true;return()=>{alive.current=false;committed.current=null;};},[]);
  useEffect(()=>{
    let mounted=true;const ticket=epoch.current;
    void(async()=>{
      const bytes=store.get(key),p=readPendingV25(bytes,actorId,tournamentId);
      if(!mounted||!current(ticket))return;
      setRaw(bytes);setPending(p);
      if(bytes!==null&&!p){setBlocked(true);setMessage('Unknown recovery is preserved. No registration request was sent.');return;}
      const r=await fetch(endpoint('workspace'),{cache:'no-store',headers:{'x-identity-actor':actorId}});
      if(!r.ok)throw Error('unavailable');const w=readWorkspaceV25(await r.json(),actorId,tournamentId);
      if(!mounted||!current(ticket))return;if(!w)throw Error('scope');setWorkspace(w);
      setMessage(p?'A retained operation needs its exact outcome checked. Names and addresses were not stored in browser recovery.':w.writesEnabled?'Paper registration capability verified. Payments and check-in remain separate.':'New paper registration writes are paused. Retained outcomes can still be checked.');
    })().catch(()=>{if(mounted&&current(ticket)){setBlocked(true);setMessage('Paper registration is unavailable. No legacy fallback or recovery deletion was used.');}});
    return()=>{mounted=false;};
    // The keyed owner remount owns this one workspace read; event handlers own later requests.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[actorId,tournamentId,store,key]);
  useEffect(()=>{try{const{data}=createClient().auth.onAuthStateChange(event=>{if(!alive.current||event==='INITIAL_SESSION')return;committed.current=null;epoch.current++;flight.current=false;setBusy(false);setWorkspace(null);setProfile(null);setFinished(null);setBlocked(true);setMessage('Sign-in changed. Recovery is preserved; reload this page after completing the account switch.');});return()=>data.subscription.unsubscribe();}catch{queueMicrotask(()=>{if(alive.current){committed.current=null;setBlocked(true);setMessage('Session verification is unavailable. Recovery is preserved.');}});}},[]);
  async function prepare() {
    if(!liveIntent()||!scope||!workspace?.writesEnabled||blocked||pending||flight.current)return;committed.current=null;flight.current=true;setBusy(true);setProfile(null);const ticket=++epoch.current;
    try{const fixed=structuredClone(draft),fingerprint=await identityMatchFingerprintV3(fixed);if(!current(ticket)||!fingerprint)throw Error('address');const v=readDuplicateSnapshotV3(await api('prepare',fixed),scope,fingerprint);if(!current(ticket))return;if(!v)throw Error('scope');setReview(v);setMessage('Review the exact matching registrations before saving.');}
    catch{if(current(ticket))setMessage('Duplicate review unavailable or address incomplete. No save was sent.');}
    finally{if(current(ticket)){flight.current=false;setBusy(false);}}
  }
  async function open(rid:string,expectedSubject?:string) {
    const ticket=epoch.current;if(!scope)throw Error('scope');const p=readProfileV8(await api('profile',undefined,rid),scope,rid);
    if(!current(ticket))return null;if(!p||expectedSubject&&p.player.playerIdentityId!==expectedSubject||!recordedCheckInIdentityV23(p,scope,rid))throw Error('binding');setProfile(p);return p;
  }
  async function openExisting(rid:string,expectedSubject:string) {
    if(!liveIntent()||!scope||blocked||pending||flight.current)return;committed.current=null;flight.current=true;setBusy(true);setProfile(null);const ticket=++epoch.current;
    try{const p=await open(rid,expectedSubject);if(p&&current(ticket))setMessage('Existing registration opened without a write.');}
    catch{if(current(ticket))setMessage('Existing registration needs current binding review. Nothing was saved.');}
    finally{if(current(ticket)){flight.current=false;setBusy(false);}}
  }
  async function consume(p:PendingV25,bytes:string,value:unknown,q?:RegistrationV25) {
    if(!scope||store.get(key)!==bytes)throw Error('recovery_changed');const ticket=epoch.current,r=readReplyV25(value,scope,p.operationId,p.requestHash,q,p.decision);
    if(!r||!current(ticket))throw Error('receipt');setFinished(null);
    if(r.status==='recorded'){if(!await open(r.player.rosterEntryId,r.player.playerIdentityId)||!current(ticket)||store.get(key)!==bytes)throw Error('readback');setFinished('recorded');setMessage('Legacy roster and identity readback verified under the same player ID. Finish confirmed recovery before another registration.');}
    else if(r.status==='open_existing'){if(!await open(r.rosterEntryId,r.playerIdentityId)||!current(ticket)||store.get(key)!==bytes)throw Error('readback');setFinished('open_existing');setMessage('Existing registration readback verified. No new person was created.');}
    else if(r.status==='rejected'){setFinished('rejected');setMessage('Exact operation rejected without creating a player: '+r.code+'. Finish the recorded rejection before reviewing a new request.');}
    else if(r.status==='absent')setMessage('No outcome is recorded for this exact operation. Keep recovery; re-enter the original details exactly before any retry.');
    else setMessage('This operation needs identity or idempotency review. Recovery is preserved.');
  }
  async function save(q:RegistrationV25) {
    if(!liveIntent()||!scope||!workspace?.writesEnabled||blocked||pending||flight.current||!validRegistrationV25(q))return;committed.current=null;flight.current=true;setBusy(true);setProfile(null);const ticket=++epoch.current;let dispatched=false;
    try{const fixed=structuredClone(q),digest=await requestHashV25(fixed);if(!current(ticket))return;const p:PendingV25={kind:'legacy-roster-identity-pending-v25',actorId,tournamentId,operationId:crypto.randomUUID(),requestHash:digest,sourceRevision:q.sourceRevision,sourceDigest:q.sourceDigest,decision:structuredClone(q.decision)},bytes=canonicalV5(p);
      if(!store.transition(key,null,bytes)||store.get(key)!==bytes)throw Error('storage');setPending(p);setRaw(bytes);memory.current=fixed;setFinished(null);
      dispatched=true;const value=await store.track(()=>api('write',{operationId:p.operationId,requestHash:digest,request:fixed}));if(!current(ticket))return;await consume(p,bytes,value,fixed);
    }catch{if(current(ticket))setMessage(dispatched?'Save outcome is uncertain. Preserve recovery and check the exact operation; do not clear browser data.':'No request was sent. Browser recovery could not be verified; keep any retained record for review.');}
    finally{if(current(ticket)){flight.current=false;setBusy(false);}}
  }
  async function recover(retry:boolean) {
    if(!liveIntent()||!scope||blocked||!pending||!raw||flight.current||retry&&!workspace?.writesEnabled)return;committed.current=null;flight.current=true;setBusy(true);setFinished(null);setProfile(null);const ticket=++epoch.current,p=pending,bytes=raw;
    try{if(store.get(key)!==bytes)throw Error('changed');let q:RegistrationV25|undefined;
      if(retry){q=memory.current??{kind:'legacy-roster-identity-request-v25',sourceRevision:p.sourceRevision,sourceDigest:p.sourceDigest,entry:structuredClone(draft.entry),address:structuredClone(draft.address),distinction:structuredClone(draft.distinction),decision:structuredClone(p.decision),reason};if(!validRegistrationV25(q)||await requestHashV25(q)!==p.requestHash){if(current(ticket))setMessage('Re-entered details do not match the retained digest. No retry was sent; recovery is preserved.');return;}}
      if(!current(ticket))return;const value=await store.track(()=>api(retry?'write':'reconcile',retry?{operationId:p.operationId,requestHash:p.requestHash,request:q}:{operationId:p.operationId,requestHash:p.requestHash,decision:p.decision}));if(!current(ticket))return;await consume(p,bytes,value,q);
    }catch{if(current(ticket))setMessage('Outcome remains unconfirmed. Original recovery is unchanged.');}
    finally{if(current(ticket)){flight.current=false;setBusy(false);}}
  }
  function finish() {
    if(!liveIntent()||!scope||blocked||!finished||!pending||!raw||flight.current)return;committed.current=null;epoch.current++;
    try{if(!store.transition(key,raw,null)||store.get(key)!==null)throw Error('changed');setPending(null);setRaw(null);setFinished(null);setReview(null);setProfile(null);memory.current=null;if(finished!=='rejected')setDraft(fresh());setMessage('Confirmed operation finished. Review a fresh source before the next registration.');}
    catch{setBlocked(true);setMessage('Recovery changed. No replacement record was removed by this view.');}
  }
  const disabled=busy||blocked||!workspace,profileView=profile&&scope?recordedCheckInIdentityV23(profile,scope,profile.rosterEntryId):null;
  return <main className="auth-shell"><section className="auth-card corrections-card"><h1>Paper player registration</h1><p>This saves a roster identity with an address and visible distinction. Record entry payments and check-in separately using the normal tournament tools.</p><p role="status" aria-live="polite">{message}</p>
    {pending&&<section aria-label="Exact paper registration recovery"><p>Only the operation ID, digest and nonpersonal review references are retained locally. After reload, re-enter the original details exactly to retry. Do not clear browser data.</p><button type="button" disabled={disabled} onClick={()=>void recover(false)}>Check retained paper registration</button><button type="button" disabled={disabled||!!finished||!workspace?.writesEnabled} onClick={()=>void recover(true)}>Compare and retry the exact paper registration</button><button type="button" disabled={disabled||!finished} onClick={finish}>{finished==='rejected'?'Finish recorded rejection':'Finish confirmed paper registration'}</button></section>}
    <fieldset disabled={disabled||!!finished}><legend>Paper player details</legend>{(['firstName','lastName']as const).map(k=><label key={k}>{k==='firstName'?'First name':'Last name'}<input maxLength={80} value={draft.entry[k]} onChange={event=>setDraft({...draft,entry:{...draft.entry,[k]:event.target.value}})}/></label>)}<NonmemberIdentityFieldsV1 value={draft.entry} onChange={entry=>setDraft({...draft,entry})}/>{(['street','postalCode','country']as const).map(k=><label key={k}>{({street:'Street address',postalCode:'Postal code',country:'Country'})[k]}<input value={draft.address[k]} maxLength={k==='street'?300:k==='postalCode'?40:80} onChange={event=>setDraft({...draft,address:{...draft.address,[k]:event.target.value}})}/></label>)}{(['prefix','middleName','suffix','localLabel']as const).map(k=><label key={k}>{({prefix:'Prefix',middleName:'Middle name',suffix:'Suffix',localLabel:'Local differentiating label'})[k]}<input maxLength={80} value={draft.distinction[k]} onChange={event=>setDraft({...draft,distinction:{...draft.distinction,[k]:event.target.value}})}/></label>)}<p>Legal report names remain unchanged. No birthdate is collected. Missing address information is not a completed duplicate check.</p><label>Reason for registration review<input maxLength={500} value={reason} onChange={event=>setReason(event.target.value)}/></label><button type="button" disabled={!!pending||!workspace?.writesEnabled} onClick={()=>void prepare()}>Check paper registration duplicates</button></fieldset>
    {!pending&&!disabled&&scope&&workspace?.writesEnabled&&<IdentityPreSaveReviewV3 showDistinctionFields={false} draft={draft} snapshot={review} scope={scope} onChange={setDraft} onRefresh={()=>void prepare()} onOpenExisting={target=>{const match=review?.matches.find(p=>p.rosterEntryId===target.rosterEntryId);if(match)void openExisting(target.rosterEntryId,match.playerIdentityId);}} onSave={state=>{if(state.status==='ready_new'||state.status==='ready_distinct')void save({kind:'legacy-roster-identity-request-v25',sourceRevision:state.sourceRevision,sourceDigest:state.sourceDigest,entry:draft.entry,address:draft.address,distinction:draft.distinction,decision:state.status==='ready_distinct'?{action:'distinct'}:null,reason});}}/>}
    {profileView&&<section aria-label="Recorded paper player"><h2>{profileView.displayName}</h2><p>{profileView.reference}</p><p>{profileView.nonmember?'Nonmember':'Membership not verified'}</p><p>This screen does not record payments, check-in or seating.</p></section>}
    <nav><a href={`/tournament/${tournamentId}/roster`}>Return to roster and record entry payments</a><a href={`/tournament/${tournamentId}/seating`}>Continue to Check-in and Seating</a></nav>
  </section></main>;
}
