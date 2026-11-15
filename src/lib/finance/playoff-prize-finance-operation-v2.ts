import {readPlayoffPrizeBrowserWorkspaceV2,preparePlayoffPrizeBrowserSaveV2,readPlayoffPrizeBrowserPreparedV2,readPlayoffPrizeBrowserReplyV2,type PlayoffPrizeBrowserScopeV2,type PlayoffPrizeBrowserWorkspaceV2,type PlayoffPrizeBrowserPreparedV2,type PlayoffPrizeBrowserOperationV2} from '../api/playoff-prize-proposal-browser-v2.ts';
import type {FinanceDraftRetainedPortV1} from './event-finance-draft-retained-v1.ts';
import type {PlayoffPrizeProposalV2} from '../results/playoff-prize-proposals-v2.ts';
export type PlayoffPrizeBrowserPortV2={workspace:()=>Promise<unknown>;save:(prepared:PlayoffPrizeBrowserPreparedV2)=>Promise<unknown>;recover:(prepared:PlayoffPrizeBrowserPreparedV2)=>Promise<unknown>};
export type PlayoffPrizeFinanceSnapshotV2={status:'idle'|'ready'|'pending'|'saved'|'rejected'|'blocked';busy:boolean;workspace:PlayoffPrizeBrowserWorkspaceV2|null;prepared:PlayoffPrizeBrowserPreparedV2|null;receipt:PlayoffPrizeBrowserOperationV2|null;message:string;resolvedRejection?:{operationId:string;code:string;reason:string;requestHash:string}};
const canonical=(v:unknown):string=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const same=(a:unknown,b:unknown)=>canonical(a)===canonical(b);
const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
/** Pending requests are retained before sending. Only a full saved receipt AND
 * matching fresh authenticated head may archive pending. Unknown work remains locked; confirmed rejected work is archived only by
 * explicit reasoned resolution after fresh authenticated recovery and readback; no new operation, correction or source adoption is automatic.
 * A controller is permanently bound to one actor/event. Construction does no IO. */
