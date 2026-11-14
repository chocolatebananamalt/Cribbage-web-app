import type{SeriesGameRetainedPortV1}from'./series-game-retained-v1.ts';
import type{createPlayoffPaperTransportV1}from'../api/native-mixed-playoff-paper-transport-v1.ts';
import{readPlayoffPaperPreparedV1,readPlayoffPaperWorkspaceV1,readPlayoffPaperReceiptV1,isPlayoffPaperRequestV1,buildPlayoffPaperRequestV1,type PlayoffPaperTargetV1,type PlayoffPaperPreparedV1,type PlayoffPaperRequestV1,type PlayoffPaperWorkspaceV1,type PlayoffPaperReceiptV1}from'./native-mixed-playoff-paper-v1.ts';
import{readPlayoffPaperClosureV1,readPlayoffPaperRecoveryV1}from'./native-mixed-playoff-paper-recovery-v1.ts';
import{isPlayoffReopenTargetV1,playoffCorrectionPlainV1 as plain,playoffCorrectionExactV1 as exact,playoffCorrectionSameV1 as same}from'./native-mixed-playoff-reopen-v1.ts';
type Transport=ReturnType<typeof createPlayoffPaperTransportV1>;
type Stored={version:'native-mixed-playoff-paper-retained-v1';preparedRaw:string;attempted:boolean;rejection:string|null};
type Snapshot={initialized:boolean;busy:boolean;blocked:boolean;pending:PlayoffPaperPreparedV1|null;attempted:boolean;rejection:string|null;canRetryOriginal:boolean;workspace:PlayoffPaperWorkspaceV1|null;savedWorkspace:PlayoffPaperWorkspaceV1|null;receipt:PlayoffPaperReceiptV1|null;resolutionKey:string|null;message:string};
const codes=['invalid_request','parent_or_context_unavailable','idempotency_conflict','source_changed','source_unavailable','match_or_game_changed','history_changed','playoffs_complete','evidence_mismatch','feature_unavailable','operation_history_unavailable','legacy_capture_unsupported'];
const clone=<T>(v:T):T=>structuredClone(v);
export function playoffPaperPendingKeyV1(t:PlayoffPaperTargetV1){if(!isPlayoffReopenTargetV1(t))throw Error('invalid_target');return`native-mixed-playoff-paper-pending-v1:${encodeURIComponent(t.projectUrl)}:${t.projectRef}:${t.actorId}:${t.tournamentId}:${t.eventId}`;}
/** Exact one-paper-operation recovery per actor/project/event. Earlier games
 * are found, not hidden/rebased; unknown sessions are opaque. A matching full
 * accepted/superseded/absence-closure proof must be atomically archived before
 * clear. No automatic resend, nonce generation or qualifying writer. */
