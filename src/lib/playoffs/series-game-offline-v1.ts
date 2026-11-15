import{isSeriesFormatV1,type SeriesFormatV1}from'./series-settings-v1.ts';
import{projectSeriesGameLoadedV1,type SeriesGamePlayerV1}from'./series-game-protocol-v1.ts';
import{isSeriesGameClientWorkspaceV1,isSeriesGameWireRequestV1,buildSeriesGameWireRequestV1,readSeriesGameWireReceiptV1,workspaceIncludesWireOperationV1,type SeriesGameClientWorkspaceV1,type SeriesGameWireRequestV1}from'./series-game-client-transport-v1.ts';
import{seriesGameRetainedKeyV1,type SeriesGameRetainedPortV1}from'./series-game-retained-v1.ts';

export type SeriesGameEntryContextV1={enabled:boolean;actorProfileId:string;tournamentId:string;eventId:string;workspace:SeriesGameClientWorkspaceV1|null;workspaceFresh:boolean;online:boolean;offlineAuthoringReady:boolean};
export type SeriesGameEntryScopeV1={actorProfileId:string;tournamentId:string;eventId:string;qualificationId:string;slot:number;matchId:string;generationId:string};
export type SeriesGameEntryTransportV1={
 send:(scope:SeriesGameEntryScopeV1,request:SeriesGameWireRequestV1,signal:AbortSignal)=>Promise<unknown>;
 operationGET:(scope:SeriesGameEntryScopeV1,operationId:string,signal:AbortSignal)=>Promise<unknown>;
 /** Authenticated, no-store online read; never return a cached object as fresh. */
 readWorkspace:(scope:SeriesGameEntryScopeV1,signal:AbortSignal)=>Promise<unknown>;
};
export type SeriesGamePendingV1=SeriesGameEntryScopeV1&{kind:'series-game-pending-v1';ownParticipantId:string;players:[SeriesGamePlayerV1,SeriesGamePlayerV1];format:SeriesFormatV1;preWriteReadId:string;request:SeriesGameWireRequestV1};
type Receipt=ReturnType<typeof readSeriesGameWireReceiptV1>;
export type SeriesGameEntrySnapshotV1={context:SeriesGameEntryContextV1;initialized:boolean;busy:boolean;pending:SeriesGamePendingV1|null;hasUnresolvedStorage:boolean;selection:string|null;message:string;receiptStatus:Receipt['status']|null;reviewing:boolean;storageBlocked:boolean;freshAfterPending:boolean};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(v);
const canonical=(v:unknown)=>JSON.stringify(v,(_k,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);Object.values(v).forEach(freeze);}return v;};
const copy=<T>(v:T):T=>JSON.parse(canonical(v))as T;
const pendingKeys=['kind','actorProfileId','tournamentId','eventId','qualificationId','slot','matchId','generationId','ownParticipantId','players','format','preWriteReadId','request'];
export function parseSeriesGamePendingV1(raw:string):SeriesGamePendingV1|null{
 try{
  if(new TextEncoder().encode(raw).byteLength>64000)return null;const p:unknown=JSON.parse(raw);
  if(!exact(p,pendingKeys)||p.kind!=='series-game-pending-v1'||![p.actorProfileId,p.tournamentId,p.eventId,p.qualificationId,p.matchId,p.generationId,p.ownParticipantId,p.preWriteReadId].every(uuid)||typeof p.slot!=='number'||!Number.isSafeInteger(p.slot)||p.slot<1||p.slot>63||!isSeriesFormatV1(p.format)||!isSeriesGameWireRequestV1(p.request)||!Array.isArray(p.players)||p.players.length!==2)return null;
  const ps=p.players,request=p.request;if(ps.some(x=>!exact(x,['participantId','profileId','cardMode'])||!uuid(x.participantId)||!uuid(x.profileId)||x.cardMode!=='digital')||ps[0].participantId===ps[1].participantId||ps[0].profileId===ps[1].profileId||!ps.some(x=>x.profileId===p.actorProfileId&&x.participantId===p.ownParticipantId)||p.request.generationId!==p.generationId||(p.request.winnerParticipantId!==null&&!ps.some(x=>x.participantId===request.winnerParticipantId)))return null;
  return copy(p as SeriesGamePendingV1);
 }catch{return null;}
}
const scope=(p:SeriesGamePendingV1):SeriesGameEntryScopeV1=>({actorProfileId:p.actorProfileId,tournamentId:p.tournamentId,eventId:p.eventId,qualificationId:p.qualificationId,slot:p.slot,matchId:p.matchId,generationId:p.generationId});
const expected=(p:SeriesGamePendingV1)=>({actorProfileId:p.actorProfileId,tournamentId:p.tournamentId,eventId:p.eventId,qualificationId:p.qualificationId,slot:p.slot,request:p.request});
function workspaceFits(c:SeriesGameEntryContextV1,w:unknown):w is SeriesGameClientWorkspaceV1{return isSeriesGameClientWorkspaceV1(w,c.actorProfileId)&&w.loaded.binding.tournamentId===c.tournamentId&&w.loaded.binding.eventId===c.eventId;}
function samePendingSource(p:SeriesGamePendingV1,w:SeriesGameClientWorkspaceV1){const b=w.loaded.binding;return p.actorProfileId===w.actorProfileId&&p.tournamentId===b.tournamentId&&p.eventId===b.eventId&&p.qualificationId===b.qualificationId&&p.slot===b.slot&&p.matchId===b.matchId&&p.generationId===b.generationId&&p.request.generationVersion===b.matchVersion&&p.request.sourceDigest===b.sourceDigest&&p.request.settingsBindingId===b.settingsBindingId&&p.request.reviewId===b.reviewId&&p.request.playoffStartId===b.playoffStartId&&canonical(p.request.parentResultPins)===canonical(b.parentResultPins)&&canonical(p.players)===canonical(w.loaded.players)&&canonical(p.format)===canonical(b.round==='final'?w.loaded.settings.final:w.loaded.settings.regular);}

