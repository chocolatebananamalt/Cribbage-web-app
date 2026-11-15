import{createEventFinanceEditorV1,projectEventFinanceSectionV1,reduceEventFinanceEditorV1,type EventFinanceEditorV1,type EventFinanceSectionViewV1,type EventFinanceActionV1,type EventFinanceWorkspaceV1}from'./event-finance-workspace-v1.ts';
import{parseEventFinanceDraftV1,encodeEventFinanceDraftV1,type EventFinanceDraftScopeV1,type EventFinanceLocalDraftV1}from'./event-finance-draft-codec-v1.ts';
import{readPreparedEventFinanceSourceV1}from'./event-finance-source-contract-v1.ts';
import{financeDraftRetainedKeyV1,type FinanceDraftRetainedPortV1}from'./event-finance-draft-retained-v1.ts';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const canonical=(v:unknown)=>JSON.stringify(v,(_k,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);Object.values(v).forEach(freeze);}return v;};
export type FinanceDraftStateV1='inactive'|'checking'|'unsaved'|'device_saved_current'|'device_saved_older'|'outcome_unknown'|'conflict'|'storage_blocked'|'source_unavailable';
export type FinanceDraftSnapshotV1={status:FinanceDraftStateV1;view:EventFinanceSectionViewV1|null;initialized:boolean;busy:boolean;deviceSavedAt:string|null;deviceRevision:number|null;message:string;canSave:boolean;canCheck:boolean;canRetry:boolean;ledgerSaved:false;paymentRecorded:false};
type Attempt={expected:string|null;raw:string;record:EventFinanceLocalDraftV1};
/** Fixed-account, proposal-only device session. No remote transport or grants.
 * Import/construction never opens storage. Retained work is discovered before
 * editing; source changes never rewrite its basis. Host must hide/deactivate
 * this fixed scope immediately on auth change and integrate sign-out ownership.
 */