export class PlayoffPaperPendingV1{
 private s:Snapshot={initialized:false,busy:false,blocked:false,pending:null,attempted:false,rejection:null,canRetryOriginal:false,workspace:null,savedWorkspace:null,receipt:null,resolutionKey:null,message:''};
 private raw:string|null=null;private disposed=false;private flight:AbortController|null=null;private t:PlayoffPaperTargetV1;private key:string;private retained:SeriesGameRetainedPortV1;private transport:Transport;private enabled:()=>boolean;private online:()=>boolean;
 constructor(o:{target:PlayoffPaperTargetV1;retained:SeriesGameRetainedPortV1;transport:Transport;enabled?:()=>boolean;online?:()=>boolean}){if(!isPlayoffReopenTargetV1(o.target))throw Error('invalid_target');this.t=clone(o.target);this.key=playoffPaperPendingKeyV1(this.t);this.retained=o.retained;this.transport={...o.transport};this.enabled=o.enabled??(()=>false);this.online=o.online??(()=>false);}
 getSnapshot(){return clone(this.s);}
 dispose(){this.disposed=true;this.flight?.abort();this.raw=null;this.s={...this.s,initialized:false,busy:false,blocked:true,pending:null,workspace:null,savedWorkspace:null,receipt:null,canRetryOriginal:false};}
 private on(){try{return!this.disposed&&this.enabled()===true;}catch{return false;}}
 private connected(){try{return this.online()===true;}catch{return false;}}
 private active(c:AbortController){return this.on()&&this.flight===c&&!c.signal.aborted;}
 private start(){if(!this.on()||this.s.busy)return null;const c=new AbortController();this.flight=c;this.s.busy=true;return c;}
 private end(c:AbortController){if(this.flight===c){this.flight=null;this.s.busy=false;}}
 private unpack(raw:string):{stored:Stored;prepared:PlayoffPaperPreparedV1}|null{try{
  if(new TextEncoder().encode(raw).byteLength>36000)return null;const e:unknown=JSON.parse(raw);if(!plain(e)||!exact(e,['version','preparedRaw','attempted','rejection'])||e.version!=='native-mixed-playoff-paper-retained-v1'||typeof e.preparedRaw!=='string'||typeof e.attempted!=='boolean'||!(e.rejection===null||typeof e.rejection==='string'&&codes.includes(e.rejection))||e.rejection!==null&&!e.attempted)return null;
  const body:unknown=JSON.parse(e.preparedRaw);if(!plain(body)||!exact(body,['version','target','operationId','request']))return null;const p=readPlayoffPaperPreparedV1({...body,retainedRaw:e.preparedRaw},this.t);return p?{stored:e as Stored,prepared:p}:null;
 }catch{return null;}}
 private adopt(raw:string|null){this.raw=raw;const p=raw===null?null:this.unpack(raw);this.s={...this.s,initialized:true,pending:p?clone(p.prepared):null,attempted:p?.stored.attempted??false,rejection:p?.stored.rejection??null,canRetryOriginal:false,receipt:null,savedWorkspace:null,blocked:raw!==null&&(!p||p.stored.rejection!==null),message:raw===null?'':p?'An exact paper reading is saved. Check its outcome or explicitly retry the same operation.':'Earlier or unrecognized saved work is preserved. Its reading is hidden and will not be sent or replaced.'};}
 async initialize(){const c=this.start();if(!c)return;try{const raw=await this.retained.read(this.key);if(this.active(c))this.adopt(raw);}catch{if(this.active(c))this.s={...this.s,initialized:true,blocked:true,message:'Recovery storage is unavailable. Nothing will be sent.'};}finally{this.end(c);}}
 async refresh(){if(!this.s.initialized||this.raw!==null&&!this.s.pending||!this.connected())return;const c=this.start();if(!c)return;try{const reply=await this.transport.read();if(!this.active(c))return;this.s.workspace=reply.error===null?readPlayoffPaperWorkspaceV1(reply.data,this.t):null;if(!this.s.workspace)this.s.message='Current paper evidence is unavailable. Saved readings are preserved.';}catch{if(this.active(c)){this.s.workspace=null;this.s.message='Current paper evidence could not be checked. Saved readings are preserved.';}}finally{this.end(c);}}
 async stage(operationId:string,request:PlayoffPaperRequestV1,loaded:unknown){
  if(!this.s.initialized||this.s.blocked||this.raw!==null||!this.s.workspace||!isPlayoffPaperRequestV1(request,this.t))return false;const w=readPlayoffPaperWorkspaceV1(loaded,this.t);if(!w||!same(w,this.s.workspace))return false;
  const e=request?.data?.entry;if(!e)return false;const claims=e.type==='paper-capture'?e.claims:e.reenteredClaims;let expected:PlayoffPaperRequestV1|null=null;try{expected=buildPlayoffPaperRequestV1(w,Object.fromEntries(claims.map(c=>[c.participantId,c.winnerParticipantId])),e.type==='paper-capture'?e.artifactId:undefined);}catch{return false;}if(!expected||!same(expected,request))return false;
  const packet=this.transport.prepare(operationId,request),p=packet?readPlayoffPaperPreparedV1(packet,this.t,true):null;if(!p)return false;const c=this.start();if(!c)return false;const raw=JSON.stringify({version:'native-mixed-playoff-paper-retained-v1',preparedRaw:p.retainedRaw,attempted:false,rejection:null});
  try{if(!await this.retained.transition(this.key,null,raw,undefined,c.signal)||!this.active(c)||await this.retained.read(this.key)!==raw){if(this.active(c)){this.s.blocked=true;this.s.message='Another window changed recovery. Nothing was sent.';}return false;}if(!this.active(c))return false;this.adopt(raw);this.s.message='Exact paper reading saved locally. Not sent.';return true;}catch{if(this.active(c)){this.s.blocked=true;this.s.message='The local save could not be confirmed. Preserve the reading; nothing was sent.';}return false;}finally{this.end(c);}
 }
 async submitExact(){if(!this.s.initialized||!this.s.pending||!this.raw||!this.connected()||this.s.blocked&&!this.s.canRetryOriginal)return;const c=this.start();if(!c)return;const original=this.raw,p=clone(this.s.pending),held=this.unpack(original);if(!held){this.end(c);return;}this.s.canRetryOriginal=false;
  try{if(await this.retained.read(this.key)!==original||!this.active(c)||!this.connected())return;const raw=JSON.stringify({...held.stored,attempted:true});if(!await this.retained.transition(this.key,original,raw,undefined,c.signal)||!this.active(c))return;this.raw=raw;this.s.attempted=true;if(await this.retained.read(this.key)!==raw||!this.active(c)||!this.connected())return;
   const reply=await this.transport.write(p);if(!this.active(c))return;if(reply.error!==null||!reply.data||!reply.prepared||!same(reply.prepared,p)||reply.dispatched!==true){this.s.message='The outcome is unknown. The exact saved reading remains; it will not resend automatically.';return;}
   const ack=readPlayoffPaperReceiptV1(reply.data,p.request);if(ack){this.s.receipt=ack;await this.resolve(c,raw,p,false);return;}
   const v=reply.data;if(!('code'in v)){this.s.message='No matching receipt was established. The exact reading remains saved.';return;}if(exact(v,['status','code'])&&v.status==='retry_exact'){this.s.message='Paper recording is unavailable or busy. The exact request remains saved for an explicit check or retry.';return;}
   if(exact(v,['status','code'])&&typeof v.code==='string'&&codes.includes(v.code)){
    const next=JSON.stringify({...held.stored,attempted:true,rejection:v.code});this.s.blocked=true;this.s.rejection=v.code;try{if(await this.retained.transition(this.key,raw,next,undefined,c.signal)&&this.active(c))this.raw=next;}catch{/* exact earlier bytes remain */}if(this.active(c))this.s.message='The reading was rejected. Its exact original request remains saved; check an authoritative recovery outcome before proceeding.';return;
   }
   this.s.message='No matching receipt was established. The exact reading remains saved.';
  }catch{if(this.active(c))this.s.message='Recording or recovery could not be confirmed. The exact reading is preserved.';}finally{this.end(c);}
 }
 async checkOutcome(){return this.check(false);}
 async closeObsolete(){return this.check(true);}
 private async check(close:boolean){if(!this.s.initialized||!this.s.pending||!this.raw||!this.connected())return;const c=this.start();if(!c)return;const raw=this.raw,p=clone(this.s.pending);this.s.canRetryOriginal=false;try{if(await this.retained.read(this.key)!==raw||!this.active(c)||!this.connected())return;if(close&&!await this.retained.transition(this.key,raw,raw,undefined,c.signal))return;if(!this.active(c)||!this.connected())return;await this.resolve(c,raw,p,close);}catch{if(this.active(c))this.s.message='Recovery is unconfirmed. The exact original reading is preserved.';}finally{this.end(c);}}
 private async resolve(c:AbortController,raw:string,p:PlayoffPaperPreparedV1,close:boolean){
  const reply=close?await this.transport.close(p):await this.transport.inspect(p);if(!this.active(c))return;const proof=reply.error===null?(close?readPlayoffPaperClosureV1(reply.data,p):readPlayoffPaperRecoveryV1(reply.data,p)):null;
  if(!proof){this.s.message='No authoritative recovery outcome was established. The original reading remains saved.';return;}
  if(proof.status==='retry-original'){this.s.canRetryOriginal=true;this.s.savedWorkspace=clone(proof.currentWorkspace);this.s.message='The exact original reading is still current and unrecorded. It may be retried explicitly; this check did not send it.';return;}
  if(!this.connected()||await this.retained.read(this.key)!==raw||!this.active(c))return;const archive={id:`${this.key}:resolved:${p.operationId}`,raw:JSON.stringify({version:'native-mixed-playoff-paper-archive-v1',retainedRaw:raw,prepared:p,proof})};if(new TextEncoder().encode(archive.raw).byteLength>128000){this.s.message='Recovery proof exceeds the processing bound. The exact reading remains saved.';return;}
  if(!await this.retained.transition(this.key,raw,null,archive,c.signal)||!this.active(c))return;this.raw=null;this.s={...this.s,pending:null,attempted:false,rejection:null,canRetryOriginal:false,receipt:null,blocked:false,workspace:null,savedWorkspace:null,resolutionKey:p.operationId,message:'The original reading and its authoritative outcome were archived together. Refresh current evidence before a new entry.'};
 }
}
