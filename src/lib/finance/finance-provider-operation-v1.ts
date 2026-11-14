import type {FinanceDraftRetainedPortV1} from './event-finance-draft-retained-v1.ts';
import {prepareFinanceProviderSaveV1,type FinanceProviderScopeV1,type FinanceProviderUiWorkspaceV1} from './operational-finance-provider-ui-v1.ts';
import type {EventFinanceEditorV1} from './event-finance-workspace-v1.ts';
import {isRestorableEventFinanceEditorV1} from './event-finance-draft-codec-v1.ts';
export const financeProviderPendingBytesWithinLimitV1=(raw:string)=>new TextEncoder().encode(raw).byteLength<=4200000;
type Request=NonNullable<ReturnType<typeof prepareFinanceProviderSaveV1>>;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const canonical=(v:unknown)=>JSON.stringify(v,(_k,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const same=(a:unknown,b:unknown)=>canonical(a)===canonical(b);
const uuid=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
function requestValid(v:unknown,s:FinanceProviderScopeV1):v is Request{return object(v)&&Object.keys(v).length===7&&v.kind==='operational-event-finance-proposal-v1'&&uuid(v.operationId)&&Number.isSafeInteger(v.expectedVersion)&&Number(v.expectedVersion)>=0&&hash(v.expectedSourceDigest)&&hash(v.expectedBasisDigest)&&isRestorableEventFinanceEditorV1(v.editor)&&v.editor.basis.source.tournamentId===s.tournamentId&&v.editor.basis.source.eventId===s.eventId&&v.editor.basis.payoutSource.tournamentId===s.tournamentId&&v.editor.basis.payoutSource.eventId===s.eventId&&typeof v.reason==='string'&&!!v.reason.trim()&&v.reason.length<=2000;}
const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
export type FinanceProviderOperationPortV1={save:(request:Request)=>Promise<unknown>;reconcile:(operationId:string)=>Promise<unknown>};
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
type ReviewedHead={revisionId:string;version:number;sourceDigest:string;basisDigest:string};
type ReviewedHeadMarker={kind:'finance-provider-reviewed-head-v1';scope:FinanceProviderScopeV1;operationId:string;head:ReviewedHead;archiveId:string};
function isReviewedHeadMarker(value:unknown,scope:FinanceProviderScopeV1):value is ReviewedHeadMarker{return exact(value,['kind','scope','operationId','head','archiveId'])&&value.kind==='finance-provider-reviewed-head-v1'&&same(value.scope,scope)&&uuid(value.operationId)&&exact(value.head,['revisionId','version','sourceDigest','basisDigest'])&&uuid(value.head.revisionId)&&Number.isSafeInteger(value.head.version)&&Number(value.head.version)>=1&&Number(value.head.version)<=2147483647&&hash(value.head.sourceDigest)&&hash(value.head.basisDigest)&&value.archiveId===`finance-provider-receipt-v1:${scope.actorId}:${scope.tournamentId}:${scope.eventId}:${value.operationId}`;}
type Pending={kind:'finance-provider-pending-v1';scope:FinanceProviderScopeV1;request:Request};
/** Durable exact-operation host. Constructing it performs no IO. It grants no
 * authority: the provider must independently authenticate every request. */
export class FinanceProviderOperationV1 {
 private reviewedHead:Readonly<ReviewedHead>|null=null;private archiveInFlight=false;
 private raw:string|null=null;private pending:Pending|null=null;private epoch=0;private active=false;private initialized=false;private busy=false;private status:'inactive'|'checking'|'ready'|'outcome_unknown'|'accepted'|'rejected'|'blocked'='inactive';private receipt:unknown=null;private listeners=new Set<()=>void>();
 private scope:FinanceProviderScopeV1;private retained:FinanceDraftRetainedPortV1;private port:FinanceProviderOperationPortV1;
 private snapshot=this.build();
 constructor(scope:FinanceProviderScopeV1,retained:FinanceDraftRetainedPortV1,port:FinanceProviderOperationPortV1){if(!['actorId','tournamentId','eventId'].every(k=>Object.hasOwn(scope,k)&&uuid(scope[k as keyof FinanceProviderScopeV1]))||Object.keys(scope).length!==3)throw Error('invalid_provider_scope');this.scope=freeze(structuredClone(scope));this.retained=retained;this.port=port;}
 private key(){return `finance-provider-operation-v1:${this.scope.actorId}:${this.scope.tournamentId}:${this.scope.eventId}`;}
 private build(){return freeze({status:this.status,busy:this.busy,operationId:this.active&&this.initialized?this.pending?.request.operationId??null:null,receipt:this.active&&this.initialized&&this.bound(this.receipt)?structuredClone(this.receipt):null,moneyMoved:false as const,payoutAuthorized:false as const});}
 private publish(){this.snapshot=this.build();this.listeners.forEach(f=>f());}
 getSnapshot=()=>this.snapshot;subscribe=(f:()=>void)=>{this.listeners.add(f);return()=>{this.listeners.delete(f);};};
 matchesScope(scope:FinanceProviderScopeV1){return same(scope,this.scope);}
 /** Remounts must not discard the exact fresh-head requirement after archival. */
 requiresVerifiedWorkspace(workspace:FinanceProviderUiWorkspaceV1){const h=this.reviewedHead;return !!h&&(!same(workspace.scope,this.scope)||workspace.headRevisionId!==h.revisionId||workspace.version!==h.version||workspace.sourceDigest!==h.sourceDigest||workspace.basisDigest!==h.basisDigest);}
 setActive(active:boolean){if(active===this.active)return;this.active=active;this.epoch++;this.busy=false;this.initialized=false;this.receipt=null;this.status=active?'checking':'inactive';this.publish();}
 private valid(epoch:number){return this.active&&epoch===this.epoch;}
 async initialize(){
  if(!this.active||this.busy||this.archiveInFlight||this.initialized)return;
  const epoch=this.epoch;this.busy=true;this.publish();
  try{
   const raw=await this.retained.read(this.key());if(!this.valid(epoch))return;
   this.raw=raw;this.pending=null;this.receipt=null;
   if(raw!==null){
    if(!financeProviderPendingBytesWithinLimitV1(raw))throw Error('retained_too_large');
    const value:unknown=JSON.parse(raw);
    if(object(value)&&value.kind==='finance-provider-reviewed-head-v1'){
     if(!isReviewedHeadMarker(value,this.scope))throw Error('invalid_reviewed_head');
     if(this.reviewedHead&&(value.head.version<this.reviewedHead.version||(value.head.version===this.reviewedHead.version&&!same(value.head,this.reviewedHead))))throw Error('reviewed_head_conflict');
     // Device-only stale-save barrier, never server or payout authority.
     this.reviewedHead=freeze(structuredClone(value.head));this.status='ready';
    }else{
     if(!exact(value,['kind','scope','request'])||value.kind!=='finance-provider-pending-v1'||!same(value.scope,this.scope)||!requestValid(value.request,this.scope))throw Error('invalid_retained_operation');
     this.pending=value as Pending;this.status='outcome_unknown';
    }
   }else this.status='ready';
   this.initialized=true;
  }catch{if(this.valid(epoch))this.status='blocked';}
  finally{if(this.valid(epoch)){this.busy=false;this.publish();}}
 }
 async rediscover(){if(!this.active||this.busy||this.archiveInFlight)return;this.initialized=false;this.receipt=null;this.pending=null;this.status='checking';this.publish();await this.initialize();}
 private bound(value:unknown){const p=this.pending;if(!p||!object(value)||Object.keys(value).length!==7||value.kind!=='operational-finance-provider-write-v1'||value.actorId!==this.scope.actorId||value.tournamentId!==this.scope.tournamentId||value.eventId!==this.scope.eventId||value.operationId!==p.request.operationId||!same(value.request,p.request)||!object(value.outcome))return false;
  const outcome=value.outcome;if(!['accepted','rejected','retry_exact','unknown'].includes(outcome.status as string)||['moneyMoved','payoutAuthorized','disbursementAuthorized','finalizationAuthorized'].some(k=>outcome[k]===true))return false;
  if(outcome.status==='accepted'&&(outcome.code!=='operational_finance_proposal_saved'||outcome.version!==p.request.expectedVersion+1||outcome.sourceDigest!==p.request.expectedSourceDigest||outcome.basisDigest!==p.request.expectedBasisDigest||!uuid(outcome.revisionId)))return false;
  return true;
 }
 async save(workspace:FinanceProviderUiWorkspaceV1,editor:EventFinanceEditorV1,operationId:string,reason:string,expected:ReturnType<FinanceProviderOperationV1['getSnapshot']>){
  if(!this.active||!this.initialized||this.busy||this.archiveInFlight||this.pending||expected!==this.snapshot||!same(workspace.scope,this.scope)||this.requiresVerifiedWorkspace(workspace))return;
  const request=prepareFinanceProviderSaveV1(workspace,editor,operationId,reason);if(!request)return;
  const epoch=this.epoch,pending:Pending={kind:'finance-provider-pending-v1',scope:this.scope,request},raw=JSON.stringify(pending);if(!financeProviderPendingBytesWithinLimitV1(raw))return;this.busy=true;this.publish();
  try{if(!await this.retained.transition(this.key(),this.raw,raw))throw Error('retained_conflict');if(!this.valid(epoch))return;this.raw=raw;this.pending=pending;this.status='outcome_unknown';if(await this.retained.read(this.key())!==raw)throw Error('retained_readback_unknown');if(!this.valid(epoch))return;const reply=await this.port.save(structuredClone(request));if(!this.valid(epoch))return;this.apply(reply);}catch{if(this.valid(epoch))this.status=this.pending?'outcome_unknown':'blocked';}finally{if(this.valid(epoch)){this.busy=false;this.publish();}}
 }
 private apply(reply:unknown){if(!this.bound(reply)){this.status='outcome_unknown';return;}this.receipt=structuredClone(reply);const status=(reply as {outcome:{status:string}}).outcome.status;this.status=status==='accepted'?'accepted':status==='rejected'?'rejected':'outcome_unknown';}
 async check(expected:ReturnType<FinanceProviderOperationV1['getSnapshot']>){if(!this.active||!this.initialized||!this.pending||this.busy||this.archiveInFlight||expected!==this.snapshot)return;const epoch=this.epoch;this.busy=true;this.publish();try{const reply=await this.port.reconcile(this.pending.request.operationId);if(this.valid(epoch))this.apply(reply);}catch{if(this.valid(epoch))this.status='outcome_unknown';}finally{if(this.valid(epoch)){this.busy=false;this.publish();}}}
 async retryExact(expected:ReturnType<FinanceProviderOperationV1['getSnapshot']>){if(!this.active||!this.initialized||!this.pending||this.busy||this.archiveInFlight||expected!==this.snapshot||this.status!=='outcome_unknown')return;const epoch=this.epoch;this.busy=true;this.publish();try{if(await this.retained.read(this.key())!==this.raw)throw Error('retained_conflict');if(!this.valid(epoch))return;const reply=await this.port.save(structuredClone(this.pending.request));if(this.valid(epoch))this.apply(reply);}catch{if(this.valid(epoch))this.status='outcome_unknown';}finally{if(this.valid(epoch)){this.busy=false;this.publish();}}}
 /** Archive only after an accepted receipt AND an exact fresh head readback.
  * Source drift/superseding revisions remain retained for manual recovery. */
 async archiveAccepted(workspace:FinanceProviderUiWorkspaceV1,expected:ReturnType<FinanceProviderOperationV1['getSnapshot']>){
  if(!this.active||!this.initialized||this.busy||this.archiveInFlight||expected!==this.snapshot||this.status!=='accepted'||!this.pending||!this.bound(this.receipt)||!same(workspace.scope,this.scope)||!workspace.editable)return;
  const receipt=this.receipt as {outcome:{revisionId:string}},request=this.pending.request;
  if(workspace.headRevisionId!==receipt.outcome.revisionId||workspace.version!==request.expectedVersion+1||workspace.sourceDigest!==request.expectedSourceDigest||workspace.basisDigest!==request.expectedBasisDigest||!same(workspace.editor,request.editor))return;
  const head=freeze({revisionId:workspace.headRevisionId!,version:workspace.version,sourceDigest:workspace.sourceDigest,basisDigest:workspace.basisDigest});this.reviewedHead=head;this.archiveInFlight=true;
  const epoch=this.epoch,archive={id:`finance-provider-receipt-v1:${this.scope.actorId}:${this.scope.tournamentId}:${this.scope.eventId}:${request.operationId}`,raw:JSON.stringify({kind:'finance-provider-accepted-archive-v1',pending:this.pending,receipt:this.receipt})};this.busy=true;this.publish();
  const marker:ReviewedHeadMarker={kind:'finance-provider-reviewed-head-v1',scope:this.scope,operationId:request.operationId,head,archiveId:archive.id},next=JSON.stringify(marker);
  try{if(!await this.retained.transition(this.key(),this.raw,next,archive))throw Error('retained_conflict');if(this.valid(epoch)){this.raw=next;this.pending=null;this.status='ready';}return freeze({status:'archived' as const,operationId:request.operationId,head});}catch{if(this.valid(epoch))this.status='outcome_unknown';}finally{this.archiveInFlight=false;if(this.valid(epoch)){this.busy=false;this.publish();}else if(this.active&&!this.initialized)void this.initialize();}
 }
}