function nonRegressive(old:SeriesGameClientWorkspaceV1|null,next:SeriesGameClientWorkspaceV1){
 if(!old||canonical(old.loaded.binding)!==canonical(next.loaded.binding))return true;
 return old.loaded.games.every(game=>{const found=next.loaded.games.find(g=>g.gameNumber===game.gameNumber);return !!found&&game.operations.every((op,i)=>canonical(op)===canonical(found.operations[i]));})&&old.gameRows.filter(r=>r.state==='persisted').every(row=>next.gameRows.some(r=>r.gameId===row.gameId&&r.gameNumber===row.gameNumber&&r.state==='persisted'&&r.gameVersion>=row.gameVersion));
}

/** Default-off, injected controller. Durable CAS precedes every send. ACKs never
 * grant verification; only a separately authenticated fresh workspace can supply
 * current state. Cancellation is not evidence that a server request failed.
 */
export class SeriesGameOfflineControllerV1{
 private state:SeriesGameEntrySnapshotV1;private raw:string|null=null;private receipt:Receipt|null=null;private receiptRaw:unknown=null;
 private workspaceRevision=0;
 private initialization:{epoch:number;promise:Promise<void>}|null=null;
 private listeners=new Set<()=>void>();private epoch=0;private flight:AbortController|null=null;private disposed=false;
 private retained:SeriesGameRetainedPortV1;private transport:SeriesGameEntryTransportV1;private makeId:()=>string;
 constructor(context:SeriesGameEntryContextV1,retained:SeriesGameRetainedPortV1,transport:SeriesGameEntryTransportV1,makeId:()=>string){
  this.retained=retained;this.transport=transport;this.makeId=makeId;
  this.state={context:copy(context),initialized:false,busy:false,pending:null,hasUnresolvedStorage:false,selection:null,message:'',receiptStatus:null,reviewing:false,storageBlocked:false,freshAfterPending:false};this.resetSelection();
 }
 getSnapshot=()=>freeze(this.state);
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
 private publish(patch:Partial<SeriesGameEntrySnapshotV1>={}){if(this.disposed)return;this.state={...this.state,...patch};this.listeners.forEach(fn=>fn());}
 private key(){try{return seriesGameRetainedKeyV1(this.state.context.actorProfileId,this.state.context.tournamentId,this.state.context.eventId);}catch{return null;}}
 private ready(){return !this.disposed&&this.state.context.enabled&&this.key()!==null;}
 private active(token:number,signal:AbortSignal){return this.ready()&&token===this.epoch&&!signal.aborted;}
 private invalidate(){this.epoch++;this.flight?.abort();this.flight=null;this.publish({busy:false,reviewing:false});}
 private resetSelection(){const c=this.state.context,w=c.workspace;if(w&&workspaceFits(c,w)){const p=projectSeriesGameLoadedV1(w.loaded,c.actorProfileId);if(p.status==='projected_series_game_workspace')this.state={...this.state,selection:p.currentGame.ownSubmission?.winnerParticipantId??null};}}
 updateContext(next:SeriesGameEntryContextV1){
  const old=this.state.context,identity=(c:SeriesGameEntryContextV1)=>canonical({enabled:c.enabled,actor:c.actorProfileId,tid:c.tournamentId,eid:c.eventId,binding:c.workspace?.loaded.binding,players:c.workspace?.loaded.players,settings:c.workspace?.loaded.settings});
  const changed=identity(old)!==identity(next);if(changed)this.invalidate();
  if(changed){this.workspaceRevision++;this.raw=null;this.receipt=null;this.receiptRaw=null;this.publish({context:copy(next),initialized:false,pending:null,hasUnresolvedStorage:false,selection:null,message:'',receiptStatus:null,storageBlocked:false,freshAfterPending:false});this.resetSelection();this.publish();}
  else{const before=old.workspace&&projectSeriesGameLoadedV1(old.workspace.loaded,old.actorProfileId);this.adopt(next.workspace,next.workspaceFresh,before?.status==='projected_series_game_workspace'?before.currentGame.gameNumber:null);this.publish({context:{...this.state.context,online:next.online,offlineAuthoringReady:next.offlineAuthoringReady,enabled:next.enabled}});}
 }
 setOnline(online:boolean){this.publish({context:{...this.state.context,online,workspaceFresh:online?this.state.context.workspaceFresh:false},message:this.state.pending&&!online?'Saved on this device. Reconnect to check or sync this entry.':this.state.message});}
 dispose(){this.invalidate();this.disposed=true;this.listeners.clear();}
 initialize(force=false):Promise<void>{
  if(!this.ready()||this.state.busy||this.state.initialized&&!force)return Promise.resolve();
  if(this.initialization?.epoch===this.epoch)return this.initialization.promise;
  const token=this.epoch,key=this.key()!;
  this.publish({initialized:false});
  const promise=(async()=>{
   try{const raw=await this.retained.read(key);if(token!==this.epoch||!this.ready())return;this.loadRaw(raw);this.publish({initialized:true});}
   catch{if(token===this.epoch&&this.ready())this.publish({initialized:true,storageBlocked:true,hasUnresolvedStorage:true,message:'Recovery storage could not be checked. Nothing new will be sent.'});}
  })();
  this.initialization={epoch:token,promise};
  void promise.finally(()=>{if(this.initialization?.promise===promise)this.initialization=null;});
  return promise;
 }
 private loadRaw(raw:string|null){
  this.raw=raw;const p=raw===null?null:parseSeriesGamePendingV1(raw),c=this.state.context;
  const valid=p&&p.actorProfileId===c.actorProfileId&&p.tournamentId===c.tournamentId&&p.eventId===c.eventId;
  this.publish({pending:valid?p:null,hasUnresolvedStorage:raw!==null,storageBlocked:raw!==null&&!valid,reviewing:false,message:raw!==null&&!valid?'Saved recovery data could not be safely read. Keep it intact.':raw!==null?'A saved action needs checking before another can be sent.':'',receiptStatus:null,freshAfterPending:false});this.receipt=null;this.receiptRaw=null;
 }
 private projection(){const c=this.state.context;return c.workspace&&workspaceFits(c,c.workspace)?projectSeriesGameLoadedV1(c.workspace.loaded,c.actorProfileId):null;}
 canAuthor(){const c=this.state.context,p=this.projection();return this.ready()&&this.state.initialized&&!this.state.busy&&!this.state.storageBlocked&&p?.status==='projected_series_game_workspace'&&!p.series.complete&&p.currentGame.status!=='verified'&&(c.online?c.workspaceFresh:c.offlineAuthoringReady)&&(!this.raw||this.state.reviewing&&this.canReviewSaved());}
 getCapabilities(){
  const s=this.state,c=s.context,w=c.workspace,p=s.pending,q=this.projection(),current=q?.status==='projected_series_game_workspace'?q.currentGame:null;
  const same=!!(p&&w&&workspaceFits(c,w)&&samePendingSource(p,w));
  const review=this.ready()&&s.initialized&&!s.busy&&!!p&&!!w&&c.online&&c.workspaceFresh&&s.freshAfterPending&&this.receipt?.status==='rejected'&&same&&p.request.gameNumber===w.gameNumber&&!!current&&q?.status==='projected_series_game_workspace'&&!q.series.complete&&current.status!=='verified';
  const author=this.canAuthor();
  return{canSubmit:author&&!!q&&q.status==='projected_series_game_workspace'&&q.players.some(x=>x.participantId===s.selection),
   canConfirm:author&&!!current?.ownSubmission&&current.ownConfirmedSubmissionOperationId!==current.ownSubmission.operationId&&(s.selection===null||s.selection===current.ownSubmission.winnerParticipantId),
   canRetry:this.ready()&&s.initialized&&!s.busy&&!s.storageBlocked&&c.online&&!!p&&same&&this.receipt?.status!=='rejected',
   canCheckOutcome:this.ready()&&s.initialized&&!s.busy&&!s.storageBlocked&&c.online&&!!p,
   canRefresh:this.ready()&&!s.busy&&c.online,
   canReviewSaved:review,
   canKeepCopy:this.ready()&&s.initialized&&!s.busy&&!!p&&s.freshAfterPending&&c.online&&c.workspaceFresh&&(this.receipt?.status==='rejected'||this.receipt?.status==='accepted'&&!same)};
 }
 private canReviewSaved(){
  const s=this.state,c=s.context,w=c.workspace,p=s.pending,q=this.projection();
  return !!(s.initialized&&p&&w&&c.online&&c.workspaceFresh&&s.freshAfterPending&&this.receipt?.status==='rejected'&&samePendingSource(p,w)&&p.request.gameNumber===w.gameNumber&&q?.status==='projected_series_game_workspace'&&!q.series.complete&&q.currentGame.status!=='verified');
 }
 selectWinner(id:string){const p=this.projection();if(!this.canAuthor()||p?.status!=='projected_series_game_workspace'||!p.players.some(x=>x.participantId===id))return;this.publish({selection:id});}
 private start(){if(!this.ready()||!this.state.initialized||this.state.busy)return null;const controller=new AbortController();this.flight=controller;this.publish({busy:true,message:''});return{token:this.epoch,controller,key:this.key()!};}
 private finish(token:number,controller:AbortController){if(this.active(token,controller.signal)){this.flight=null;this.publish({busy:false});}}
 private archive(p:SeriesGamePendingV1){return{id:`${this.key()}:operation:${p.request.operationId}`,raw:canonical({kind:'series-game-history-v1',pending:p,receipt:this.receiptRaw,workspaceReadId:this.state.context.workspace?.readId??null})};}
 private adopt(w:SeriesGameClientWorkspaceV1|null,fresh:boolean,oldGameNumber:number|null=null){
  const c=this.state.context;if(w!==null&&(!workspaceFits(c,w)||!nonRegressive(c.workspace,w)))return false;
  const before=this.projection(),next=w&&projectSeriesGameLoadedV1(w.loaded,c.actorProfileId);
  const previousNumber=oldGameNumber??(before?.status==='projected_series_game_workspace'?before.currentGame.gameNumber:null);
  let selection=this.state.selection;
  if(next?.status==='projected_series_game_workspace'){
   const oldOwn=before?.status==='projected_series_game_workspace'?before.currentGame.ownSubmission?.winnerParticipantId??null:null;
   if(canonical(c.workspace?.loaded.binding)!==canonical(w?.loaded.binding)||canonical(c.workspace?.loaded.players)!==canonical(w?.loaded.players)||canonical(c.workspace?.loaded.settings)!==canonical(w?.loaded.settings)||previousNumber!==next.currentGame.gameNumber||selection===null||selection===oldOwn)selection=next.currentGame.ownSubmission?.winnerParticipantId??null;
  }else selection=null;
  this.workspaceRevision++;this.publish({context:{...c,workspace:w?copy(w):null,workspaceFresh:fresh},selection});return true;
 }
 async submitResult(){await this.newAction('submit');}
 async confirmOwnEntry(){await this.newAction('confirm');}
 private async newAction(action:'submit'|'confirm'){
  if(!this.canAuthor())return;const c=this.state.context,w=c.workspace!,p=this.projection();if(p?.status!=='projected_series_game_workspace')return;
  if(action==='submit'&&!p.players.some(x=>x.participantId===this.state.selection))return;
  if(action==='confirm'&&(!p.currentGame.ownSubmission||p.currentGame.ownConfirmedSubmissionOperationId===p.currentGame.ownSubmission.operationId||(this.state.selection!==null&&this.state.selection!==p.currentGame.ownSubmission.winnerParticipantId)))return;
  const task=this.start();if(!task)return;const{token,controller,key}=task;
  try{
   const ids={operationId:this.makeId(),submissionId:action==='submit'?this.makeId():null,confirmationId:action==='confirm'?this.makeId():null};
   const request=buildSeriesGameWireRequestV1(w,action==='submit'?{action,winnerParticipantId:this.state.selection!}:{action},ids);
   if(!request){this.publish({message:'A safe entry could not be prepared. Nothing was sent.'});return;}
   const b=w.loaded.binding,pending:SeriesGamePendingV1={kind:'series-game-pending-v1',actorProfileId:c.actorProfileId,tournamentId:c.tournamentId,eventId:c.eventId,qualificationId:b.qualificationId,slot:b.slot,matchId:b.matchId,generationId:b.generationId,ownParticipantId:p.actorParticipantId,players:copy(w.loaded.players),format:copy(p.format),preWriteReadId:w.readId,request};
   const raw=canonical(pending);if(!parseSeriesGamePendingV1(raw))throw Error('invalid_pending');
   const before=this.raw,archive=before&&this.state.reviewing&&this.receipt?.status==='rejected'&&this.state.pending?this.archive(this.state.pending):undefined;
   if(before!==null&&!archive)return;
   if(!await this.retained.transition(key,before,raw,archive,controller.signal)){if(this.active(token,controller.signal)){const saved=await this.retained.read(key);if(!this.active(token,controller.signal))return;this.loadRaw(saved);this.publish({message:'Another saved action must be checked first.'});}return;}
   if(!this.active(token,controller.signal))return;
   if(await this.retained.read(key)!==raw){if(!this.active(token,controller.signal))return;this.publish({storageBlocked:true,message:'Recovery changed before sending. Nothing new was sent.'});return;}
   if(!this.active(token,controller.signal))return;
   this.raw=raw;this.receipt=null;this.receiptRaw=null;this.publish({pending,hasUnresolvedStorage:true,reviewing:false,receiptStatus:null,freshAfterPending:false,message:'Saved on this device. Waiting to sync.'});
   if(!this.state.context.online)return;
   const reply=await this.transport.send(scope(pending),copy(request),controller.signal);if(this.active(token,controller.signal))await this.consume(reply,pending,raw,token,controller);
  }catch{if(this.active(token,controller.signal))this.publish({message:this.raw?'The outcome is not yet known. Keep this saved action and check it again.':'This device could not safely retain the entry. Nothing was sent.',storageBlocked:this.raw===null});}
  finally{this.finish(token,controller);}
 }
 private async consume(reply:unknown,pending:SeriesGamePendingV1,raw:string,token:number,controller:AbortController){
  const decoded=readSeriesGameWireReceiptV1(reply,expected(pending));
  // A later missing lookup cannot erase a previously bound terminal receipt.
  const retainKnown=(decoded.status==='unknown'||decoded.status==='retry_exact')&&(this.receipt?.status==='accepted'||this.receipt?.status==='rejected');
  const receipt=retainKnown?this.receipt!:decoded;this.receipt=receipt;if(!retainKnown)this.receiptRaw=receipt.status==='accepted'||receipt.status==='rejected'?copy(reply):null;
  this.publish({receiptStatus:receipt.status,message:receipt.status==='rejected'?'The saved action needs review. Its copy is kept.':receipt.status==='accepted'?'Your action was received. Checking the current game.':'The outcome is not confirmed. Keep this saved action.'});
  if(!this.state.context.online)return;
  await this.readFresh(pending,token,controller);
  if(!this.active(token,controller.signal)||receipt.status!=='accepted'||!this.state.freshAfterPending||!this.state.context.online)return;
  const w=this.state.context.workspace!;
  if(!samePendingSource(pending,w)||!workspaceIncludesWireOperationV1(w,expected(pending))){this.publish({message:'Current game information has not confirmed this saved action. Keep it and check again.'});return;}
  if(await this.retained.transition(this.key()!,raw,null,this.archive(pending),controller.signal)){
   if(!this.active(token,controller.signal))return;this.raw=null;this.receipt=null;this.receiptRaw=null;this.publish({pending:null,hasUnresolvedStorage:false,receiptStatus:null,reviewing:false,message:'Entry checked against the current game.'});
  }else if(this.active(token,controller.signal))this.publish({message:'Recovery changed during checking. Nothing was cleared.'});
 }
 private async readFresh(p:SeriesGamePendingV1,token:number,controller:AbortController){
  this.publish({context:{...this.state.context,workspaceFresh:false},freshAfterPending:false});
  const revision=this.workspaceRevision;
  const value=await this.transport.readWorkspace(scope(p),controller.signal);
  if(!this.active(token,controller.signal)||!this.state.context.online)return;
  if(revision!==this.workspaceRevision){this.publish({freshAfterPending:false});return;}
  if(!workspaceFits(this.state.context,value)||value.readId===p.preWriteReadId){this.publish({freshAfterPending:false,message:'A fresh game check is unavailable. Keep this saved entry.'});return;}
  if(!this.adopt(value,true)){this.publish({freshAfterPending:false,message:'The game check was older than information already received. Keep this saved entry.'});return;}this.publish({freshAfterPending:true});
 }
 async retryExact(){await this.retainedAction('retry');}
 async checkOutcome(){await this.retainedAction('check');}
 private async retainedAction(mode:'retry'|'check'){
  const p=this.state.pending,raw=this.raw,c=this.state.context;if(!this.ready()||!c.online||!p||!raw||this.state.storageBlocked)return;
  if(mode==='retry'&&(this.receipt?.status==='rejected'||!c.workspace||!workspaceFits(c,c.workspace)||!samePendingSource(p,c.workspace)))return;
  const task=this.start();if(!task)return;const{token,controller,key}=task;
  try{if(await this.retained.read(key)!==raw){if(this.active(token,controller.signal))this.publish({storageBlocked:true,message:'Saved recovery changed. Refresh before continuing.'});return;}
   if(!this.active(token,controller.signal))return;
   const reply=mode==='retry'?await this.transport.send(scope(p),copy(p.request),controller.signal):await this.transport.operationGET(scope(p),p.request.operationId,controller.signal);
   if(this.active(token,controller.signal))await this.consume(reply,p,raw,token,controller);
  }catch{if(this.active(token,controller.signal))this.publish({message:'The outcome is not yet known. The saved action is kept.'});}finally{this.finish(token,controller);}
 }
 async refresh(){
  if(!this.ready()||!this.state.context.online||this.state.busy)return;
  if(!this.state.initialized||this.state.storageBlocked){await this.initialize(true);if(this.state.storageBlocked||!this.ready())return;}
  const p=this.state.pending;
  if(p){await this.checkOutcome();return;}
  const c=this.state.context,w=c.workspace;if(!w||!workspaceFits(c,w))return;const b=w.loaded.binding,task=this.start();if(!task)return;
  this.publish({context:{...c,workspaceFresh:false},freshAfterPending:false});
  const revision=this.workspaceRevision;
  try{const fresh=await this.transport.readWorkspace({actorProfileId:c.actorProfileId,tournamentId:c.tournamentId,eventId:c.eventId,qualificationId:b.qualificationId,slot:b.slot,matchId:b.matchId,generationId:b.generationId},task.controller.signal);if(this.active(task.token,task.controller.signal)&&revision===this.workspaceRevision&&workspaceFits(c,fresh))this.adopt(fresh,true);}
  catch{if(this.active(task.token,task.controller.signal))this.publish({message:'Current match information could not be checked.'});}finally{this.finish(task.token,task.controller);}
 }
 reviewSaved(){const s=this.state,w=s.context.workspace,p=s.pending,projection=this.projection();if(!s.busy&&p&&w&&s.context.online&&s.context.workspaceFresh&&s.freshAfterPending&&this.receipt?.status==='rejected'&&samePendingSource(p,w)&&p.request.gameNumber===w.gameNumber&&projection?.status==='projected_series_game_workspace'&&!projection.series.complete&&projection.currentGame.status!=='verified')this.publish({reviewing:true,selection:p.request.action==='submit'?p.request.winnerParticipantId:projection.currentGame.ownSubmission?.winnerParticipantId??null,message:'Review your current choice, then submit or confirm it. The previous copy will be kept.'});}
 async keepCopyAndContinue(){
  const p=this.state.pending,raw=this.raw;if(!p||!raw||!this.getCapabilities().canKeepCopy)return;
  const task=this.start();if(!task)return;try{if(await this.retained.transition(task.key,raw,null,this.archive(p),task.controller.signal)&&this.active(task.token,task.controller.signal)){this.raw=null;this.receipt=null;this.receiptRaw=null;this.publish({pending:null,hasUnresolvedStorage:false,reviewing:false,receiptStatus:null,message:'A copy was kept on this device. Review the current game before entering anything new.'});this.resetSelection();this.publish();}}
  catch{if(this.active(task.token,task.controller.signal))this.publish({storageBlocked:true,message:'The saved copy could not be confirmed. Nothing was cleared.'});}finally{this.finish(task.token,task.controller);}
 }
}
