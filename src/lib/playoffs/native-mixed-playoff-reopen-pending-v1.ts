import type{SeriesGameRetainedPortV1}from'./series-game-retained-v1.ts';
import{isPlayoffReopenTargetV1,isPlayoffReopenRequestV1,readPlayoffReopenWorkspaceV1,readPlayoffReopenReceiptV1,buildPlayoffReopenRequestV1,playoffCorrectionPlainV1 as plain,playoffCorrectionExactV1 as exact,playoffCorrectionSameV1 as same,playoffCorrectionUuidV1 as uuid,type PlayoffReopenTargetV1,type PlayoffReopenRequestV1,type PlayoffReopenWorkspaceV1,type PlayoffReopenReceiptV1}from'./native-mixed-playoff-reopen-v1.ts';
export type PlayoffReopenRuntimeV1={target:PlayoffReopenTargetV1;retained:SeriesGameRetainedPortV1;enabled:()=>boolean;online:()=>boolean;read:()=>Promise<unknown>;write:(op:string,r:PlayoffReopenRequestV1)=>Promise<unknown>;recover:(op:string,r:PlayoffReopenRequestV1)=>Promise<unknown>};
type Packet={version:'native-mixed-playoff-reopen-pending-v1';target:PlayoffReopenTargetV1;operationId:string;request:PlayoffReopenRequestV1};
type Snapshot={initialized:boolean;busy:boolean;blocked:boolean;pending:Packet|null;workspace:PlayoffReopenWorkspaceV1|null;receipt:PlayoffReopenReceiptV1|null;message:string};
export function playoffReopenPendingKeyV1(t:PlayoffReopenTargetV1){if(!isPlayoffReopenTargetV1(t))throw Error('invalid_target');return`native-mixed-playoff-reopen-v1:${t.projectRef}:${encodeURIComponent(t.projectUrl)}:${t.actorId}:${t.tournamentId}:${t.eventId}`;}
/** One retained operation per actor/event, finding old session/match work.
 * Exact CAS archive+clear requires a durable full receipt, never a bare error.
 * No automatic dispatch, redraw, evidence replacement or winner selection. */