export class FinanceLocalDraftSessionV1{
 private scope:EventFinanceDraftScopeV1;private current:EventFinanceWorkspaceV1|null;private editor:EventFinanceEditorV1|null;private port:FinanceDraftRetainedPortV1;private makeId:()=>string;private now:()=>string;
 private active=false;private initialized=false;private busy=false;private epoch=0;private flight:AbortController|null=null;private initialization:{epoch:number;promise:Promise<void>}|null=null;
 private raw:string|null=null;private saved:EventFinanceLocalDraftV1|null=null;private attempt:Attempt|null=null;private fault:'conflict'|'storage_blocked'|null=null;private message='';private listeners=new Set<()=>void>();private snapshot:FinanceDraftSnapshotV1;
 constructor(scope:EventFinanceDraftScopeV1,preparedSource:unknown,port:FinanceDraftRetainedPortV1,makeId:()=>string,now:()=>string){
  this.scope=freeze(structuredClone(scope));this.port=port;this.makeId=makeId;this.now=now;const source=readPreparedEventFinanceSourceV1(preparedSource,this.scope);this.current=source?.workspace??null;this.editor=this.current?createEventFinanceEditorV1(this.current):null;this.snapshot=this.build();
 }
 getSnapshot=()=>this.snapshot;
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
 matchesScope(scope:EventFinanceDraftScopeV1){return canonical(scope)===canonical(this.scope);}
 private key(){try{return financeDraftRetainedKeyV1(this.scope.actorId,this.scope.tournamentId,this.scope.eventId);}catch{return null;}}
 private enabled(){return this.active&&this.key()!==null&&this.current!==null&&this.editor!==null;}
 private build():FinanceDraftSnapshotV1{
  const enabled=this.enabled(),blocked=!this.initialized||this.fault!==null;
  const ownView=enabled?projectEventFinanceSectionV1(this.editor!,this.current):null;
  const view=ownView?{...ownView,blocked:ownView.blocked||blocked,message:[ownView.message,blocked?'Device recovery must be checked before editing.':''].filter(Boolean).join(' ')}:null;
  const savedCurrent=!!this.saved&&canonical(this.saved.editor)===canonical(this.editor);
  const status:FinanceDraftStateV1=!this.active?'inactive':!enabled?'source_unavailable':this.fault??(!this.initialized?'checking':this.attempt?'outcome_unknown':this.saved?savedCurrent?'device_saved_current':'device_saved_older':'unsaved');
  return freeze({status,view,initialized:this.initialized,busy:this.busy,deviceSavedAt:enabled?this.saved?.deviceSavedAt??null:null,deviceRevision:enabled?this.saved?.revision??null:null,message:this.message,canSave:enabled&&this.initialized&&!this.busy&&!this.fault&&!this.attempt,canCheck:enabled&&!this.busy,canRetry:enabled&&this.initialized&&!this.busy&&!this.fault&&this.attempt!==null,ledgerSaved:false,paymentRecorded:false});
 }
 private publish(){this.snapshot=this.build();this.listeners.forEach(fn=>fn());}
 setActive(active:boolean){if(this.active===active)return;this.active=active;this.epoch++;this.flight?.abort();this.flight=null;this.busy=false;this.publish();}
 updateSource(preparedSource:unknown){const source=readPreparedEventFinanceSourceV1(preparedSource,this.scope);this.current=source?.workspace??null;if(!this.editor&&this.current)this.editor=createEventFinanceEditorV1(this.current);this.publish();}
 private valid(token:number,signal?:AbortSignal){return this.enabled()&&token===this.epoch&&!signal?.aborted;}
 initialize():Promise<void>{
  if(!this.enabled()||this.initialized||this.busy)return Promise.resolve();if(this.initialization?.epoch===this.epoch)return this.initialization.promise;
  const token=this.epoch,key=this.key()!;const promise=(async()=>{try{const raw=await this.port.read(key);if(!this.valid(token))return;
   if(raw!==null){const record=parseEventFinanceDraftV1(raw,this.scope);if(!record){this.fault='storage_blocked';this.message='The saved device draft could not be safely read. Keep it intact.';this.initialized=true;this.publish();return;}this.raw=raw;this.saved=record;this.editor=structuredClone(record.editor);}
   this.initialized=true;this.fault=null;this.message=raw===null?'No saved device draft was found. Changes remain proposals until explicitly saved on this device.':'Device draft restored unchanged. This is not a ledger save or recorded payment.';this.publish();
  }catch{if(this.valid(token)){this.fault='storage_blocked';this.message='Device storage could not be checked. Nothing was cleared.';this.publish();}}})();this.initialization={epoch:token,promise};void promise.finally(()=>{if(this.initialization?.promise===promise)this.initialization=null;});return promise;
 }
 dispatch=(action:EventFinanceActionV1,expectedView:EventFinanceSectionViewV1)=>{if(!this.enabled()||!this.initialized||this.fault||this.snapshot.view!==expectedView||expectedView.blocked)return false;try{this.editor=reduceEventFinanceEditorV1(this.editor!,action,this.current,this.makeId);this.publish();return true;}catch{this.message='The local edit could not be prepared. Your previous proposal is unchanged.';this.publish();return false;}};
 private start(){if(!this.enabled()||!this.initialized||this.busy)return null;const controller=new AbortController();this.flight=controller;this.busy=true;this.publish();return{token:this.epoch,controller,key:this.key()!};}
 private finish(token:number,controller:AbortController){if(this.active&&token===this.epoch&&!controller.signal.aborted){this.busy=false;this.flight=null;this.publish();}}
 private archive(raw:string|null){if(!raw)return undefined;const prior=parseEventFinanceDraftV1(raw,this.scope);return prior?{id:`${this.key()}:draft:${prior.draftId}:revision:${prior.revision}`,raw}:undefined;}
 async save(expected:FinanceDraftSnapshotV1){
  if(expected!==this.snapshot||!this.snapshot.canSave)return;
  let record:EventFinanceLocalDraftV1;try{record={kind:'event-finance-local-draft-v1',...this.scope,draftId:this.saved?.draftId??this.makeId(),revision:(this.saved?.revision??0)+1,deviceSavedAt:this.now(),editor:structuredClone(this.editor!)};}catch{this.message='A safe device copy could not be prepared. No save was started.';this.publish();return;}
  const raw=encodeEventFinanceDraftV1(record);if(raw===null){this.message='This proposal cannot be safely encoded for device recovery. Keep the page open; nothing was overwritten.';this.publish();return;}
  this.attempt={expected:this.raw,raw,record};await this.writeAttempt();
 }
 private async writeAttempt(){
  const attempt=this.attempt;if(!attempt)return;const task=this.start();if(!task)return;
  try{const before=await this.port.read(task.key);if(!this.valid(task.token,task.controller.signal))return;
   if(before===attempt.raw){this.accept(attempt);return;}
   if(before!==attempt.expected){this.fault='conflict';this.message='Another device draft changed. Both copies are retained; no merge or overwrite was made.';this.publish();return;}
   const committed=await this.port.transition(task.key,attempt.expected,attempt.raw,this.archive(attempt.expected),task.controller.signal);if(!this.valid(task.token,task.controller.signal))return;
   const after=await this.port.read(task.key);if(!this.valid(task.token,task.controller.signal))return;
   if(after===attempt.raw){this.accept(attempt);return;}
   if(!committed&&after===attempt.expected){this.message='The saved copy is not confirmed. Check it or retry the same device save.';this.publish();return;}
   this.fault='conflict';this.message='Device recovery changed during saving. Both copies are retained; nothing was cleared.';this.publish();
  }catch{if(this.valid(task.token,task.controller.signal)){this.message='Device save outcome is unknown. Keep this page and check the saved copy before another save.';this.publish();}}finally{this.finish(task.token,task.controller);}
 }
 private accept(attempt:Attempt){this.raw=attempt.raw;this.saved=structuredClone(attempt.record);this.attempt=null;this.fault=null;this.message=canonical(this.editor)===canonical(attempt.record.editor)?'Current proposal copy checked on this device. It is not saved to the tournament ledger.':'An earlier proposal copy was saved on this device. Newer edits still need a device save.';this.publish();}
 async retry(expected:FinanceDraftSnapshotV1){if(expected!==this.snapshot||!this.snapshot.canRetry)return;await this.writeAttempt();}
 async check(expected:FinanceDraftSnapshotV1){
  if(expected!==this.snapshot||!this.snapshot.canCheck)return;
  if(!this.initialized){this.fault=null;await this.initialize();return;}
  const task=this.start();if(!task)return;
  try{const raw=await this.port.read(task.key);if(!this.valid(task.token,task.controller.signal))return;
   if(this.attempt&&raw===this.attempt.raw){this.accept(this.attempt);return;}
   if(raw===this.raw){this.fault=null;this.message=this.attempt?'The attempted copy was not found. The exact device save can be retried.':'The last checked device bytes are unchanged. This is not a ledger save.';this.publish();return;}
   this.fault='conflict';this.message='A different device draft was found. Your memory and the stored bytes are retained for explicit review.';this.publish();
  }catch{if(this.valid(task.token,task.controller.signal)){this.fault='storage_blocked';this.message='The device copy could not be checked. No data was cleared.';this.publish();}}finally{this.finish(task.token,task.controller);}
 }
 /** No discard, sign-out cleanup, automatic rebase or remote write method. */
 getRetainedProposal(){return this.enabled()&&this.editor?freeze(structuredClone(this.editor)):null;}
}