export class PlayoffPrizeFinanceOperationV2{
 private active=false;private generation=0;private abort=new AbortController();private listeners=new Set<()=>void>();private raw:string|null=null;
 private state:Readonly<PlayoffPrizeFinanceSnapshotV2>=freeze({status:'idle',busy:false,workspace:null,prepared:null,receipt:null,message:''});
 readonly scope:PlayoffPrizeBrowserScopeV2;readonly key:string;private retained:FinanceDraftRetainedPortV1;private port:PlayoffPrizeBrowserPortV2;
 constructor(scope:PlayoffPrizeBrowserScopeV2,retained:FinanceDraftRetainedPortV1,port:PlayoffPrizeBrowserPortV2){this.retained=retained;this.port=port;this.scope=freeze(structuredClone(scope));if(!Object.values(scope).every(x=>/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(x))||Object.keys(scope).length!==3)throw Error('invalid_scope');this.key=`prize-proposal-operation-v2:${scope.actorId}:${scope.tournamentId}:${scope.eventId}`;}
 subscribe=(f:()=>void)=>{this.listeners.add(f);return()=>{this.listeners.delete(f);};};
 getSnapshot=()=>this.state;
 matchesScope=(scope:PlayoffPrizeBrowserScopeV2)=>Object.keys(scope).length===3&&scope.actorId===this.scope.actorId&&scope.tournamentId===this.scope.tournamentId&&scope.eventId===this.scope.eventId;
 setActive=(active:boolean)=>{if(this.active===active)return;this.abort.abort();this.abort=new AbortController();this.active=active;this.generation++;if(active)this.publish({status:'idle',busy:false,workspace:null,prepared:null,receipt:null,message:''});};
 private publish(next:PlayoffPrizeFinanceSnapshotV2){this.state=freeze(structuredClone(next));for(const f of this.listeners)f();}
 private current(g:number){return this.active&&this.generation===g;}
 private async stillRetained(g:number){const expected=this.raw;if(expected===null)throw Error('pending_unavailable');const actual=await this.retained.read(this.key);if(!this.current(g))return false;if(actual!==expected)throw Error('pending_changed');return true;}
 async initialize(){if(!this.active||this.state.busy||this.state.status!=='idle')return;const g=this.generation;this.publish({...this.state,busy:true,message:'Checking this account and retained operation.'});try{
  const workspace=readPlayoffPrizeBrowserWorkspaceV2(await this.port.workspace(),this.scope);if(!this.current(g))return;if(!workspace)throw Error('workspace_unavailable');
  const raw=await this.retained.read(this.key);if(!this.current(g))return;this.raw=raw;
  let prepared:PlayoffPrizeBrowserPreparedV2|null=null;if(raw!==null){try{prepared=await readPlayoffPrizeBrowserPreparedV2(JSON.parse(raw),this.scope);}catch{/* Keep unrecognized bytes untouched. */}if(!this.current(g))return;if(!prepared){this.publish({status:'blocked',busy:false,workspace,prepared:null,receipt:null,message:'Retained operation cannot be verified. It is preserved; no request was sent.'});return;}}
  this.publish({status:prepared?'pending':'ready',busy:false,workspace,prepared,receipt:null,message:prepared?'An exact pending operation was restored. Check its outcome before any new save.':'Current proposal source loaded.'});
 }catch{if(this.current(g))this.publish({...this.state,status:'blocked',busy:false,message:'Account, source or device storage could not be verified. Existing work is unchanged.'});}}
 async save(workspace:PlayoffPrizeBrowserWorkspaceV2,proposal:PlayoffPrizeProposalV2,reason:string,mode:'append'|'adopt-current',operationId:string,expected=this.state){
  if(!this.active||expected!==this.state||this.state.status!=='ready'||this.state.busy||this.raw!==null||!same(workspace,this.state.workspace))return;
  const g=this.generation;this.publish({...this.state,busy:true,message:'Retaining the exact proposal before sending.'});
  try{const prepared=await preparePlayoffPrizeBrowserSaveV2(workspace,proposal,reason,mode,operationId);if(!this.current(g))return;if(!prepared)throw Error('invalid_proposal');const raw=JSON.stringify(prepared);const retained=await this.retained.transition(this.key,null,raw,undefined,this.abort.signal);if(!retained)throw Error('device_conflict');if(!this.current(g))return;this.raw=raw;
   this.publish({...this.state,status:'pending',busy:true,prepared,receipt:null,message:'Exact operation retained. Sending proposed amounts only.'});await this.receive(await this.port.save(prepared),prepared,g);
  }catch{if(this.current(g))this.publish({...this.state,status:this.raw===null?'blocked':'pending',busy:false,message:this.raw===null?'The proposal was not sent. Device retention or validation failed.':'Save outcome is unknown. The exact request remains retained; check its outcome.'});}
 }
 private async receive(raw:unknown,prepared:PlayoffPrizeBrowserPreparedV2,g:number){const reply=await readPlayoffPrizeBrowserReplyV2(raw,prepared);if(!this.current(g))return;
  if(reply?.kind==='playoff-prize-proposal-browser-operation-v2'){this.publish({...this.state,status:reply.result.status==='saved'?'saved':'rejected',busy:false,receipt:reply,message:reply.result.status==='saved'?'Proposal saved. Verify the current saved head before archiving pending.':'The server rejected this exact operation. Its request and proposed history remain retained.'});return;}
  this.publish({...this.state,status:'pending',busy:false,message:reply?.status==='retry_exact'?'The source was busy. Check or retry the exact retained request; no new operation was created.':'The outcome is not proven. The exact pending request is retained.'});
 }
 async recover(expected=this.state){if(!this.active||expected!==this.state||this.state.busy||!this.state.prepared||!['pending','saved','rejected'].includes(this.state.status))return;const g=this.generation,prepared=this.state.prepared;this.publish({...this.state,busy:true,message:'Checking the exact retained operation.'});try{if(!await this.stillRetained(g)||!this.current(g))return;await this.receive(await this.port.recover(prepared),prepared,g);}catch{if(this.current(g))this.publish({...this.state,busy:false,message:'Outcome check failed. The pending request is unchanged.'});}}
 async retryExact(expected=this.state){if(!this.active||expected!==this.state||this.state.status!=='pending'||this.state.busy||!this.state.prepared)return;const g=this.generation,prepared=this.state.prepared;this.publish({...this.state,busy:true,message:'Retrying only the exact retained request.'});try{if(!await this.stillRetained(g)||!this.current(g))return;await this.receive(await this.port.save(prepared),prepared,g);}catch{if(this.current(g))this.publish({...this.state,busy:false,message:'Retry outcome is unknown. The exact pending request remains retained.'});}}
 async verifyAndArchive(expected=this.state){if(!this.active||expected!==this.state||this.state.status!=='saved'||this.state.busy||!this.state.prepared||this.state.receipt?.result.status!=='saved'||this.raw===null)return;
  const g=this.generation,prepared=this.state.prepared,receipt=this.state.receipt,raw=this.raw;this.publish({...this.state,busy:true,message:'Verifying the saved head against a fresh account-bound source.'});
  try{const workspace=readPlayoffPrizeBrowserWorkspaceV2(await this.port.workspace(),this.scope);if(!this.current(g))return;if(!workspace||!same(workspace.head,receipt.result.status==='saved'?receipt.result.head:null))throw Error('head_changed');
   const archive={id:`prize-proposal-receipt-v2:${this.scope.actorId}:${this.scope.tournamentId}:${this.scope.eventId}:${prepared.request.operationId}`,raw:JSON.stringify({prepared,receipt})};
   const archived=await this.retained.transition(this.key,raw,null,archive,this.abort.signal);if(!archived)throw Error('archive_conflict');if(!this.current(g))return;this.raw=null;
   this.publish({status:'ready',busy:false,workspace,prepared:null,receipt:null,message:'Saved proposal verified and pending request archived. No award was approved or paid.'});
  }catch{if(this.current(g))this.publish({...this.state,busy:false,message:'Saved head or archive could not be verified. Pending is preserved; another save remains blocked.'});}
 }
 async resolveRejected(reason:string,confirmed:boolean,expected=this.state){
  if(!this.active||expected!==this.state||this.state.status!=='rejected'||this.state.busy||!this.state.prepared||this.state.receipt?.result.status!=='rejected'||this.raw===null||confirmed!==true||typeof reason!=='string'||!reason.trim()||reason.length>2000)return;
  const g=this.generation,prepared=this.state.prepared,receipt=this.state.receipt,raw=this.raw;
  this.publish({...this.state,busy:true,message:'Verifying the recorded rejection and current account before archiving.'});
  try{
   if(!await this.stillRetained(g)||!this.current(g))return;
   const verified=await readPlayoffPrizeBrowserReplyV2(await this.port.recover(prepared),prepared);
   if(!this.current(g))return;
   if(verified?.kind!=='playoff-prize-proposal-browser-operation-v2'||verified.result.status!=='rejected'||!same(verified,receipt))throw Error('rejection_unproven');
   const workspace=readPlayoffPrizeBrowserWorkspaceV2(await this.port.workspace(),this.scope);if(!this.current(g))return;if(!workspace)throw Error('workspace_unavailable');
   const archive={id:`prize-proposal-rejection-v2:${this.scope.actorId}:${this.scope.tournamentId}:${this.scope.eventId}:${prepared.request.operationId}`,raw:JSON.stringify({kind:'playoff-prize-rejection-archive-v2',scope:this.scope,retainedRaw:raw,prepared,receipt:verified,reviewedWorkspace:workspace,reason})};
   if(!await this.retained.transition(this.key,raw,null,archive,this.abort.signal))throw Error('archive_conflict');if(!this.current(g))return;this.raw=null;
   this.publish({status:'ready',busy:false,workspace,prepared:null,receipt:null,resolvedRejection:{operationId:prepared.request.operationId,code:verified.result.code,reason,requestHash:prepared.hash},message:'Confirmed rejection archived with its original request and reason. Review the current source before a new save. No rejected adjustments were applied to the saved head.'});
  }catch{if(this.current(g))this.publish({...this.state,busy:false,message:'Rejection, account or archive could not be verified. The pending request remains locked; nothing new was saved.'});}
 }

}
