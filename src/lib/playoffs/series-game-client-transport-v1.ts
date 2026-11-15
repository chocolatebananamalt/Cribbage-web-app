import{planSeriesGameOperationV1,projectSeriesGameLoadedV1,type SeriesGameLoadedV1}from'./series-game-protocol-v1.ts';

type ParentPin={matchId:string;resultId:string;version:number}|null;
export type SeriesGameWireRequestV1={operationId:string;action:'submit'|'confirm';gameId:string;gameNumber:number;expectedGameVersion:number;submissionId:string|null;confirmationId:string|null;priorSubmissionId:string|null;winnerParticipantId:string|null;confirmedSubmissionId:string|null;generationId:string;generationVersion:number;sourceDigest:string;settingsBindingId:string;reviewId:string;playoffStartId:string;parentResultPins:[ParentPin,ParentPin]};
export type SeriesGameSubmissionRowV1={submissionId:string;operationId:string;participantId:string;profileId:string;winnerParticipantId:string};
export type SeriesGameConfirmationRowV1={confirmationId:string;operationId:string;submissionId:string;participantId:string;profileId:string};
export type SeriesGameRowV1={gameId:string;gameNumber:number;gameVersion:number;state:'reserved'|'persisted'};
export type SeriesGameClientWorkspaceV1={kind:'series-game-client-workspace-v1';actorProfileId:string;loaded:SeriesGameLoadedV1;gameId:string;gameNumber:number;gameVersion:number;gameRows:SeriesGameRowV1[];submissionRows:SeriesGameSubmissionRowV1[];confirmationRows:SeriesGameConfirmationRowV1[];readId:string};

const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const integer=(v:unknown,min=0,max=2147483647):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max&&!Object.is(v,-0);
const array=(v:unknown):v is unknown[]=>Array.isArray(v)&&Reflect.ownKeys(v).length===v.length+1;
const canonical=(v:unknown)=>JSON.stringify(v,(_key,item)=>object(item)?Object.fromEntries(Object.keys(item).sort().map(k=>[k,item[k]])):item);
function cloneFreeze<T>(value:T):T{const copy=structuredClone(value);const freeze=(v:unknown)=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}};freeze(copy);return copy;}
function submissionRow(v:unknown):v is SeriesGameSubmissionRowV1{return exact(v,['submissionId','operationId','participantId','profileId','winnerParticipantId'])&&uuid(v.submissionId)&&uuid(v.operationId)&&uuid(v.participantId)&&uuid(v.profileId)&&uuid(v.winnerParticipantId);}
function confirmationRow(v:unknown):v is SeriesGameConfirmationRowV1{return exact(v,['confirmationId','operationId','submissionId','participantId','profileId'])&&uuid(v.confirmationId)&&uuid(v.operationId)&&uuid(v.submissionId)&&uuid(v.participantId)&&uuid(v.profileId);}
function gameRow(v:unknown):v is SeriesGameRowV1{return exact(v,['gameId','gameNumber','gameVersion','state'])&&uuid(v.gameId)&&integer(v.gameNumber,1,10000)&&integer(v.gameVersion,0,2147483646)&&(v.state==='reserved'||v.state==='persisted');}
const operationKey=(profileId:string,operationId:string)=>`${profileId}:${operationId}`;

/** Validates internal history plus immutable SQL-row/semantic-operation mapping.
 * The future server producer remains responsible for authenticating the
 * workspace and reserving its non-null stable gameId before offline authoring.
 */
