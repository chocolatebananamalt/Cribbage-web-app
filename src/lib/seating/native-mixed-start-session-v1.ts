import type {FinanceDraftRetainedPortV1} from '../finance/event-finance-draft-retained-v1.ts';
import type {NativeMixedDirectorContextV1} from './native-mixed-director-session-v1.ts';
import {nativeMixedDirectorPendingKeyV1} from './native-mixed-director-session-v1.ts';
import {readNativeMixedBootstrapStatusV1} from './native-mixed-bootstrap-status-v1.ts';
import {readNativeMixedSimulationScheduleSourceV1} from './native-mixed-simulation-operation-v1.ts';
import {isNativeMixedSimulationStartRequestV1,readNativeMixedSimulationStartOutcomeV1,readNativeMixedSimulationStartReceiptV1,readNativeMixedSimulationStartedSourceV1,type NativeMixedSimulationStartRequestV1,type NativeMixedSimulationStartReceiptV1} from './native-mixed-simulation-start-v1.ts';

type Phase='not_sent'|'attempted'|'retryable';
type Pending={kind:'native-mixed-start-pending-v1';projectRef:string;scope:NativeMixedDirectorContextV1['scope'];request:NativeMixedSimulationStartRequestV1;phase:Phase};
type Closed={kind:'native-mixed-start-closed-v1';pending:Pending;receipt:NativeMixedSimulationStartReceiptV1};
export type NativeMixedStartSnapshotV1={status:'inactive'|'loading'|'ready'|'pending'|'blocked'|'resolved';request:NativeMixedSimulationStartRequestV1|null;phase:Phase|null;receipt:NativeMixedSimulationStartReceiptV1|null;currentStarted:boolean;message:string};
type Options={retained:FinanceDraftRetainedPortV1;currentContext:()=>NativeMixedDirectorContextV1|null;canRead:()=>boolean;canWrite:()=>boolean;readiness:()=>Promise<unknown>;source:()=>Promise<unknown>;execute:(request:NativeMixedSimulationStartRequestV1)=>Promise<unknown>;operation:(request:NativeMixedSimulationStartRequestV1)=>Promise<unknown>;started:(request:NativeMixedSimulationStartRequestV1,startId:string)=>Promise<unknown>;makeId:()=>string;now?:()=>number};
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const inactive:NativeMixedStartSnapshotV1={status:'inactive',request:null,phase:null,receipt:null,currentStarted:false,message:'Start controls are unavailable.'};
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
export function nativeMixedStartPendingKeyV1(c:NativeMixedDirectorContextV1){nativeMixedDirectorPendingKeyV1(c);if(c.projectRef!=='nnhcnvksxgxnpvdqjgpg')throw Error('unsupported_pilot_target');return `native-mixed-start-v1:${c.projectRef}:${c.scope.actorId}:${c.scope.tournamentId}:${c.scope.eventId}`;}
function pending(v:unknown,c:NativeMixedDirectorContextV1):Pending|null{
 return exact(v,['kind','projectRef','scope','request','phase'])&&v.kind==='native-mixed-start-pending-v1'&&v.projectRef===c.projectRef&&same(v.scope,c.scope)&&isNativeMixedSimulationStartRequestV1(v.request)&&['not_sent','attempted','retryable'].includes(String(v.phase))?structuredClone(v)as Pending:null;
}
/** One retained request per actor/event. Import never opens storage or enables access. */
export class NativeMixedStartSessionV1{
 private context:NativeMixedDirectorContextV1|null=null;private epoch=0;private busy=false;private raw:string|null=null;private preparedAt=0;private verifiedAt=0;private state=structuredClone(inactive);
 private readonly d:Options;
 constructor(d:Options){this.d=d;}
 private current(n=this.epoch){try{return !!this.context&&n===this.epoch&&this.d.canRead()&&same(this.context,this.d.currentContext());}catch{return false;}}
 getSnapshot(){if(!this.current())return structuredClone(inactive);const now=(this.d.now??Date.now)(),age=now-this.preparedAt,verifiedAge=now-this.verifiedAt;if(this.state.currentStarted&&(verifiedAge<0||verifiedAge>30000))return structuredClone({...this.state,currentStarted:false,message:'Start was saved. Check its current readiness again.'});return structuredClone(this.state.status==='ready'&&this.state.request&&(age<0||age>30000)?{...this.state,request:null,message:'Start readiness has expired. Check it again.'}:this.state);}
 async activate(input:NativeMixedDirectorContextV1|null){const n=++this.epoch;this.context=input?structuredClone(input):null;this.raw=null;this.state=structuredClone(inactive);if(!input)return false;
  try{const key=nativeMixedStartPendingKeyV1(input);if(!this.current(n))return false;this.state={...inactive,status:'loading',message:'Checking saved Start.'};const raw=await this.d.retained.read(key);if(!this.current(n))return false;this.raw=raw;
   if(raw===null){this.state={...inactive,status:'ready',message:'Check current rehearsal readiness before starting.'};return true;}
   if(new TextEncoder().encode(raw).length>32768)throw Error('invalid_retained_start');const value=JSON.parse(raw),p=pending(value,input);
   if(p){this.state={...inactive,status:'pending',request:p.request,phase:p.phase,message:'A saved Start request needs checking. Do not create another.'};return true;}
   if(exact(value,['kind','pending','receipt'])&&value.kind==='native-mixed-start-closed-v1'){const p=pending(value.pending,input);const r=p&&readNativeMixedSimulationStartReceiptV1(value.receipt,{scope:input.scope,request:p.request,historicalOnly:true});if(r){this.state={...inactive,status:'resolved',request:p!.request,receipt:r,message:'Start was saved. Check current readiness before relying on it.'};return true;}}
   throw Error('unrecognized_retained_start');
  }catch{if(this.current(n))this.state={...inactive,status:'blocked',message:'Saved Start could not be read safely. It is preserved.'};return false;}
 }
 async prepare(){if(this.busy||!this.current()||!this.context||this.raw!==null||this.state.status!=='ready'||!this.d.canWrite())return false;this.busy=true;this.state={...inactive,status:'ready',message:'Checking current test readiness.'};const n=this.epoch;
  try{const observed=readNativeMixedBootstrapStatusV1(await this.d.readiness(),this.context.scope,(this.d.now??Date.now)());if(!this.current(n)||!observed)return false;if(observed.simulationStarted){this.state={...inactive,status:'blocked',message:'A simulated Start is already saved for this event. Do not create another; use the original saved request to check it.'};return false;}if(!observed.currentReadinessVerified)return false;
   const source=readNativeMixedSimulationScheduleSourceV1(await this.d.source(),this.context.scope);if(!this.current(n)||!source||!this.d.canWrite())return false;
   const request:NativeMixedSimulationStartRequestV1={kind:'native-mixed-simulation-start-v1',operationId:this.d.makeId(),expectedContextId:(source.publication as {contextId:string}).contextId,expectedScheduleSourceDigest:source.sourceDigest,expectedAttendanceSourceDigest:(source.attendance as {sourceDigest:string}).sourceDigest,statement:'fictional-test-only-no-ordinary-attendance-v1',reason:'Director explicitly starts test rehearsal; no ordinary attendance or real funds claimed'};if(!isNativeMixedSimulationStartRequestV1(request))return false;
   this.preparedAt=(this.d.now??Date.now)();this.state={...inactive,status:'ready',request, message:'Current test seating and 108 games are ready for simulated Start.'};return true;
  }catch{return false;}finally{this.busy=false;}
 }
 async submit(confirmed:boolean){if(!confirmed||this.busy||!this.current()||!this.context||!this.d.canWrite()||this.raw!==null||this.state.status!=='ready'||!this.state.request||((this.d.now??Date.now)()-this.preparedAt)>30000||((this.d.now??Date.now)()-this.preparedAt)<0)return false;
  this.busy=true;const n=this.epoch,c=structuredClone(this.context),p:Pending={kind:'native-mixed-start-pending-v1',projectRef:c.projectRef,scope:c.scope,request:structuredClone(this.state.request),phase:'not_sent'},raw=JSON.stringify(p),key=nativeMixedStartPendingKeyV1(c);
  try{if(!await this.d.retained.transition(key,null,raw)||!this.current(n))return false;this.raw=raw;this.state={...inactive,status:'pending',request:p.request,phase:'not_sent',message:'Start is saved on this device; it has not been sent.'};return await this.send(n,c,p,key,raw);}catch{return false;}finally{this.busy=false;}
 }
 async retryExact(){if(this.busy||!this.current()||!this.context||!this.raw||!this.d.canWrite()||this.state.status!=='pending'||!['not_sent','retryable'].includes(this.state.phase??''))return false;const n=this.epoch,c=structuredClone(this.context),raw=this.raw;this.busy=true;try{const p=pending(JSON.parse(raw),c);return p?await this.send(n,c,p,nativeMixedStartPendingKeyV1(c),raw):false;}catch{return false;}finally{this.busy=false;}}
 private async send(n:number,c:NativeMixedDirectorContextV1,p:Pending,key:string,raw:string){
  if(!this.current(n)||!this.d.canWrite()||await this.d.retained.read(key)!==raw)return false;
  const attempt={...p,phase:'attempted' as const},next=JSON.stringify(attempt);if(!await this.d.retained.transition(key,raw,next)||!this.current(n))return false;this.raw=next;this.state={...inactive,status:'pending',request:p.request,phase:'attempted',message:'Start result is not yet known. Check Saved Start before doing anything else.'};
  if(!this.d.canWrite())return false;const value=await this.d.execute(structuredClone(p.request));if(!this.current(n))return false;const result=readNativeMixedSimulationStartOutcomeV1(value,{scope:c.scope,request:p.request});
  if(result?.status==='accepted')return this.close(n,c,attempt,next,result);
  if(result?.status==='retry_exact'){const retry=JSON.stringify({...attempt,phase:'retryable'});if(await this.d.retained.transition(key,next,retry)&&this.current(n)){this.raw=retry;this.state={...this.state,phase:'retryable',message:'The source was busy. You may retry this same saved request.'};}}
  else if(result?.status==='rejected'||result?.status==='blocked')this.state={...this.state,status:'blocked',message:'Start was not accepted. The exact request is preserved for review; do not replace it.'};
  return false;
 }
 private async close(n:number,c:NativeMixedDirectorContextV1,p:Pending,raw:string,r:NativeMixedSimulationStartReceiptV1){const historical={...r,historicalReceipt:true,currentSourceVerified:false},closed:Closed={kind:'native-mixed-start-closed-v1',pending:p,receipt:historical};const next=JSON.stringify(closed);if(!await this.d.retained.transition(nativeMixedStartPendingKeyV1(c),raw,next,{id:nativeMixedStartPendingKeyV1(c)+':'+p.request.operationId,raw:next})||!this.current(n))return false;this.raw=next;this.state={...inactive,status:'resolved',request:p.request,receipt:historical,message:'Simulated Start is saved. This is not ordinary attendance or a real-money event.'};return true;}
 async check(){if(this.busy||!this.current()||!this.context||!this.raw||!this.state.request)return false;this.busy=true;const n=this.epoch,c=structuredClone(this.context),raw=this.raw,request=structuredClone(this.state.request);
  try{this.state={...this.state,currentStarted:false,message:'Checking saved Start and current readiness.'};if(await this.d.retained.read(nativeMixedStartPendingKeyV1(c))!==raw)return false;
   let receipt=this.state.receipt;if(!receipt){const value=await this.d.operation(request);if(!this.current(n))return false;receipt=readNativeMixedSimulationStartReceiptV1(value,{scope:c.scope,request,historicalOnly:true});const p=pending(JSON.parse(raw),c);if(!receipt||!p||!await this.close(n,c,p,raw,receipt))return false;}
   const value=await this.d.started(request,receipt.startId);if(!this.current(n))return false;const current=readNativeMixedSimulationStartedSourceV1(value,{scope:c.scope,request,startId:receipt.startId});if(current)this.verifiedAt=(this.d.now??Date.now)();this.state={...this.state,currentStarted:!!current,message:current?'Simulated play has started. Real attendance and payments were not recorded.':'Start was saved, but current readiness could not be verified.'};return !!current;
  }catch{return false;}finally{this.busy=false;}
 }
}
