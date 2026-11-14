import{isModernPrizeScopeV2,modernPrizeSameV2,type ModernPrizeScopeV2}from'./modern-prize-journal-contract-v2.ts';
import{readSelectedStepPoolAttemptV3,readSelectedStepPoolWorkspaceV3,readSelectedStepPoolReplyV3,type SelectedStepPoolAttemptV3,type SelectedStepPoolWorkspaceV3}from'./selected-step-pool-contract-v3.ts';
import type{FinanceDraftRetainedPortV1}from'./event-finance-draft-retained-v1.ts';
export type SelectedStepPoolPortV3={read:(signal:AbortSignal)=>Promise<unknown>;send:(attempt:SelectedStepPoolAttemptV3,recover:boolean,signal:AbortSignal)=>Promise<unknown>};
type State={identityReady:boolean;admitted:boolean;busy:boolean;workspace:SelectedStepPoolWorkspaceV3|null;pending:SelectedStepPoolAttemptV3|null;blocked:boolean;message:string};
const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
/** Construction is inert. No automatic send, discard, rebase or changed nonce.
 * Unknown retained bytes block new work and are never overwritten. */
export class SelectedStepPoolControllerV3{
 readonly scope:ModernPrizeScopeV2;readonly key:string;private active=false;private epoch=0;private abort=new AbortController();private raw:string|null=null;private listeners=new Set<()=>void>();private conceal:()=>void=()=>{};
 private storage:FinanceDraftRetainedPortV1;private port:SelectedStepPoolPortV3;private verified:()=>boolean;
 private state:Readonly<State>=freeze({identityReady:false,admitted:false,busy:false,workspace:null,pending:null,blocked:false,message:'Not loaded.'});
 constructor(scope:ModernPrizeScopeV2,storage:FinanceDraftRetainedPortV1,port:SelectedStepPoolPortV3,verified:()=>boolean=()=>false){if(!isModernPrizeScopeV2(scope))throw Error('invalid_scope');this.scope=freeze(structuredClone(scope));this.storage=storage;this.port=port;this.verified=verified;this.key=`selected-step-pool-v3:${scope.actorId}:${scope.tournamentId}:${scope.eventId}`;}
 subscribe=(f:()=>void)=>{this.listeners.add(f);return()=>{this.listeners.delete(f);};};getSnapshot=()=>this.state;setConceal=(f:()=>void)=>{this.conceal=f;};
 private publish(s:State){this.state=freeze(structuredClone(s));this.listeners.forEach(f=>f());}
 setActive=(v:boolean)=>{if(this.active===v)return;this.active=v;this.epoch++;this.abort.abort();this.abort=new AbortController();this.conceal();this.publish({...this.state,admitted:false,busy:false,workspace:null,pending:null});};
 setIdentityReady=(v:boolean)=>{if(!v){this.setActive(false);this.conceal();}this.publish({...this.state,identityReady:v});};
 private current(e:number){return this.active&&this.epoch===e&&this.state.identityReady;}
 async initialize(){if(!this.active||!this.state.identityReady||this.state.busy)return;const e=this.epoch;this.conceal();this.publish({...this.state,admitted:false,workspace:null,pending:null,busy:true,message:'Checking this account and retained request.'});try{
  const raw=await this.storage.read(this.key);if(!this.current(e))return;this.raw=raw;let pending:SelectedStepPoolAttemptV3|null=null;if(raw!==null){try{pending=readSelectedStepPoolAttemptV3(JSON.parse(raw),this.scope);}catch{/* Preserve unknown bytes. */}if(!pending){this.publish({...this.state,busy:false,blocked:true,message:'Retained work is unverified and preserved. New recording is blocked.'});return;}}
  const workspace=readSelectedStepPoolWorkspaceV3(await this.port.read(this.abort.signal));if(!this.current(e))return;if(!workspace)throw Error('invalid_workspace');this.publish({identityReady:true,admitted:true,busy:false,workspace,pending,blocked:false,message:pending?'Exact retained request found. Nothing was resent.':'Review loaded. Nothing has been recorded by this screen.'});
 }catch{if(this.current(e))this.publish({...this.state,admitted:false,busy:false,blocked:true,workspace:null,pending:null,message:'Account or source could not be verified. Retained work is unchanged.'});}}
 async prepare(action:'proposal'|'finalize',reason:string,confirmed:boolean,operationId:string,expected:SelectedStepPoolWorkspaceV3|null){
  if(!this.active||!this.state.identityReady||!this.verified()||!this.state.admitted||this.state.busy||this.state.blocked||this.raw!==null||this.state.pending||!confirmed||this.state.workspace?.status!=='review'||!modernPrizeSameV2(this.state.workspace,expected))return;
  const w=this.state.workspace,e=this.epoch;if(action==='finalize'&&!w.proposalRevisionId)return;
  const request=action==='proposal'?{kind:'selected-step-pool-save-v3',expectedVersion:w.version,expectedSourceDigest:w.review.sourceDigest,reason,reviewed:true}:{kind:'selected-step-pool-finalize-v3',proposalRevisionId:w.proposalRevisionId,expectedSourceDigest:w.review.sourceDigest,reason,reviewed:true};
  const attempt=readSelectedStepPoolAttemptV3({scope:this.scope,operationId,request,review:w.review},this.scope);if(!attempt)return;const raw=JSON.stringify(attempt);this.publish({...this.state,busy:true,message:'Retaining the exact reviewed request. Nothing is being sent.'});
  try{if(!await this.storage.transition(this.key,null,raw,undefined,this.abort.signal))throw Error('storage_conflict');if(!this.current(e))return;this.raw=raw;this.publish({...this.state,busy:false,pending:attempt,message:'Exact request retained. Choose Send Exact Request or Check Recorded Outcome.'});}catch{if(this.current(e))this.publish({...this.state,busy:false,blocked:true,message:'Storage could not be verified. Nothing sent; recheck retained work.'});}
 }
 async sendExact(recover:boolean,expected:SelectedStepPoolAttemptV3|null){
  if(!this.active||!this.state.identityReady||!this.state.admitted||!this.verified()||this.state.busy||this.state.blocked||!this.state.pending||this.raw===null||!expected||!modernPrizeSameV2(expected,this.state.pending))return;
  const e=this.epoch,attempt=this.state.pending,raw=this.raw;this.publish({...this.state,busy:true,message:recover?'Checking the exact operation outcome.':'Sending only the exact retained request.'});
  try{if(await this.storage.read(this.key)!==raw||!this.current(e)||!this.verified())throw Error('storage_or_access_changed');const reply=readSelectedStepPoolReplyV3(await this.port.send(attempt,recover,this.abort.signal),attempt);if(!this.current(e))return;if(!this.verified()||!reply)throw Error('outcome_unknown');
   if(reply.status==='accepted'){
    if(await this.storage.read(this.key)!==raw||!this.current(e)||!this.verified())throw Error('storage_or_access_changed');
    if(!await this.storage.transition(this.key,raw,null,{id:`selected-step-pool-accepted-v3:${this.scope.actorId}:${this.scope.tournamentId}:${this.scope.eventId}:${attempt.operationId}`,raw:JSON.stringify({retainedRaw:raw,reply})},this.abort.signal))throw Error('archive_conflict');if(!this.current(e))return;this.raw=null;
    this.publish({...this.state,busy:false,pending:null,workspace:null,message:'Exact receipt and reviewed source verified and archived. Nobody is marked paid.'});await this.initialize();
   }else this.publish({...this.state,busy:false,message:reply.status==='rejected'?`Request rejected (${reply.code}). Exact bytes remain retained; no replacement is allowed.`:reply.status==='unknown'?'No recorded outcome was proven. Exact request remains retained; nothing is automatically resent.':`Try the same exact operation again (${reply.code}). Retained bytes are unchanged.`});
  }catch{if(this.current(e)){this.conceal();this.publish({...this.state,admitted:false,busy:false,workspace:null,pending:null,message:'Outcome unknown. Exact bytes remain retained. Recheck this account before explicit recovery; nothing is automatically resent.'});}}
 }
}