export function isSeriesGameClientWorkspaceV1(value:unknown,actorProfileId?:string):value is SeriesGameClientWorkspaceV1{
 if(!exact(value,['kind','actorProfileId','loaded','gameId','gameNumber','gameVersion','gameRows','submissionRows','confirmationRows','readId'])||value.kind!=='series-game-client-workspace-v1'||!uuid(value.actorProfileId)||!uuid(value.gameId)||!uuid(value.readId)||!integer(value.gameNumber,1,10000)||!integer(value.gameVersion,0,2147483646)||!array(value.gameRows)||!array(value.submissionRows)||!array(value.confirmationRows)||!value.gameRows.every(gameRow)||!value.submissionRows.every(submissionRow)||!value.confirmationRows.every(confirmationRow)||actorProfileId!==undefined&&value.actorProfileId!==actorProfileId)return false;
 const projected=projectSeriesGameLoadedV1(value.loaded,value.actorProfileId);if(projected.status!=='projected_series_game_workspace'||projected.currentGame.gameNumber!==value.gameNumber||projected.currentGame.version!==value.gameVersion)return false;
 const loaded=value.loaded as SeriesGameLoadedV1,gameRows=value.gameRows as SeriesGameRowV1[],game=loaded.games.find(g=>g.gameNumber===value.gameNumber),currentRow=gameRows.find(r=>r.gameNumber===value.gameNumber);
 if(!currentRow||currentRow.gameId!==value.gameId||currentRow.gameVersion!==value.gameVersion||projected.currentGame.status!=='not_started'&&!game||new Set(gameRows.map(r=>r.gameId)).size!==gameRows.length||new Set(gameRows.map(r=>r.gameNumber)).size!==gameRows.length)return false;
 for(const row of gameRows){const semantic=loaded.games.find(g=>g.gameNumber===row.gameNumber);if(!semantic){if(row!==currentRow||row.state!=='reserved'||row.gameVersion!==0)return false;}else if(row.gameVersion!==semantic.operations.length||semantic.operations.length>0&&row.state!=='persisted'||row.state==='reserved'&&(row!==currentRow||row.gameVersion!==0))return false;}
 if(loaded.games.some(g=>!gameRows.some(r=>r.gameNumber===g.gameNumber)))return false;
 const submissions=new Map(value.submissionRows.map(r=>[operationKey(r.profileId,r.operationId),r])),confirmations=new Map(value.confirmationRows.map(r=>[operationKey(r.profileId,r.operationId),r]));
 if(submissions.size!==value.submissionRows.length||confirmations.size!==value.confirmationRows.length||new Set(value.submissionRows.map(r=>r.submissionId)).size!==value.submissionRows.length||new Set(value.confirmationRows.map(r=>r.confirmationId)).size!==value.confirmationRows.length)return false;
 const seenSubmissions=new Set<string>(),seenConfirmations=new Set<string>();
 for(const receipt of loaded.games.flatMap(g=>g.operations)){const operation=receipt.request.operation,player=loaded.players.find(p=>p.participantId===operation.participantId);if(!player||player.profileId!==receipt.actorProfileId)return false;
  const key=operationKey(receipt.actorProfileId,operation.operationId);
  if(operation.action==='submit'){const row=submissions.get(key);if(!row||row.participantId!==operation.participantId||row.winnerParticipantId!==operation.winnerParticipantId)return false;seenSubmissions.add(key);}
  else{const row=confirmations.get(key),submission=submissions.get(operationKey(receipt.actorProfileId,operation.submissionOperationId));if(!row||!submission||row.submissionId!==submission.submissionId||row.participantId!==operation.participantId||submission.participantId!==operation.participantId)return false;seenConfirmations.add(key);}
 }
 return seenSubmissions.size===submissions.size&&seenConfirmations.size===confirmations.size;
}

export function isSeriesGameWireRequestV1(v:unknown):v is SeriesGameWireRequestV1{
 if(!exact(v,['operationId','action','gameId','gameNumber','expectedGameVersion','submissionId','confirmationId','priorSubmissionId','winnerParticipantId','confirmedSubmissionId','generationId','generationVersion','sourceDigest','settingsBindingId','reviewId','playoffStartId','parentResultPins'])||!uuid(v.operationId)||!['submit','confirm'].includes(v.action as string)||!uuid(v.gameId)||!integer(v.gameNumber,1,10000)||!integer(v.expectedGameVersion,0,2147483646)||!uuid(v.generationId)||!integer(v.generationVersion,1)||typeof v.sourceDigest!=='string'||!/^[a-f0-9]{64}$/.test(v.sourceDigest)||!uuid(v.settingsBindingId)||!uuid(v.reviewId)||!uuid(v.playoffStartId)||!array(v.parentResultPins)||v.parentResultPins.length!==2)return false;
 const pin=(p:unknown)=>p===null||exact(p,['matchId','resultId','version'])&&uuid(p.matchId)&&uuid(p.resultId)&&integer(p.version,1);if(!v.parentResultPins.every(pin))return false;
 return v.action==='submit'?uuid(v.submissionId)&&v.confirmationId===null&&(v.priorSubmissionId===null||uuid(v.priorSubmissionId))&&uuid(v.winnerParticipantId)&&v.confirmedSubmissionId===null:v.submissionId===null&&uuid(v.confirmationId)&&v.priorSubmissionId===null&&v.winnerParticipantId===null&&uuid(v.confirmedSubmissionId);
}

