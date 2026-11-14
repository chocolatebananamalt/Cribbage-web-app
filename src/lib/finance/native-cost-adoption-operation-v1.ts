import type {FinanceDraftRetainedPortV1} from './event-finance-draft-retained-v1.ts';
import type {FinanceProviderScopeV1,FinanceProviderUiWorkspaceV1} from './operational-finance-provider-ui-v1.ts';
import {isNativeCostAdoptionRequestV1,type NativeCostAdoptionRequestV1} from './native-cost-adoption-plan-v1.ts';
export const nativeCostPendingBytesWithinLimitV1=(raw:string)=>new TextEncoder().encode(raw).byteLength<=4200000;
type Request=NativeCostAdoptionRequestV1;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const canonical=(v:unknown)=>JSON.stringify(v,(_k,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const same=(a:unknown,b:unknown)=>canonical(a)===canonical(b);
const uuid=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
function requestValid(v:unknown,s:FinanceProviderScopeV1):v is Request{return isNativeCostAdoptionRequestV1(v)&&v.editor.basis.source.tournamentId===s.tournamentId&&v.editor.basis.source.eventId===s.eventId&&v.editor.basis.payoutSource.tournamentId===s.tournamentId&&v.editor.basis.payoutSource.eventId===s.eventId;}

const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
export type NativeCostAdoptionOperationPortV1={save:(request:Request)=>Promise<unknown>;reconcile:(operationId:string)=>Promise<unknown>};
type Pending={kind:'native-cost-adoption-pending-v1';scope:FinanceProviderScopeV1;request:Request};
/** Durable exact-operation host. Constructing it performs no IO. It grants no
 * authority: the provider must independently authenticate every request. */
export class NativeCostAdoptionOperationV1 {
 private raw:string|null=null;private pending:Pending|null=null;private epoch=0;private active=false;private initialized=false;private busy=false;private status:'inactive'|'checking'|'ready'|'outcome_unknown'|'accepted'|'rejected'|'blocked'='inactive';private receipt:unknown=null;private listeners=new Set<()=>void>();
 private scope:FinanceProviderScopeV1;private retained:FinanceDraftRetainedPortV1;private port:NativeCostAdoptionOperationPortV1;
 private snapshot=this.build();
 constructor(scope:FinanceProviderScopeV1,retained:FinanceDraftRetainedPortV1,port:NativeCostAdoptionOperationPortV1){if(!['actorId','tournamentId','eventId'].every(k=>Object.hasOwn(scope,k)&&uuid(scope[k as keyof FinanceProviderScopeV1]))||Object.keys(scope).length!==3)throw Error('invalid_provider_scope');this.scope=freeze(structuredClone(scope));this.retained=retained;this.port=port;}
 private key(){return `native-cost-adoption-operation-v1:${this.scope.actorId}:${this.scope.tournamentId}:${this.scope.eventId}`;}
 private build(){return freeze({status:this.status,busy:this.busy,operationId:this.active&&this.initialized?this.pending?.request.operationId??null:null,receipt:this.active&&this.initialized&&this.bound(this.receipt)?structuredClone(this.receipt):null,moneyMoved:false as const,payoutAuthorized:false as const});}
 private publish(){this.snapshot=this.build();this.listeners.forEach(f=>f());}
 getSnapshot=()=>this.snapshot;subscribe=(f:()=>void)=>{this.listeners.add(f);return()=>{this.listeners.delete(f);};};
 matchesScope(scope:FinanceProviderScopeV1){return same(scope,this.scope);}
 setActive(active:boolean){if(active===this.active)return;this.active=active;this.epoch++;this.busy=false;this.initialized=false;this.receipt=null;this.status=active?'checking':'inactive';this.publish();}
 private valid(epoch:number){return this.active&&epoch===this.epoch;}
 async initialize(){if(!this.active||this.busy||this.initialized)return;const epoch=this.epoch;this.busy=true;this.publish();try{const raw=await this.retained.read(this.key());if(!this.valid(epoch))return;this.raw=raw;this.pending=null;this.receipt=null;if(raw!==null){if(!nativeCostPendingBytesWithinLimitV1(raw))throw Error('retained_too_large');const p=JSON.parse(raw);if(!object(p)||Object.keys(p).length!==3||p.kind!=='native-cost-adoption-pending-v1'||!same(p.scope,this.scope)||!requestValid(p.request,this.scope))throw Error('invalid_retained_operation');this.pending=p as Pending;this.status='outcome_unknown';}else{this.pending=null;this.status='ready';}this.initialized=true;}catch{if(this.valid(epoch))this.status='blocked';}finally{if(this.valid(epoch)){this.busy=false;this.publish();}}}
 async rediscover(){if(!this.active||this.busy)return;this.initialized=false;this.receipt=null;this.pending=null;this.status='checking';this.publish();await this.initialize();}
 private bound(value:unknown){const p=this.pending;if(!p||!object(value)||Object.keys(value).length!==7||value.kind!=='operational-finance-source-adoption-provider-write-v1'||value.actorId!==this.scope.actorId||value.tournamentId!==this.scope.tournamentId||value.eventId!==this.scope.eventId||value.operationId!==p.request.operationId||!same(value.request,p.request)||!object(value.outcome))return false;
  const outcome=value.outcome;if(outcome.status!=='retry_exact'&&outcome.status!=='unknown'&&(outcome.actorId!==this.scope.actorId||outcome.tournamentId!==this.scope.tournamentId||outcome.eventId!==this.scope.eventId||outcome.operationId!==p.request.operationId||!same(outcome.request,p.request)||!hash(outcome.fullRequestHash)||outcome.proposalOnly!==true||outcome.moneyMoved!==false||outcome.payoutAuthorized!==false||outcome.finalizationAuthorized!==false))return false;if(!['accepted','rejected','retry_exact','unknown'].includes(outcome.status as string)||['moneyMoved','payoutAuthorized','disbursementAuthorized','finalizationAuthorized'].some(k=>outcome[k]===true))return false;
  if(outcome.status==='accepted'&&(outcome.code!=='operational_finance_source_adopted'||outcome.version!==p.request.expectedVersion+1||outcome.priorRevisionId!==p.request.expectedPriorRevisionId||!hash(outcome.mappingDigest)||!hash(outcome.fullRequestHash)||outcome.sourceDigest!==p.request.expectedCurrentSourceDigest||outcome.basisDigest!==p.request.expectedCurrentBasisDigest||!uuid(outcome.revisionId)||!uuid(outcome.adoptionId)||outcome.proposalOnly!==true||outcome.moneyMoved!==false||outcome.payoutAuthorized!==false||outcome.finalizationAuthorized!==false||outcome.disbursementAuthorized!==false||typeof outcome.historicalReceipt!=='boolean'||typeof outcome.currentSourceVerified!=='boolean'||outcome.historicalReceipt===outcome.currentSourceVerified))return false;
  return true;
 }
 async save(request:Request,expected:ReturnType<NativeCostAdoptionOperationV1['getSnapshot']>){
  if(!this.active||!this.initialized||this.busy||this.pending||expected!==this.snapshot||!requestValid(request,this.scope))return;
  const epoch=this.epoch,pending:Pending={kind:'native-cost-adoption-pending-v1',scope:this.scope,request:structuredClone(request)},raw=JSON.stringify(pending);if(!nativeCostPendingBytesWithinLimitV1(raw))return;this.busy=true;this.publish();
  try{if(!await this.retained.transition(this.key(),this.raw,raw))throw Error('retained_conflict');if(!this.valid(epoch))return;this.raw=raw;this.pending=pending;this.status='outcome_unknown';if(await this.retained.read(this.key())!==raw)throw Error('retained_readback_unknown');if(!this.valid(epoch))return;const reply=await this.port.save(structuredClone(pending.request));if(!this.valid(epoch))return;this.apply(reply);}catch{if(this.valid(epoch))this.status=this.pending?'outcome_unknown':'blocked';}finally{if(this.valid(epoch)){this.busy=false;this.publish();}}
 }
 private apply(reply:unknown){if(!this.bound(reply)){this.status='outcome_unknown';return;}this.receipt=structuredClone(reply);const status=(reply as {outcome:{status:string}}).outcome.status;this.status=status==='accepted'?'accepted':status==='rejected'?'rejected':'outcome_unknown';}
 async check(expected:ReturnType<NativeCostAdoptionOperationV1['getSnapshot']>){if(!this.active||!this.initialized||!this.pending||this.busy||expected!==this.snapshot)return;const epoch=this.epoch;this.busy=true;this.publish();try{const reply=await this.port.reconcile(this.pending.request.operationId);if(this.valid(epoch))this.apply(reply);}catch{if(this.valid(epoch))this.status='outcome_unknown';}finally{if(this.valid(epoch)){this.busy=false;this.publish();}}}
 async retryExact(expected:ReturnType<NativeCostAdoptionOperationV1['getSnapshot']>){if(!this.active||!this.initialized||!this.pending||this.busy||expected!==this.snapshot||this.status!=='outcome_unknown')return;const epoch=this.epoch;this.busy=true;this.publish();try{if(await this.retained.read(this.key())!==this.raw)throw Error('retained_conflict');if(!this.valid(epoch))return;const reply=await this.port.save(structuredClone(this.pending.request));if(this.valid(epoch))this.apply(reply);}catch{if(this.valid(epoch))this.status='outcome_unknown';}finally{if(this.valid(epoch)){this.busy=false;this.publish();}}}
 /** Archive only after an accepted receipt AND an exact fresh head readback.
  * Source drift/superseding revisions remain retained for manual recovery. */
 async archiveAccepted(workspace:FinanceProviderUiWorkspaceV1,expected:ReturnType<NativeCostAdoptionOperationV1['getSnapshot']>){
  if(!this.active||!this.initialized||this.busy||expected!==this.snapshot||this.status!=='accepted'||!this.pending||!this.bound(this.receipt)||!same(workspace.scope,this.scope)||!workspace.editable)return;
  const receipt=this.receipt as {outcome:{revisionId:string}},request=this.pending.request;
  if(workspace.headRevisionId!==receipt.outcome.revisionId||workspace.version!==request.expectedVersion+1||workspace.sourceDigest!==request.expectedCurrentSourceDigest||workspace.basisDigest!==request.expectedCurrentBasisDigest||!same(workspace.editor,request.editor))return;
  const epoch=this.epoch,archive={id:`native-cost-adoption-receipt-v1:${this.scope.actorId}:${this.scope.tournamentId}:${this.scope.eventId}:${request.operationId}`,raw:JSON.stringify({kind:'native-cost-adoption-accepted-archive-v1',pending:this.pending,receipt:this.receipt})};this.busy=true;this.publish();
  try{if(!await this.retained.transition(this.key(),this.raw,null,archive))throw Error('retained_conflict');if(!this.valid(epoch))return;this.raw=null;this.pending=null;this.status='ready';}catch{if(this.valid(epoch))this.status='outcome_unknown';}finally{if(this.valid(epoch)){this.busy=false;this.publish();}}
 }
 /** Explicit local archival of a bound terminal rejection only. The review
  * draft is separate and remains intact; unknown outcomes cannot be cleared. */
 async archiveRejected(expected:ReturnType<NativeCostAdoptionOperationV1['getSnapshot']>){
  if(!this.active||!this.initialized||this.busy||expected!==this.snapshot||this.status!=='rejected'||!this.pending||!this.bound(this.receipt))return;
  const epoch=this.epoch,request=this.pending.request,archive={id:`native-cost-adoption-rejected-v1:${this.scope.actorId}:${this.scope.tournamentId}:${this.scope.eventId}:${request.operationId}`,raw:JSON.stringify({kind:'native-cost-adoption-rejected-archive-v1',pending:this.pending,receipt:this.receipt})};this.busy=true;this.publish();
  try{if(!await this.retained.transition(this.key(),this.raw,null,archive))throw Error('retained_conflict');if(!this.valid(epoch))return;this.raw=null;this.pending=null;this.status='ready';}catch{if(this.valid(epoch))this.status='outcome_unknown';}finally{if(this.valid(epoch)){this.busy=false;this.publish();}}
 }
}