export class PlayoffReopenPendingV1{
 private s:Snapshot={initialized:false,busy:false,blocked:false,pending:null,workspace:null,receipt:null,message:''};private raw:string|null=null;private disposed=false;private flight:AbortController|null=null;private t:PlayoffReopenTargetV1;private key:string;
 private o:PlayoffReopenRuntimeV1;
 constructor(o:PlayoffReopenRuntimeV1){if(!isPlayoffReopenTargetV1(o.target))throw Error('invalid_target');this.o={...o};this.t=structuredClone(o.target);this.key=playoffReopenPendingKeyV1(this.t);}
 getSnapshot(){return structuredClone(this.s);}
 dispose(){this.disposed=true;this.flight?.abort();this.s={...this.s,pending:null,workspace:null,receipt:null,blocked:true};}
 private on(){try{return!this.disposed&&this.o.enabled()===true;}catch{return false;}}
 private online(){try{return this.o.online()===true;}catch{return false;}}
 private active(c:AbortController){return this.on()&&this.flight===c&&!c.signal.aborted;}
 private start(){if(!this.on()||this.s.busy)return null;const c=new AbortController();this.flight=c;this.s.busy=true;return c;}
 private end(c:AbortController){if(this.flight===c){this.flight=null;this.s.busy=false;}}
 private packet(raw:string):Packet|null{try{if(new TextEncoder().encode(raw).byteLength>16000)return null;const v:unknown=JSON.parse(raw);if(!plain(v)||!exact(v,['version','target','operationId','request'])||v.version!=='native-mixed-playoff-reopen-pending-v1'||!isPlayoffReopenTargetV1(v.target)||!same(v.target,this.t)||!uuid(v.operationId)||!isPlayoffReopenRequestV1(v.request)||v.request.contextId!==this.t.contextId||v.request.slot!==this.t.slot||v.request.gameNumber!==this.t.gameNumber)return null;return structuredClone(v)as Packet;}catch{return null;}}
 async initialize(){const c=this.start();if(!c)return;try{const raw=await this.o.retained.read(this.key);if(!this.active(c))return;this.raw=raw;this.s.initialized=true;this.s.pending=raw===null?null:this.packet(raw);this.s.blocked=raw!==null&&!this.s.pending;this.s.message=raw===null?'':this.s.pending?'An exact correction is saved. Check its outcome or explicitly retry it.':'Older or unrecognized work is preserved. It cannot be replaced.';}catch{if(this.active(c)){this.s.initialized=true;this.s.blocked=true;this.s.message='Recovery storage is unavailable. Nothing can be sent.';}}finally{this.end(c);}}
 async refresh(){const c=this.start();if(!c||!this.online())return this.endIf(c);try{const value=await this.o.read();if(this.active(c))this.s.workspace=readPlayoffReopenWorkspaceV1(value,this.t);}catch{if(this.active(c))this.s.workspace=null;}finally{this.end(c);}}
 private endIf(c:AbortController|null){if(c)this.end(c);}
 async stage(operationId:string,reason:string){if(!this.s.initialized||this.s.blocked||this.raw!==null||!uuid(operationId)||!this.s.workspace)return false;const request=buildPlayoffReopenRequestV1(this.s.workspace,reason);if(!request)return false;const p:Packet={version:'native-mixed-playoff-reopen-pending-v1',target:structuredClone(this.t),operationId,request},raw=JSON.stringify(p),c=this.start();if(!c)return false;
  try{if(!await this.o.retained.transition(this.key,null,raw,undefined,c.signal)||!this.active(c)||await this.o.retained.read(this.key)!==raw){if(this.active(c))this.s.blocked=true;return false;}if(!this.active(c))return false;this.raw=raw;this.s.pending=p;this.s.message='Exact correction saved locally. Not sent.';return true;}catch{if(this.active(c))this.s.blocked=true;return false;}finally{this.end(c);}}
 async submitExact(){return this.act(true);}
 async checkOutcome(){return this.act(false);}
 private async act(write:boolean){if(!this.s.initialized||this.s.blocked||!this.raw||!this.s.pending||!this.online())return;const c=this.start();if(!c)return;const raw=this.raw,p=structuredClone(this.s.pending);
  try{if(await this.o.retained.read(this.key)!==raw||!this.active(c))return;if(write&&!await this.o.retained.transition(this.key,raw,raw,undefined,c.signal))return;if(!this.active(c)||!this.online()||await this.o.retained.read(this.key)!==raw)return;
   const value=await(write?this.o.write(p.operationId,p.request):this.o.recover(p.operationId,p.request));if(!this.active(c))return;const receipt=readPlayoffReopenReceiptV1(value,this.t,p.operationId,p.request);
   if(!receipt){this.s.message='Outcome is unconfirmed. The exact saved correction remains; do not replace it.';return;}this.s.receipt=receipt;
   if(!this.online()||await this.o.retained.read(this.key)!==raw||!this.active(c))return;const archive={id:`${this.key}:receipt:${p.operationId}`,raw:JSON.stringify({version:'native-mixed-playoff-reopen-archive-v1',retainedRaw:raw,receipt})};
   if(!await this.o.retained.transition(this.key,raw,null,archive,c.signal)||!this.active(c))return;this.raw=null;this.s.pending=null;this.s.workspace=null;this.s.message=receipt.status==='accepted'?'Game reopened. Original evidence is retained. Both sides must submit fresh independent evidence; no winner was selected. Refresh before continuing.':`Correction was not applied (${receipt.code}). The original request and receipt are archived; refresh before reviewing again.`;
  }catch{if(this.active(c))this.s.message='The outcome could not be confirmed. Exact saved bytes are preserved.';}finally{this.end(c);}}
}