type Intent={action:'submit';winnerParticipantId:string}|{action:'confirm'};
type AllocatedIds={operationId:string;submissionId:string|null;confirmationId:string|null};
export function buildSeriesGameWireRequestV1(workspace:SeriesGameClientWorkspaceV1,intent:Intent,ids:AllocatedIds):SeriesGameWireRequestV1|null{
 if(!isSeriesGameClientWorkspaceV1(workspace,workspace.actorProfileId)||!exact(ids,['operationId','submissionId','confirmationId'])||!uuid(ids.operationId))return null;
 if(intent.action==='submit'&&(!exact(intent,['action','winnerParticipantId'])||!uuid(intent.winnerParticipantId)||!uuid(ids.submissionId)||ids.confirmationId!==null))return null;
 if(intent.action==='confirm'&&(!exact(intent,['action'])||ids.submissionId!==null||!uuid(ids.confirmationId)))return null;
 if(workspace.submissionRows.some(r=>r.profileId===workspace.actorProfileId&&r.operationId===ids.operationId)||workspace.confirmationRows.some(r=>r.profileId===workspace.actorProfileId&&r.operationId===ids.operationId)||(ids.submissionId&&workspace.submissionRows.some(r=>r.submissionId===ids.submissionId))||(ids.confirmationId&&workspace.confirmationRows.some(r=>r.confirmationId===ids.confirmationId)))return null;
 const projection=projectSeriesGameLoadedV1(workspace.loaded,workspace.actorProfileId);if(projection.status!=='projected_series_game_workspace'||projection.currentGame.gameNumber!==workspace.gameNumber||projection.currentGame.version!==workspace.gameVersion)return null;
 const ownParticipantId=projection.actorParticipantId,ownSubmission=projection.currentGame.ownSubmission;
 const priorRow=ownSubmission?workspace.submissionRows.find(r=>r.operationId===ownSubmission.operationId&&r.participantId===ownParticipantId&&r.profileId===workspace.actorProfileId):undefined;if(ownSubmission&&!priorRow)return null;
 const pureRequest={binding:structuredClone(workspace.loaded.binding),players:structuredClone(workspace.loaded.players),format:structuredClone(projection.format),gameNumber:workspace.gameNumber,expectedVersion:workspace.gameVersion,operation:intent.action==='submit'?{operationId:ids.operationId,participantId:ownParticipantId,action:'submit' as const,winnerParticipantId:intent.winnerParticipantId,priorSubmissionOperationId:ownSubmission?.operationId??null}:{operationId:ids.operationId,participantId:ownParticipantId,action:'confirm' as const,submissionOperationId:ownSubmission?.operationId??''}};
 const planned=planSeriesGameOperationV1(workspace.loaded,pureRequest,workspace.actorProfileId);if(planned.status!=='planned_operation')return null;
 const b=workspace.loaded.binding,request:SeriesGameWireRequestV1={operationId:ids.operationId,action:intent.action,gameId:workspace.gameId,gameNumber:workspace.gameNumber,expectedGameVersion:workspace.gameVersion,submissionId:intent.action==='submit'?ids.submissionId:null,confirmationId:intent.action==='confirm'?ids.confirmationId:null,priorSubmissionId:intent.action==='submit'?priorRow?.submissionId??null:null,winnerParticipantId:intent.action==='submit'?intent.winnerParticipantId:null,confirmedSubmissionId:intent.action==='confirm'?priorRow?.submissionId??null:null,generationId:b.generationId,generationVersion:b.matchVersion,sourceDigest:b.sourceDigest,settingsBindingId:b.settingsBindingId,reviewId:b.reviewId,playoffStartId:b.playoffStartId,parentResultPins:structuredClone(b.parentResultPins)};
 return isSeriesGameWireRequestV1(request)?cloneFreeze(request):null;
}

