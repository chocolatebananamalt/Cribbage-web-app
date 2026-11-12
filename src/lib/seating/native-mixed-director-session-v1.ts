import type {FinanceDraftRetainedPortV1} from '../finance/event-finance-draft-retained-v1.ts';
import {isNativeMixedSimulationOperationV1,readNativeMixedSimulationOperationV1,readNativeMixedSimulationProviderWriteV1,readNativeMixedSimulationReceiptV1} from './native-mixed-simulation-operation-v1.ts';
import type {NativeMixedSimulationOperationV1,NativeMixedSimulationReceiptV1,NativeMixedSimulationScopeV1} from './native-mixed-simulation-operation-v1.ts';
import {nativeMixedNextOperationMatchesV1,readNativeMixedDirectorTransitionV1} from './native-mixed-director-transition-v1.ts';
import {isNativeMixedSimulationCancellationRequestV1,readNativeMixedCancellationReceiptV1} from './native-mixed-cancellation-v1.ts';
import type {NativeMixedSimulationCancellationRequestV1,NativeMixedSimulationCancellationReceiptV1} from './native-mixed-cancellation-v1.ts';

/** Source-only device controller. No storage, HTTP, RPC or feature is enabled by import. */
export type NativeMixedDirectorContextV1={projectRef:string;scope:NativeMixedSimulationScopeV1;sessionId:string};
type Pending={kind:'native-mixed-director-pending-v1';projectRef:string;scope:NativeMixedSimulationScopeV1;operation:NativeMixedSimulationOperationV1};
export type NativeMixedDirectorSnapshotV1={status:'inactive'|'loading'|'ready'|'pending'|'blocked'|'resolved';operation:NativeMixedSimulationOperationV1|null;receipt:NativeMixedSimulationReceiptV1|NativeMixedSimulationCancellationReceiptV1|null;message:string;/** Display hint only, never current readiness or write authority. */nextActionHint?:'draw'|'review'|'publish'};
type Snapshot=NativeMixedDirectorSnapshotV1;
type Options={retained:FinanceDraftRetainedPortV1;currentContext:()=>NativeMixedDirectorContextV1|null;canRead?:()=>boolean;canWrite?:()=>boolean;execute?:(operation:NativeMixedSimulationOperationV1)=>Promise<unknown>;readOperation?:(operation:NativeMixedSimulationOperationV1)=>Promise<unknown>;readTransition?:(prior:NativeMixedSimulationOperationV1)=>Promise<unknown>;cancel?:(request:NativeMixedSimulationCancellationRequestV1)=>Promise<unknown>;readCancellation?:(operation:NativeMixedSimulationOperationV1)=>Promise<unknown>;now?:()=>number};
const uuid=/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const same=(a:unknown,b:unknown)=>JSON.stringify(a,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,value[key]])):value)===JSON.stringify(b,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,value[key]])):value);
const inactive:Snapshot={status:'inactive',operation:null,receipt:null,message:'Sign in again to check this rehearsal.'};
const recordedMessage=(receipt:NativeMixedSimulationReceiptV1,historical=false)=>receipt.action==='draw'&&receipt.status==='rejected'?'This draw did not produce seating. Its attempt is saved; do not draw again.':historical?'Recorded earlier. Current readiness still needs checking.':'Result recorded. Check its saved receipt before closing this step.';
const limit=131072;
function validContext(value:unknown):value is NativeMixedDirectorContextV1{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='projectRef,scope,sessionId')return false;
 const v=value as Record<string,unknown>,s=v.scope;
 return typeof v.projectRef==='string'&&/^[a-z0-9]{1,64}$/.test(v.projectRef)&&typeof v.sessionId==='string'&&v.sessionId.length>0&&v.sessionId.length<=256&&!!s&&typeof s==='object'&&!Array.isArray(s)&&Object.keys(s).sort().join(',')==='actorId,eventId,tournamentId'&&Object.values(s).every(id=>typeof id==='string'&&uuid.test(id));
}
export function nativeMixedDirectorPendingKeyV1(context:NativeMixedDirectorContextV1){
 if(!validContext(context))throw Error('invalid_director_context');
 const {actorId,tournamentId,eventId}=context.scope;
 return `native-mixed-director-operation-v1:${context.projectRef}:${actorId}:${tournamentId}:${eventId}`;
}
function parsePending(raw:string,context:NativeMixedDirectorContextV1):Pending|null{
 if(new TextEncoder().encode(raw).length>limit)return null;
 try{const p=JSON.parse(raw);return p&&Object.keys(p).sort().join(',')==='kind,operation,projectRef,scope'&&p.kind==='native-mixed-director-pending-v1'&&p.projectRef===context.projectRef&&same(p.scope,context.scope)&&isNativeMixedSimulationOperationV1(p.operation)?p:null;}catch{return null;}
}
function closedSnapshot(raw:string,context:NativeMixedDirectorContextV1):Snapshot|null{
 if(new TextEncoder().encode(raw).length>limit)return null;
 try{
  const c=JSON.parse(raw);if(!c||Object.keys(c).sort().join(',')!=='kind,pending,receipt'||c.kind!=='native-mixed-director-closed-v1')return null;
  const p=parsePending(JSON.stringify(c.pending),context);if(!p)return null;
  const bound={scope:context.scope,operation:p.operation},r=readNativeMixedSimulationReceiptV1(c.receipt,bound)??readNativeMixedCancellationReceiptV1(c.receipt,bound);
  if(!r||r.historicalReceipt!==true||r.currentSourceVerified!==false)return null;
  const next=r.kind==='native-mixed-simulation-receipt-v1'&&r.status==='accepted'?({plan:'draw',draw:'review',review:'publish'} as const)[p.operation.action as 'plan'|'draw'|'review']:undefined;
  return{status:'blocked',operation:null,receipt:null,message:next?'Step closed. The next step requires a fresh readiness check.':'Step closed. No further action is available for this attempt.',...(next?{nextActionHint:next}:{})};
 }catch{return null;}
}
export class NativeMixedDirectorSessionV1{
 private context:NativeMixedDirectorContextV1|null=null;
 private epoch=0;
 private busy=false;
 private raw:string|null=null;
 private state:Snapshot=inactive;
 private readonly options:Options;
 constructor(options:Options){this.options=options;}
 private current(epoch=this.epoch){try{const current=this.options.currentContext();return !!this.context&&epoch===this.epoch&&validContext(current)&&same(this.context,current)&&this.options.canRead?.()===true;}catch{return false;}}
 getSnapshot():Snapshot{return structuredClone(this.current()?this.state:inactive);}
 async activate(context:NativeMixedDirectorContextV1|null){
  const epoch=++this.epoch;this.busy=false;this.raw=null;this.state=inactive;this.context=context&&validContext(context)?structuredClone(context):null;
  if(!this.current(epoch))return;
  this.state={...inactive,status:'loading',message:'Checking saved work…'};
  try{const raw=await this.options.retained.read(nativeMixedDirectorPendingKeyV1(this.context!));if(!this.current(epoch))return;this.raw=raw;
   if(raw===null){this.state={...inactive,status:'ready',message:'Test rehearsal only. No real attendance or money is recorded.'};return;}
   const p=parsePending(raw,this.context!);this.state=p?{status:'pending',operation:p.operation,receipt:null,message:'A result may already be saved. Check it before continuing.'}:closedSnapshot(raw,this.context!)??{...inactive,status:'blocked',message:'Saved work could not be verified. It has been kept unchanged.'};
  }catch{if(this.current(epoch))this.state={...inactive,status:'blocked',message:'Saved work is unavailable. No new operation was sent by this check.'};}
 }
 async submit(operation:NativeMixedSimulationOperationV1){
  if(!this.current()||this.options.canWrite?.()!==true||this.busy||this.state.status!=='ready'||this.raw!==null||!isNativeMixedSimulationOperationV1(operation)||!this.options.execute)return false;
  const epoch=this.epoch,context=structuredClone(this.context!),frozen=structuredClone(operation),key=nativeMixedDirectorPendingKeyV1(context);
  const raw=JSON.stringify({kind:'native-mixed-director-pending-v1',projectRef:context.projectRef,scope:context.scope,operation:frozen});
  if(!parsePending(raw,context))return false;
  this.busy=true;
  try{
   if(!await this.options.retained.transition(key,null,raw)){if(this.current(epoch))this.state={...inactive,status:'blocked',message:'Other saved work exists. Reopen this rehearsal to check it.'};return false;}
   if(!this.current(epoch))return false;
   this.raw=raw;this.state={status:'pending',operation:frozen,receipt:null,message:'Result not yet known. Check the saved operation before doing anything else.'};
   return await this.dispatch(epoch,context,frozen,key,raw);
  }catch{return false;}finally{if(epoch===this.epoch)this.busy=false;}
 }
 private async dispatch(epoch:number,context:NativeMixedDirectorContextV1,operation:NativeMixedSimulationOperationV1,key:string,raw:string,fresh=()=>true){
  if(await this.options.retained.read(key)!==raw||!this.current(epoch)||this.options.canWrite?.()!==true||!this.options.execute||!fresh())return false;
  const result=await this.options.execute(structuredClone(operation));if(!this.current(epoch))return false;
  const write=readNativeMixedSimulationProviderWriteV1(result,{scope:context.scope,operation});
  if(write&&'kind'in write.outcome&&write.outcome.kind==='native-mixed-simulation-receipt-v1')this.state={...this.state,status:'resolved',receipt:write.outcome,message:recordedMessage(write.outcome)};
  return this.state.status==='resolved';
 }
 /** A closed marker is replaced only with the exact next request, never erased.
  * An injected server observation is required; the writer still rechecks sources. */
 async advance(next:NativeMixedSimulationOperationV1){
  if(!this.current()||this.options.canWrite?.()!==true||this.busy||this.state.status!=='blocked'||!this.raw||!this.options.readTransition||!this.options.execute||!isNativeMixedSimulationOperationV1(next))return false;
  const epoch=this.epoch,context=structuredClone(this.context!),oldRaw=this.raw,frozen=structuredClone(next),key=nativeMixedDirectorPendingKeyV1(context);this.busy=true;
  try{
   if(new TextEncoder().encode(oldRaw).length>limit)return false;
   const closed=JSON.parse(oldRaw);
   if(!closed||Object.keys(closed).sort().join(',')!=='kind,pending,receipt'||closed.kind!=='native-mixed-director-closed-v1')return false;
   const pending=parsePending(JSON.stringify(closed.pending),context);if(!pending)return false;
   // The fresh transition read includes independently validated historical
   // proof; local archived data alone is never used as current permission.
   const source=await this.options.readTransition(structuredClone(pending.operation));
   if(!this.current(epoch)||this.options.canWrite?.()!==true)return false;
   const proof=readNativeMixedDirectorTransitionV1(source,{scope:context.scope,prior:pending.operation,now:(this.options.now??Date.now)()});
   if(!proof||!same(proof.prior.receipt,closed.receipt)||!nativeMixedNextOperationMatchesV1(frozen,proof))return false;
   const raw=JSON.stringify({kind:'native-mixed-director-pending-v1',projectRef:context.projectRef,scope:context.scope,operation:frozen});if(!parsePending(raw,context))return false;
   if(!await this.options.retained.transition(key,oldRaw,raw))return false;
   if(!this.current(epoch))return false;
   this.raw=raw;this.state={status:'pending',operation:frozen,receipt:null,message:'Result not yet known. Check the saved operation before doing anything else.'};
   return await this.dispatch(epoch,context,frozen,key,raw,()=>!!readNativeMixedDirectorTransitionV1(proof,{scope:context.scope,prior:pending.operation,now:(this.options.now??Date.now)()}));
  }catch{return false;}finally{if(epoch===this.epoch)this.busy=false;}
 }
 /** Unknown outcomes are read only. There is deliberately no write-retry or redraw method. */
 async check(){
  if(!this.current()||this.busy||!this.raw||!this.state.operation||!this.options.readOperation)return false;
  const epoch=this.epoch,context=structuredClone(this.context!),operation=structuredClone(this.state.operation);this.busy=true;
  try{let result:unknown=null;try{result=await this.options.readOperation(structuredClone(operation));}catch{/* independent cancellation recovery may still be available */}if(!this.current(epoch))return false;
   const read=readNativeMixedSimulationOperationV1(result,{scope:context.scope,operationId:operation.operationId,operation});
   if(read){this.state={status:'resolved',operation,receipt:read.receipt,message:recordedMessage(read.receipt,true)};return true;}
   if(!this.options.readCancellation)return false;
   const cancelled=readNativeMixedCancellationReceiptV1(await this.options.readCancellation(structuredClone(operation)),{scope:context.scope,operation});
   if(!this.current(epoch)||!cancelled||cancelled.historicalReceipt!==true)return false;
   this.state={status:'resolved',operation,receipt:cancelled,message:'Cancellation recorded. No new draw is authorized.'};return true;
  }catch{return false;}finally{if(epoch===this.epoch)this.busy=false;}
 }
 /** Explicit cancellation is a separate durable journal write, never an
  * empty-lookup inference. Lost replies are resolved by read-only lookup. */
 async cancelPending(reason:string){
  if(!this.current()||this.options.canWrite?.()!==true||this.busy||this.state.status!=='pending'||!this.raw||!this.state.operation||!this.options.cancel||!this.options.readCancellation)return false;
  const epoch=this.epoch,context=structuredClone(this.context!),operation=structuredClone(this.state.operation),raw=this.raw;
  const request={kind:'native-mixed-simulation-cancellation-v1' as const,operationId:operation.operationId,action:operation.action,operationRequest:operation.request,reason};
  if(!isNativeMixedSimulationCancellationRequestV1(request))return false;
  this.busy=true;
  try{
   if(await this.options.retained.read(nativeMixedDirectorPendingKeyV1(context))!==raw||!this.current(epoch)||this.options.canWrite?.()!==true)return false;
   await this.options.cancel(structuredClone(request));
  }catch{/* A lost cancellation response is not proof of either outcome. */}
  finally{if(epoch===this.epoch)this.busy=false;}
  return this.current(epoch)?this.check():false;
 }
 /** Requires fresh historical proof. Keep a closed marker: reopening never authorizes a fresh draw. */
 async archiveResolved(){
  if(!await this.check()||!this.current()||this.busy||!this.raw||!this.state.operation||!this.state.receipt||!this.context)return false;
  const epoch=this.epoch,raw=this.raw,key=nativeMixedDirectorPendingKeyV1(this.context),receipt=structuredClone(this.state.receipt);this.busy=true;
  const closed=JSON.stringify({kind:'native-mixed-director-closed-v1',pending:JSON.parse(raw),receipt});
  try{if(!await this.options.retained.transition(key,raw,closed,{id:`${key}:${this.state.operation.operationId}`,raw:closed}))return false;
   if(!this.current(epoch))return false;
   this.raw=closed;this.state=closedSnapshot(closed,this.context!)??{status:'blocked',operation:null,receipt:null,message:'Receipt archived. A fresh source review is required before the next step.'};return true;
  }catch{return false;}finally{if(epoch===this.epoch)this.busy=false;}
 }
}
