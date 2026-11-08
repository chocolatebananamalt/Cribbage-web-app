import {isNativeMixedGameTargetV1,isNativeMixedGameWriteRequestV1,readNativeMixedGameWriteReceiptV1,readNativeMixedGameClosedV1,readNativeMixedGameStateV1,
 type NativeMixedGameTargetV1,type NativeMixedGameWriteRequestV1,type NativeMixedGameWriteReceiptV1} from './native-mixed-game-evidence-v1.ts';
import type {createNativeMixedGameEvidenceTransportV1} from '../api/native-mixed-game-evidence-transport-v1.ts';
import type {SeriesGameRetainedPortV1} from '../playoffs/series-game-retained-v1.ts';

export type NativeMixedGamePendingV1={kind:'native-mixed-game-pending-v1';phase:'staged'|'attempted'|'retryable';attempt?:number;target:NativeMixedGameTargetV1;ownParticipantId:string|null;request:NativeMixedGameWriteRequestV1};
type Options={target:NativeMixedGameTargetV1;ownParticipantId:string|null;retained:SeriesGameRetainedPortV1;transport:Transport;enabled?:()=>boolean;online:()=>boolean};
type Transport=ReturnType<typeof createNativeMixedGameEvidenceTransportV1>;
type Snapshot={initialized:boolean;busy:boolean;pending:NativeMixedGamePendingV1|null;blocked:boolean;message:string;receipt:NativeMixedGameWriteReceiptV1|null};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const clone=<T>(v:T):T=>structuredClone(v);
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const canonical=(v:unknown):string=>JSON.stringify(v,(_k,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const same=(a:unknown,b:unknown)=>canonical(a)===canonical(b);
const eventScope=(t:NativeMixedGameTargetV1)=>({actorId:t.actorId,projectUrl:t.projectUrl,projectRef:t.projectRef,tournamentId:t.tournamentId,eventId:t.eventId});
export function nativeMixedGamePendingKeyV1(t:NativeMixedGameTargetV1){
 if(!isNativeMixedGameTargetV1(t))throw Error('invalid_pending_target');
 // Session/game/Start changes must find earlier work, not hide it in a new key.
 return `native-mixed-game-pending-v1:${t.projectRef}:${t.actorId}:${t.tournamentId}:${t.eventId}`;
}
export function parseNativeMixedGamePendingV1(raw:string):NativeMixedGamePendingV1|null{
 try{
  if(new TextEncoder().encode(raw).byteLength>64000)return null;const p:unknown=JSON.parse(raw);
  if(!object(p)||!['kind,ownParticipantId,phase,request,target','attempt,kind,ownParticipantId,phase,request,target'].includes(Object.keys(p).sort().join())||p.kind!=='native-mixed-game-pending-v1'||!['staged','attempted','retryable'].includes(p.phase as string)
   ||('attempt'in p&&(!Number.isSafeInteger(p.attempt)||Number(p.attempt)<1))||p.phase==='retryable'&&!('attempt'in p)
   ||!isNativeMixedGameTargetV1(p.target)||!(p.ownParticipantId===null||uuid(p.ownParticipantId))||!isNativeMixedGameWriteRequestV1(p.request)
   ||(p.ownParticipantId===null?!['paper-capture','paper-review'].includes(p.request.action):!['digital-submit','digital-confirm'].includes(p.request.action)||!('participantId'in p.request.payload)||p.request.payload.participantId!==p.ownParticipantId)
   ||p.request.startId!==p.target.startId||p.request.gameId!==p.target.gameId||p.request.expectedStartSourceDigest!==p.target.startSourceDigest)return null;
  return clone(p)as NativeMixedGamePendingV1;
 }catch{return null;}
}

/** Private/default-off evidence pending controller. Null ownParticipantId is
 * exclusively the nonplaying Paper-official channel, never a Digital delegate.
 * Server role/identity/nonself checks remain authoritative. No automatic dispatch, ID
 * generation, rebasing, pending deletion on logout or verification authority.
 * The injected retained port must supply transactional CAS+archive semantics.
 * Construction never opens storage. Initialization only reads the injected
 * retained port and never calls a provider. Host must dispose on account change.
 */
export class NativeMixedGamePendingControllerV1{
 private s:Snapshot={initialized:false,busy:false,pending:null,blocked:false,message:'',receipt:null};
 private raw:string|null=null;private disposed=false;private flight:AbortController|null=null;
 private target:NativeMixedGameTargetV1;private participant:string|null;
 private o:Options;
 constructor(o:Options){
  this.o=o;this.target=clone(o.target);this.participant=o.ownParticipantId;
 }
 getSnapshot(){return clone(this.s);}
 dispose(){this.disposed=true;this.flight?.abort();this.flight=null;this.raw=null;
  this.s={initialized:false,busy:false,pending:null,blocked:true,message:'',receipt:null};}
 private ready(){return !this.disposed&&this.o.enabled?.()===true&&isNativeMixedGameTargetV1(this.target)&&(this.participant===null||uuid(this.participant));}
 private active(signal:AbortSignal){return this.ready()&&!signal.aborted;}
 private load(raw:string|null){
  this.raw=raw;const p=raw===null?null:parseNativeMixedGamePendingV1(raw);
  const fits=p&&same(eventScope(p.target),eventScope(this.target))&&p.ownParticipantId===this.participant;
  this.s={...this.s,initialized:true,pending:fits?p:null,blocked:raw!==null&&!fits,receipt:null,
   message:raw===null?'':fits?'Saved on this device. Check the outcome before entering another result.':'Saved recovery data needs review. Nothing will be replaced or sent.'};
 }
 async initialize(){
  if(!this.ready()||this.s.busy)return;this.s.busy=true;
  try{const raw=await this.o.retained.read(nativeMixedGamePendingKeyV1(this.target));if(this.ready())this.load(raw);}
  catch{if(this.ready())this.s={...this.s,initialized:true,blocked:true,message:'Recovery storage could not be checked. Nothing will be sent.'};}
  finally{if(!this.disposed)this.s.busy=false;}
 }
 /** Persist only. Offline authoring needs a previously loaded, matching source
  * supplied by the host; neither cached state nor saving grants server authority.
  */
 async save(request:NativeMixedGameWriteRequestV1,loadedState:unknown){
  if(!this.ready()||!this.s.initialized||this.s.busy||this.s.blocked||this.raw!==null)return false;
  const r=clone(request),state=readNativeMixedGameStateV1(loadedState,this.target);
  const p:NativeMixedGamePendingV1={kind:'native-mixed-game-pending-v1',phase:'staged',target:clone(this.target),ownParticipantId:this.participant,request:r};
  const raw=canonical(p);
  if(!parseNativeMixedGamePendingV1(raw)||!state||this.participant!==null&&state.playOrder!=='current'||r.expectedRevision!==state.revision||r.expectedHistoryDigest!==state.historyDigest)return false;
  this.s.busy=true;const controller=new AbortController();this.flight=controller;
  try{
   const key=nativeMixedGamePendingKeyV1(this.target);
   if(!await this.o.retained.transition(key,null,raw,undefined,controller.signal)){
    if(this.active(controller.signal))this.load(await this.o.retained.read(key));return false;
   }
   if(!this.active(controller.signal))return false;
   const stored=await this.o.retained.read(key);if(!this.active(controller.signal))return false;
   this.load(stored);if(stored!==raw){this.s.blocked=true;this.s.message='Saved data changed. Nothing will be sent.';return false;}
   this.s.message='Saved on this device. Not yet checked by the server.';return true;
  }catch{if(this.active(controller.signal)){this.s.blocked=true;this.s.message='The local save could not be confirmed. Keep this page and check recovery.';}return false;}
  finally{if(!this.disposed){this.s.busy=false;this.flight=null;}}
 }
 async sendExact(){return this.act('send');}
 async checkOutcome(){return this.act('recover');}
 async resolveExact(){return this.act('resolve');}
 private async act(mode:'send'|'recover'|'resolve'){
  if(!this.ready()||!this.o.online()||!this.s.initialized||this.s.busy||this.s.blocked||!this.s.pending||!this.raw)return;
  let pending=clone(this.s.pending),raw=this.raw;const key=nativeMixedGamePendingKeyV1(this.target),controller=new AbortController();
  if(mode==='send'&&!['staged','retryable'].includes(pending.phase)){this.s.message='This action may already have been sent. Check its outcome; it will not be sent again.';return;}
  if(mode==='resolve'&&pending.phase!=='attempted'){this.s.message='Check the saved outcome or retry the exact entry first.';return;}
  // New login for the same subject may recover exact older bytes. Source/game
  // are retained; never substitute the currently displayed game or new digest.
  const target={...pending.target,sessionId:this.target.sessionId};
  this.s.busy=true;this.flight=controller;
  try{
   if(await this.o.retained.read(key)!==raw){if(this.active(controller.signal)){this.s.blocked=true;this.s.message='Saved data changed. Reload recovery before sending.';}return;}
   if(!this.active(controller.signal)||!this.o.online())return;
   if(mode==='send'){
    const attempt=(pending.attempt??0)+1;
    if(!Number.isSafeInteger(attempt)){this.s.blocked=true;return;}
    const attempted={...pending,phase:'attempted' as const,attempt},next=canonical(attempted);
    // Durable CAS reserves the sole dispatch before touching the network. A
    // crash after this point is unknown, even if the HTTP call never starts.
    if(!await this.o.retained.transition(key,raw,next,undefined,controller.signal)){
     if(this.active(controller.signal)){this.s.blocked=true;this.s.message='Another window changed recovery. Nothing was sent from this window.';}return;
    }
    if(!this.active(controller.signal))return;
    pending=attempted;raw=next;this.raw=next;this.s.pending=clone(attempted);
    if(await this.o.retained.read(key)!==next){if(this.active(controller.signal))this.s.blocked=true;return;}
    if(!this.active(controller.signal)||!this.o.online())return;
   }
   const reply=mode==='send'?await this.o.transport.write(target,clone(pending.request)):mode==='resolve'?await this.o.transport.resolve(target,clone(pending.request)):await this.o.transport.recover(target,clone(pending.request));
   if(!this.active(controller.signal))return;
   // Only a decoded, authenticated reply to THIS dispatch permits an explicit
   // exact retry. A busy competing invocation may still commit, so neither a
   // null recovery nor this response permits deletion, rebasing or a new ID.
   // Monotonic attempt bytes prevent an old response from resetting a newer
   // dispatch (ABA). Unknown transport outcomes remain read-only recovery.
   if(mode==='send'&&reply.error===null&&reply.data?.status==='retry_exact'&&reply.data.code==='source_busy'){
    const retryable={...pending,phase:'retryable' as const},next=canonical(retryable);
    if(await this.o.retained.transition(key,raw,next,undefined,controller.signal)&&this.active(controller.signal)){
     this.raw=next;this.s.pending=clone(retryable);this.s.receipt=null;
     this.s.message='The server was busy. Your exact entry is saved. Check its outcome or retry the same entry.';
    }else if(this.active(controller.signal)){this.s.blocked=true;this.s.message='Recovery changed. Reload it before continuing.';}
    return;
   }
   const closed=reply.error===null&&reply.data&&readNativeMixedGameClosedV1(reply.data,target,pending.request);
   if(closed){
    const archive={id:`${key}:${pending.request.operationId}`,raw:canonical({pending:raw,closure:closed})};
    if(await this.o.retained.transition(key,raw,null,archive,controller.signal)&&this.active(controller.signal)){
     this.raw=null;this.s.pending=null;this.s.receipt=null;
     this.s.message='The server closed this exact request without recording a score. A recovery copy is kept. Refresh current game information before entering again.';
    }else if(this.active(controller.signal)){this.s.blocked=true;this.s.message='Recovery changed. Nothing was cleared.';}
    return;
   }
   const accepted=reply.data&&readNativeMixedGameWriteReceiptV1(reply.data,target,pending.request);
   if(!accepted){this.s.receipt=null;this.s.message='The action is not confirmed. Its exact saved copy is kept; check the outcome before trying again.';return;}
   this.s.receipt=accepted;
   if(!this.o.online()){this.s.message='A receipt was found. Reconnect to check the current game; the saved copy is kept.';return;}
   const fresh=await this.o.transport.state(target);if(!this.active(controller.signal))return;
   const state=fresh.data&&readNativeMixedGameStateV1(fresh.data,target);
   if(!state||state.evidenceVisibility!=='evidence'||state.revision<accepted.revision||!state.entries.some(e=>same(e,accepted.entry))){
    this.s.message='A receipt was found, but the current game has not confirmed it. The saved copy is kept.';return;
   }
   const archive={id:`${key}:${pending.request.operationId}`,raw:canonical({pending:raw,receipt:accepted})};
   if(await this.o.retained.transition(key,raw,null,archive,controller.signal)&&this.active(controller.signal)){
    this.raw=null;this.s.pending=null;this.s.message='The simulated entry was recorded and checked. A recovery copy is kept on this device.';
   }else if(this.active(controller.signal))this.s.message='Recovery changed while checking. Nothing was cleared.';
  }catch{if(this.active(controller.signal))this.s.message='The outcome is not known. The exact saved action is kept.';}
  finally{if(!this.disposed){this.s.busy=false;this.flight=null;}}
 }
}