const rejectionCodes=new Set(['idempotency_conflict','source_unavailable','stale_source','player_identity_required','series_action_limit_reached','game_sequence_closed','game_not_started','stale_game_version','game_identity_conflict','game_already_verified','latest_own_submission_required','submission_identity_conflict','invalid_winner','already_confirmed','confirmation_identity_conflict']);
export type SeriesGameReceiptExpectedV1={actorProfileId:string;tournamentId:string;eventId:string;qualificationId:string;slot:number;request:SeriesGameWireRequestV1};
export type SeriesGameWireReceiptV1=
 |{status:'accepted';action:'submit'|'amend'|'confirm';gameVersion:number;historicalReceipt:boolean;currentSourceVerified:false;requiresFreshWorkspace:true;gameVerified:false}
 |{status:'rejected';code:string;historicalReceipt:boolean;currentSourceVerified:false;requiresFreshWorkspace:true;gameVerified:false}
 |{status:'retry_exact';code:'source_busy'|'operation_busy'|'isolation_not_supported';requiresFreshWorkspace:true;gameVerified:false}
 |{status:'unknown';code:'invalid_response'|'unbound_response'|'not_found';requiresFreshWorkspace:true;gameVerified:false};

function expectedReceipt(v:unknown):v is SeriesGameReceiptExpectedV1{return exact(v,['actorProfileId','tournamentId','eventId','qualificationId','slot','request'])&&uuid(v.actorProfileId)&&uuid(v.tournamentId)&&uuid(v.eventId)&&uuid(v.qualificationId)&&integer(v.slot,1,63)&&isSeriesGameWireRequestV1(v.request);}
function bound(raw:Record<string,unknown>,expected:SeriesGameReceiptExpectedV1){return raw.actorId===expected.actorProfileId&&raw.tournamentId===expected.tournamentId&&raw.eventId===expected.eventId&&raw.qualificationId===expected.qualificationId&&raw.slot===expected.slot&&raw.operationId===expected.request.operationId&&canonical(raw.request)===canonical(expected.request);}

/** A successful ACK, even one containing verifiedGameId, is not current game
 * authority. Only a fresh validated workspace read can establish current state.
 */
export function readSeriesGameWireReceiptV1(value:unknown,expected:SeriesGameReceiptExpectedV1):SeriesGameWireReceiptV1{
 const unknown=(code:'invalid_response'|'unbound_response'|'not_found'):SeriesGameWireReceiptV1=>({status:'unknown',code,requiresFreshWorkspace:true,gameVerified:false});if(!expectedReceipt(expected))return unknown('invalid_response');
 let raw=value;if(exact(value,['authorized','result'])){if(value.authorized!==true)return unknown('invalid_response');if(value.result===null)return unknown('not_found');raw=value.result;}
 if(exact(raw,['status','code'])&&raw.status==='retry_exact'&&(raw.code==='source_busy'||raw.code==='operation_busy'||raw.code==='isolation_not_supported'))return{status:'retry_exact',code:raw.code,requiresFreshWorkspace:true,gameVerified:false};
 if(!object(raw)||raw.status!=='playoff_series_game_action_saved_v1'&&raw.status!=='rejected')return unknown('invalid_response');
 const historical=Object.hasOwn(raw,'historicalReceipt')||Object.hasOwn(raw,'currentSourceVerified'),common=['actorId','tournamentId','eventId','qualificationId','slot','operationId','request'];
 if(!common.every(k=>Object.hasOwn(raw,k))||historical&&(raw.historicalReceipt!==true||raw.currentSourceVerified!==false)||!bound(raw,expected))return unknown('unbound_response');
 if(raw.status==='rejected'){
  const keys=['status','code',...common,...historical?['historicalReceipt','currentSourceVerified']:[]];if(!exact(raw,keys)||typeof raw.code!=='string'||!rejectionCodes.has(raw.code))return unknown('invalid_response');
  return{status:'rejected',code:raw.code,historicalReceipt:historical,currentSourceVerified:false,requiresFreshWorkspace:true,gameVerified:false};
 }
 const keys=['status','eventId','generationId','gameId','gameNumber','gameVersion','action','verifiedGameId','completedResultId','actorId','tournamentId','qualificationId','slot','operationId','request',...historical?['historicalReceipt','currentSourceVerified']:[]];
 const expectedAction=expected.request.action==='confirm'?'confirm':expected.request.priorSubmissionId===null?'submit':'amend';
 if(!exact(raw,keys)||raw.generationId!==expected.request.generationId||raw.gameId!==expected.request.gameId||raw.gameNumber!==expected.request.gameNumber||raw.gameVersion!==expected.request.expectedGameVersion+1||raw.action!==expectedAction||!(raw.verifiedGameId===null||uuid(raw.verifiedGameId))||!(raw.completedResultId===null||uuid(raw.completedResultId)))return unknown('invalid_response');
 return{status:'accepted',action:raw.action as'submit'|'amend'|'confirm',gameVersion:raw.gameVersion as number,historicalReceipt:historical,currentSourceVerified:false,requiresFreshWorkspace:true,gameVerified:false};
}

