import type{SeriesGameRetainedPortV1}from'./series-game-retained-v1.ts';
import{readNativeMixedPlayoffOwnV1,isNativeMixedPlayoffOwnScopeV1,buildNativeMixedPlayoffOwnCommandV1,type NativeMixedPlayoffOwnStateV1}from'./native-mixed-playoff-own-view-v1.ts';
import type{createNativeMixedPlayoffOwnTransportV1,NativeMixedPlayoffOwnTargetV1,NativeMixedPlayoffPreparedV1,NativeMixedPlayoffReceiptV1}from'../api/native-mixed-playoff-own-transport-v1.ts';
type Transport=ReturnType<typeof createNativeMixedPlayoffOwnTransportV1>;
type Options={target:NativeMixedPlayoffOwnTargetV1;retained:SeriesGameRetainedPortV1;transport:Transport;enabled?:()=>boolean;online?:()=>boolean};
type Snapshot={initialized:boolean;busy:boolean;blocked:boolean;phase:'empty'|'staged'|'recovery'|'attempted'|'acknowledged'|'rejected';pending:NativeMixedPlayoffPreparedV1|null;retainedRaw:string|null;receipt:NativeMixedPlayoffReceiptV1|null;state:NativeMixedPlayoffOwnStateV1|null;message:string};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,k:string[]):v is Record<string,unknown>=>object(v)&&Reflect.ownKeys(v).length===k.length&&k.every(x=>Object.hasOwn(v,x));
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const clone=<T>(v:T):T=>structuredClone(v);
const canonical=(v:unknown):string=>JSON.stringify(v,(_k,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
function plain(v:unknown,depth=0,budget={n:0},seen=new Set<object>()):boolean{
 if(depth>64||++budget.n>300000)return false;if(v===null||typeof v==='string'||typeof v==='boolean')return true;if(typeof v==='number')return Number.isFinite(v);
 if(typeof v!=='object'||seen.has(v)||(!Array.isArray(v)&&!object(v)))return false;seen.add(v);const keys=Reflect.ownKeys(v);if(Array.isArray(v)&&(v.length>10000||keys.length!==v.length+1))return false;
 for(const k of keys){if(Array.isArray(v)&&k==='length')continue;const d=Object.getOwnPropertyDescriptor(v,k);if(typeof k!=='string'||!d||!('value'in d)||!d.enumerable||!plain(d.value,depth+1,budget,seen))return false;}seen.delete(v);return true;
}
function validTarget(t:unknown):t is NativeMixedPlayoffOwnTargetV1{
 if(!plain(t)||!exact(t,['actorId','sessionId','projectUrl','projectRef','ownScope'])||!uuid(t.actorId)||!uuid(t.sessionId)||!isNativeMixedPlayoffOwnScopeV1(t.ownScope)||typeof t.projectRef!=='string'||!/^[a-z0-9-]{1,128}$/.test(t.projectRef)||typeof t.projectUrl!=='string')return false;
 try{const u=new URL(t.projectUrl);return u.protocol==='https:'&&!u.username&&!u.password&&u.origin===t.projectUrl;}catch{return false;}
}
export function nativeMixedPlayoffOwnPendingKeyV1(t:NativeMixedPlayoffOwnTargetV1){
 if(!validTarget(t))throw Error('invalid_pending_target');
 // Session/context/game/participant changes must find and block on older work.
 return`native-mixed-playoff-own-pending-v1:${encodeURIComponent(t.projectUrl)}:${t.projectRef}:${t.actorId}:${t.ownScope.tournamentId}:${t.ownScope.eventId}`;
}
function ack(value:unknown,p:NativeMixedPlayoffPreparedV1):NativeMixedPlayoffReceiptV1|null{
 try{if(!plain(value)||!object(value))return null;const keys=['status','contextId','slot','gameNumber','entryId','revision','historyDigest','sourceDigest','matchDigest','gameComplete','matchComplete','winnerId','simulationOnly','ordinaryQualificationRecorded','mrpAwarded','moneyMoved'],historical=Object.hasOwn(value,'historicalReceipt')||Object.hasOwn(value,'currentSourceVerified'),r=p.request;
  if(!exact(value,historical?[...keys,'historicalReceipt','currentSourceVerified']:keys)||value.status!=='simulated_playoff_evidence_recorded'||value.contextId!==r.data.contextId||value.slot!==r.data.slot||value.gameNumber!==r.data.gameNumber||value.matchDigest!==r.data.expectedMatchDigest||value.sourceDigest!==r.expectedSourceDigest||value.revision!==r.data.expectedRevision+1||!uuid(value.entryId)||!hash(value.historyDigest)||typeof value.gameComplete!=='boolean'||typeof value.matchComplete!=='boolean'||value.simulationOnly!==true||value.ordinaryQualificationRecorded!==false||value.mrpAwarded!==false||value.moneyMoved!==false||historical&&(value.historicalReceipt!==true||value.currentSourceVerified!==false))return null;
  if(r.data.entry.type==='digital-submit'&&(value.gameComplete||value.matchComplete||value.winnerId!==null))return null;
  if(value.matchComplete?(!value.gameComplete||value.winnerId!==r.data.entry.winnerParticipantId):value.winnerId!==null)return null;
  return clone(value)as NativeMixedPlayoffReceiptV1;
 }catch{return null;}
}
function negative(value:unknown):value is {status:'rejected'|'blocked';code:string}{
 if(!plain(value)||!exact(value,['status','code']))return false;
 return value.status==='blocked'&&['feature_unavailable','operation_history_unavailable'].includes(value.code as string)
  ||value.status==='rejected'&&['invalid_request','parent_or_context_unavailable','idempotency_conflict','source_changed','match_or_game_changed','history_changed','playoffs_complete','evidence_mismatch'].includes(value.code as string);
}
function freshProof(value:unknown,t:NativeMixedPlayoffOwnTargetV1,p:NativeMixedPlayoffPreparedV1,a:NativeMixedPlayoffReceiptV1){
 const state=readNativeMixedPlayoffOwnV1(value,t.ownScope),r=p.request;if(state?.status!=='simulated_playoff_own_available'||state.contextId!==r.data.contextId||state.sourceDigest!==r.expectedSourceDigest)return null;
 const m=state.matches.find(x=>x.slot===r.data.slot&&x.matchDigest===r.data.expectedMatchDigest),g=m?.games.find(x=>x.gameNumber===r.data.gameNumber);if(!g?.counterEvidenceAvailable||g.revision<a.revision)return null;
 const e=g.entries[a.revision-1];if(!e||e.id!==a.entryId)return null;
 const wanted={id:a.entryId,...clone(r.data.entry)}as Record<string,unknown>;delete wanted.statement;
 return canonical(e)===canonical(wanted)?state:null;
}
/** Default-off one-operation recovery controller. Existing retained-port CAS
 * owns durable transactions and atomic immutable archive+clear. No storage
 * engine, automatic send, operation ID, request rebasing or terminal resolver.
 * A validated rejection may CAS a local hold envelope around the VERBATIM
 * original raw; this is a device copy, not a terminal server resolution. If
 * that storage write fails, current controls stay blocked but a later reload
 * can only find the original request and allow the SAME idempotent exact retry.
 * It never authorizes a new nonce, rewritten request or pending clear.
 * Restore only accepts this transport version's controlled request; unknown,
 * other-account and old-session bytes stay untouched and block. The host must
 * dispose/recreate on identity/target changes and supply authenticated transport.
 * Actual IndexedDB-origin/provider acceptance is a separate, unperformed gate.
 */
export class NativeMixedPlayoffOwnPendingV1{
 private s:Snapshot={initialized:false,busy:false,blocked:false,phase:'empty',pending:null,retainedRaw:null,receipt:null,state:null,message:''};
 private t:NativeMixedPlayoffOwnTargetV1|null=null;private raw:string|null=null;private disposed=false;private flight:AbortController|null=null;
 private retained:SeriesGameRetainedPortV1;private transport:Transport;private enabled:()=>boolean;private online:()=>boolean;
 constructor(o:Options){this.retained=o.retained;this.transport=o.transport;this.enabled=o.enabled??(()=>false);this.online=o.online??(()=>false);try{if(validTarget(o.target))this.t=clone(o.target);}catch{/* no IO */}}
 getSnapshot(){return clone(this.s);}
 dispose(){this.disposed=true;this.flight?.abort();this.flight=null;this.raw=null;this.s={...this.s,initialized:false,busy:false,blocked:true,pending:null,retainedRaw:null,receipt:null,state:null,message:''};}
 private ready(){try{return!this.disposed&&this.t!==null&&this.enabled()===true;}catch{return false;}}
 private connected(){try{return this.online()===true;}catch{return false;}}
 private active(c:AbortController){return this.ready()&&this.flight===c&&!c.signal.aborted;}
 private start(){if(!this.ready()||this.s.busy)return null;const c=new AbortController();this.flight=c;this.s.busy=true;return c;}
 private end(c:AbortController){if(this.flight===c){this.flight=null;this.s.busy=false;}}
 private restore(raw:string):NativeMixedPlayoffPreparedV1|null{
  try{if(!this.t||raw.length>32000||new TextEncoder().encode(raw).byteLength>32000)return null;const p:unknown=JSON.parse(raw);
   if(!plain(p)||!exact(p,['version','target','operationId','request'])||p.version!=='native-mixed-playoff-prepared-v1'||!validTarget(p.target)||canonical(p.target)!==canonical(this.t)||!uuid(p.operationId)||!object(p.request))return null;
   const command={...p.request};delete command.reason;
   const generated=this.transport.prepare(p.operationId,command as Parameters<Transport['prepare']>[1]);
   if(!generated||canonical(JSON.parse(generated.retainedRaw))!==canonical(p))return null;
   return{...clone(p),retainedRaw:raw}as NativeMixedPlayoffPreparedV1;
  }catch{return null;}
 }
 private load(raw:string|null){
  this.raw=raw;let held:NativeMixedPlayoffPreparedV1|null=null;
  try{if(typeof raw==='string'&&raw.length<=64000&&new TextEncoder().encode(raw).byteLength<=64000){const h:unknown=JSON.parse(raw);if(plain(h)&&exact(h,['version','retainedRaw','rejection'])&&h.version==='native-mixed-playoff-rejection-hold-v1'&&typeof h.retainedRaw==='string'&&negative(h.rejection))held=this.restore(h.retainedRaw);}}catch{/* Unknown bytes remain untouched. */}
  if(held){this.s={...this.s,initialized:true,pending:held,retainedRaw:raw,blocked:true,phase:'rejected',receipt:null,state:null,message:'A local copy of a server rejection is held for director review. No terminal resolver or pending clear is available.'};return;}
  const p=typeof raw==='string'?this.restore(raw):null;
  this.s={...this.s,initialized:true,pending:p,retainedRaw:raw,blocked:raw!==null&&!p,phase:raw===null?'empty':'recovery',receipt:null,state:null,
   message:raw===null?'':p?'An earlier exact request is saved. It may already have been sent. Retry only that exact operation.':'Saved data is unknown, belongs to another scope, or uses an older session. It is preserved and will not be sent or replaced.'};
 }
 async initialize(){const c=this.start();if(!c||!this.t)return;try{const raw=await this.retained.read(nativeMixedPlayoffOwnPendingKeyV1(this.t));if(this.active(c))this.load(raw);}catch{if(this.active(c))this.s={...this.s,initialized:true,blocked:true,message:'Recovery storage is unavailable. Nothing will be sent.'};}finally{this.end(c);}}
 async stage(input:NativeMixedPlayoffPreparedV1,loadedState:unknown){
  if(!this.ready()||!this.t||!this.s.initialized||this.s.blocked||this.raw!==null)return false;
  let p:NativeMixedPlayoffPreparedV1|null=null;try{if(plain(input)&&typeof input.retainedRaw==='string'){p=this.restore(input.retainedRaw);if(p&&canonical(p)!==canonical(input))p=null;}}catch{/* unchanged */}
  if(!p)return false;const entry=p.request.data.entry,choice=entry.type==='digital-confirm'?'confirm':entry.winnerParticipantId===this.t.ownScope.participantId?'own':'opponent';
  const expected=buildNativeMixedPlayoffOwnCommandV1(loadedState,this.t.ownScope,choice),actual={...p.request}as Record<string,unknown>;delete actual.reason;if(!expected||canonical(expected)!==canonical(actual))return false;
  const c=this.start();if(!c)return false;const raw=p.retainedRaw,key=nativeMixedPlayoffOwnPendingKeyV1(this.t);
  try{
   if(!await this.retained.transition(key,null,raw,undefined,c.signal)){if(this.active(c)){this.s.blocked=true;this.s.message='Another window has saved work. Reload recovery; nothing was sent.';}return false;}
   if(!this.active(c))return false;const stored=await this.retained.read(key);if(!this.active(c))return false;
   if(stored!==raw){this.s.blocked=true;this.s.message='Saved bytes changed. Nothing was sent or cleared.';return false;}
   this.load(stored);this.s.phase='staged';this.s.message='Exact request saved on this device. Not sent.';return true;
  }catch{if(this.active(c)){this.s.blocked=true;this.s.message='The local save could not be confirmed. Reload recovery; do not replace it.';}return false;}finally{this.end(c);}
 }
 async sendExact(){if(this.s.phase!=='staged')return;return this.act(true);}
 async retryExact(){return this.act(true);}
 async checkFresh(){return this.act(false);}
 private async act(write:boolean){
  if(!this.ready()||!this.t||!this.connected()||!this.s.initialized||this.s.blocked||!this.s.pending||!this.raw)return;
  const c=this.start();if(!c)return;const raw=this.raw,p=clone(this.s.pending),key=nativeMixedPlayoffOwnPendingKeyV1(this.t);
  try{
   if(await this.retained.read(key)!==raw){if(this.active(c)){this.s.blocked=true;this.s.message='Another window changed recovery. Nothing was sent or cleared.';}return;}
   if(!this.active(c)||!this.connected())return;
   if(write){
    // Revalidate the exact durable bytes with CAS before any explicit dispatch.
    // Two explicit windows can only dispatch the same immutable operation ID;
    // this is not a cross-window mutex or permission to generate a replacement.
    if(!await this.retained.transition(key,raw,raw,undefined,c.signal)){if(this.active(c)){this.s.blocked=true;this.s.message='Recovery changed. Nothing was sent.';}return;}
    if(!this.active(c)||!this.connected())return;if(await this.retained.read(key)!==raw){if(this.active(c))this.s.blocked=true;return;}if(!this.active(c)||!this.connected())return;
    this.s.phase='attempted';this.s.receipt=null;
    const reply=await this.transport.write(p);if(!this.active(c))return;
    if(reply.error!==null||!reply.data){this.s.message='The outcome is unknown. The exact saved bytes are kept. Only an explicit exact retry may resend them.';return;}
    if(reply.dispatched!==true||!plain(reply.prepared)||canonical(reply.prepared)!==canonical(p)){
     this.s.message='The returned operation did not match the retained request. Exact bytes are preserved.';return;
    }
    if(negative(reply.data)){
     this.s.blocked=true;this.s.phase='rejected';
     const hold=canonical({version:'native-mixed-playoff-rejection-hold-v1',retainedRaw:raw,rejection:clone(reply.data)});let persisted=false;
     try{persisted=await this.retained.transition(key,raw,hold,undefined,c.signal);}catch{/* Current controls remain blocked; never claim a durable hold. */}
     if(!this.active(c))return;
     if(persisted){this.raw=hold;this.s.retainedRaw=hold;this.s.message='The rejected request and original exact bytes are held on this device for director review. No terminal resolver is available.';}
     else this.s.message='The server rejected this request, but a durable local hold could not be confirmed. The current controls are blocked; preserve the original request for director review.';
     return;
    }
    const accepted=ack(reply.data,p);if(!accepted){this.s.message='No matching receipt was established. Exact bytes remain saved; no new operation may replace them.';return;}
    this.s.receipt=accepted;this.s.phase='acknowledged';
   }
   const accepted=this.s.receipt;if(!accepted){this.s.message='A fresh read cannot identify this operation without its receipt. The exact saved request remains; explicitly retry it to recover the receipt.';return;}
   if(!this.connected())return;const fresh=await this.transport.read();if(!this.active(c))return;
   const proof=fresh.error===null?freshProof(fresh.data,this.t,p,accepted):null;
   if(!proof){this.s.message='A receipt exists, but current matching server evidence is unavailable. Exact bytes remain saved.';return;}
   if(!this.connected())return;if(await this.retained.read(key)!==raw){if(this.active(c)){this.s.blocked=true;this.s.message='Newer recovery data exists. Nothing was cleared.';}return;}if(!this.active(c)||!this.connected())return;
   const archive={id:`${key}:receipt:${p.operationId}`,raw:canonical({version:'native-mixed-playoff-own-archive-v1',retainedRaw:raw,prepared:p,receipt:accepted,proof})};
   if(new TextEncoder().encode(archive.raw).byteLength>32000000){this.s.message='Recovery proof exceeds the local processing bound. Exact pending bytes remain saved.';return;}
   if(!await this.retained.transition(key,raw,null,archive,c.signal)){if(this.active(c)){this.s.blocked=true;this.s.message='Recovery changed while archiving. Nothing was cleared by this operation.';}return;}
   if(!this.active(c))return;this.raw=null;this.s={...this.s,pending:null,retainedRaw:null,phase:'empty',blocked:false,state:clone(proof),message:'Matching server evidence was checked. The original request, receipt and proof were archived atomically on this device.'};
  }catch{if(this.active(c))this.s.message='Recovery or storage could not be confirmed. The exact saved request is preserved.';}finally{this.end(c);}
 }
}
