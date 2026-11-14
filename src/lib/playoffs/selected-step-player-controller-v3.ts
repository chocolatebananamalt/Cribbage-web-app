import {readSeriesGameWireReceiptV1}from'./series-game-client-transport-v1.ts';
import {isSelectedStepPlayerScopeV3,readSelectedStepPendingV3,readSelectedStepPlayerViewV3,selectedStepPlayerRequestV3,selectedStepSameV3,type SelectedStepPlayerScopeV3,type SelectedStepPlayerViewV3,type SelectedStepPendingV3}from'./selected-step-player-v3.ts';
export type SelectedStepPlayerPortV3={read:(signal:AbortSignal)=>Promise<unknown>;send:(pending:SelectedStepPendingV3,signal:AbortSignal)=>Promise<unknown>;check:(pending:SelectedStepPendingV3,signal:AbortSignal)=>Promise<unknown>};
export type SelectedStepPlayerStorageV3={read:(key:string)=>string|null;retain:(key:string,expected:string|null,next:string|null,archive?:{key:string;raw:string})=>void};
type State={active:boolean;busy:boolean;view:SelectedStepPlayerViewV3|null;pending:SelectedStepPendingV3|null;blocked:boolean;rejected:boolean;selection:string|null;message:string};
const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
export class SelectedStepPlayerControllerV3{
 readonly scope:SelectedStepPlayerScopeV3;readonly key:string;private storage:SelectedStepPlayerStorageV3;private port:SelectedStepPlayerPortV3;private writable:()=>boolean;private online:()=>boolean;
 private state:Readonly<State>=freeze({active:false,busy:false,view:null,pending:null,blocked:false,rejected:false,selection:null,message:'Loading current match.'});
 private listeners=new Set<()=>void>();private epoch=0;private abort=new AbortController();private raw:string|null=null;private receipt:unknown=null;
 constructor(scope:SelectedStepPlayerScopeV3,storage:SelectedStepPlayerStorageV3,port:SelectedStepPlayerPortV3,writable:()=>boolean,online:()=>boolean=()=>false){if(!isSelectedStepPlayerScopeV3(scope))throw Error('invalid_scope');this.scope=freeze(structuredClone(scope));this.storage=storage;this.port=port;this.writable=writable;this.online=online;this.key=`selected-step-player-v3:${scope.actorId}:${scope.tournamentId}:${scope.eventId}:${scope.generationId}`;}
 subscribe=(f:()=>void)=>{this.listeners.add(f);return()=>{this.listeners.delete(f);};};getSnapshot=()=>this.state;
 private publish(next:State){this.state=freeze(structuredClone(next));this.listeners.forEach(f=>f());}
 setActive(active:boolean){if(active===this.state.active)return;this.epoch++;this.abort.abort();this.abort=new AbortController();this.publish({...this.state,active,busy:false,view:null,pending:null,selection:null});}
 private current(e:number){return this.state.active&&e===this.epoch;}
 async initialize(){if(!this.state.active||this.state.busy)return;const e=this.epoch;this.publish({...this.state,busy:true,view:null,pending:null,selection:null});try{
  this.raw=this.storage.read(this.key);let pending:SelectedStepPendingV3|null=null;
  if(this.raw!==null){try{pending=readSelectedStepPendingV3(JSON.parse(this.raw),this.scope);}catch{/* Preserve unknown work. */}if(!pending)throw Error('retained_request_invalid');}
  this.publish({...this.state,pending});const view=readSelectedStepPlayerViewV3(await this.port.read(this.abort.signal),this.scope);if(!this.current(e))return;
  this.publish({...this.state,busy:false,view,pending,blocked:false,rejected:false,message:pending?'Saved action retained. Nothing was resent.':view?'Current match loaded. Entries need separate confirmation.':'Current match is unavailable; nothing can be entered.'});
 }catch{if(this.current(e))this.publish({...this.state,busy:false,view:null,blocked:this.state.pending===null,message:'Current account, source or retained work could not be checked. Saved bytes are unchanged.'});}}
 select(winner:string){if(!this.state.active||this.state.busy||this.state.pending||this.state.blocked||!this.state.view?.players.some(p=>p.participantId===winner))return;this.publish({...this.state,selection:winner});}
 async prepare(action:'submit'|'confirm',makeId:()=>string){if(!this.state.active||this.state.busy||!this.writable()||this.state.blocked||this.raw!==null||!this.state.view||this.state.pending)return;
  if(action==='confirm'&&this.state.selection!==null&&this.state.selection!==this.state.view.ownSubmission?.winnerParticipantId){this.publish({...this.state,message:'Submit your changed choice before confirming it.'});return;}
  if(!this.online()){this.publish({...this.state,message:'Reconnect and refresh before creating a new entry. Nothing was sent.'});return;}
  const view=this.state.view,selection=this.state.selection,e=this.epoch;this.publish({...this.state,busy:true});
  try{const fresh=readSelectedStepPlayerViewV3(await this.port.read(this.abort.signal),this.scope);if(!this.current(e))return;
   if(!this.online()||!this.writable()||!fresh||!selectedStepSameV3(view,fresh)){this.publish({...this.state,busy:false,view:fresh,selection:null,message:'Game information changed. Review the fresh match before creating an entry.'});return;}
  }catch{if(this.current(e))this.publish({...this.state,busy:false,view:null,selection:null,message:'A fresh online match could not be checked. Nothing was retained or sent.'});return;}
  let request;try{request=selectedStepPlayerRequestV3(view,action,selection,makeId);}catch{this.publish({...this.state,busy:false,message:'An entry ID could not be created. Nothing was retained or sent.'});return;}if(!request){this.publish({...this.state,busy:false});return;}
  const pending:SelectedStepPendingV3={kind:'selected-step-player-pending-v3',scope:this.scope,request},raw=JSON.stringify(pending);
  try{this.storage.retain(this.key,null,raw);this.raw=raw;this.publish({...this.state,busy:false,pending,selection:null,message:'Exact action saved on this device. Choose Sync Saved Entry to send it.'});}catch{this.publish({...this.state,busy:false,blocked:true,message:'Recovery storage is unavailable. Nothing was sent.'});}}
 async resolve(checkOnly=false){if(!this.state.active||this.state.busy||this.state.blocked||!this.state.pending||this.raw===null||!checkOnly&&!this.writable())return;
  const e=this.epoch,pending=this.state.pending,raw=this.raw;this.publish({...this.state,busy:true});try{
   if(this.storage.read(this.key)!==raw)throw Error('retained_changed');
   const response=await(checkOnly?this.port.check(pending,this.abort.signal):this.port.send(pending,this.abort.signal));if(!this.current(e))return;
   const r=readSeriesGameWireReceiptV1(response,{actorProfileId:this.scope.actorId,tournamentId:this.scope.tournamentId,eventId:this.scope.eventId,qualificationId:this.scope.qualificationId,slot:this.scope.slot,request:pending.request});
   if(r.status==='accepted'){
    this.storage.retain(this.key,raw,null,{key:`${this.key}:archive:${pending.request.operationId}`,raw:JSON.stringify({retained:raw,response})});this.raw=null;this.receipt=null;
    this.publish({...this.state,busy:false,pending:null,view:null,selection:null,message:'Your saved action was acknowledged. Rechecking current game state.'});await this.initialize();
   }else{this.receipt=r.status==='rejected'?response:null;this.publish({...this.state,busy:false,rejected:r.status==='rejected',message:r.status==='rejected'?'The action was rejected and remains saved. Keep a copy before choosing a new action.':'Outcome is not confirmed. Keep or retry only this exact saved action.'});}
  }catch{if(this.current(e))this.publish({...this.state,busy:false,view:null,message:'Outcome unknown. The exact saved action is retained; no automatic resend.'});}}
 async keepRejected(){if(!this.state.active||this.state.busy||!this.state.rejected||!this.state.pending||!this.receipt||this.raw===null)return;
  try{this.storage.retain(this.key,this.raw,null,{key:`${this.key}:archive:${this.state.pending.request.operationId}`,raw:JSON.stringify({retained:this.raw,response:this.receipt})});this.raw=null;this.receipt=null;this.publish({...this.state,pending:null,rejected:false,view:null,selection:null});await this.initialize();}catch{this.publish({...this.state,blocked:true,message:'The saved copy could not be secured. Original work remains held.'});}}
}