/** Proves that a fresh normalized workspace retained the exact accepted own
 * operation and its distinct SQL evidence-row mapping. It does not claim the
 * operation is still latest or that the game is verified.
 */
export function workspaceIncludesWireOperationV1(workspace:SeriesGameClientWorkspaceV1,expected:SeriesGameReceiptExpectedV1):boolean{
 if(!isSeriesGameClientWorkspaceV1(workspace,expected.actorProfileId)||!expectedReceipt(expected))return false;
 const b=workspace.loaded.binding,r=expected.request,gameRow=workspace.gameRows.find(row=>row.gameNumber===r.gameNumber);if(!gameRow||gameRow.gameId!==r.gameId||gameRow.state!=='persisted'||gameRow.gameVersion<r.expectedGameVersion+1||b.tournamentId!==expected.tournamentId||b.eventId!==expected.eventId||b.qualificationId!==expected.qualificationId||b.slot!==expected.slot||b.generationId!==r.generationId||b.matchVersion!==r.generationVersion||b.sourceDigest!==r.sourceDigest||b.settingsBindingId!==r.settingsBindingId||b.reviewId!==r.reviewId||b.playoffStartId!==r.playoffStartId||canonical(b.parentResultPins)!==canonical(r.parentResultPins))return false;
 const game=workspace.loaded.games.find(g=>g.gameNumber===r.gameNumber),receipt=game?.operations.find(o=>o.request.operation.operationId===r.operationId&&o.actorProfileId===expected.actorProfileId);if(!receipt||receipt.request.expectedVersion!==r.expectedGameVersion)return false;
 const operation=receipt.request.operation;if(operation.action!==r.action)return false;
 if(operation.action==='submit'){
  const row=workspace.submissionRows.find(x=>x.operationId===r.operationId&&x.profileId===receipt.actorProfileId);if(!row||row.submissionId!==r.submissionId||row.participantId!==operation.participantId||row.winnerParticipantId!==r.winnerParticipantId||operation.winnerParticipantId!==r.winnerParticipantId)return false;
  if(operation.priorSubmissionOperationId===null)return r.priorSubmissionId===null;
  const prior=workspace.submissionRows.find(x=>x.operationId===operation.priorSubmissionOperationId&&x.profileId===receipt.actorProfileId);return !!prior&&prior.submissionId===r.priorSubmissionId&&prior.participantId===operation.participantId;
 }
 const row=workspace.confirmationRows.find(x=>x.operationId===r.operationId&&x.profileId===receipt.actorProfileId),submission=workspace.submissionRows.find(x=>x.operationId===operation.submissionOperationId&&x.profileId===receipt.actorProfileId);return !!row&&!!submission&&row.confirmationId===r.confirmationId&&row.submissionId===r.confirmedSubmissionId&&submission.submissionId===r.confirmedSubmissionId&&row.participantId===operation.participantId&&submission.participantId===operation.participantId;
}
