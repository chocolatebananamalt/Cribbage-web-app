import{isSeriesFormatV1,type SeriesFormatV1}from'./series-settings-v1.ts';
export type SeriesGameBindingV1={tournamentId:string;eventId:string;activationId:string;generationId:string;settingsBindingId:string;reviewId:string;qualificationId:string;playoffStartId:string;sourceDigest:string;matchId:string;matchVersion:number;slot:number;round:'regular'|'semifinal'|'final';parentResultPins:[{matchId:string;resultId:string;version:number}|null,{matchId:string;resultId:string;version:number}|null]};
export type SeriesGamePlayerV1={participantId:string;profileId:string|null;cardMode:'digital'|'paper'};
export type SeriesGameOperationV1={operationId:string;participantId:string;action:'submit';winnerParticipantId:string;priorSubmissionOperationId:string|null}|{operationId:string;participantId:string;action:'confirm';submissionOperationId:string};
export type SeriesGameRequestV1={binding:SeriesGameBindingV1;players:[SeriesGamePlayerV1,SeriesGamePlayerV1];format:SeriesFormatV1;gameNumber:number;expectedVersion:number;operation:SeriesGameOperationV1};
export type SeriesGameReceiptV1={version:number;actorProfileId:string;request:SeriesGameRequestV1};
export type SeriesGameLoadedV1={binding:SeriesGameBindingV1;settings:{settingsBindingId:string;regular:SeriesFormatV1;final:SeriesFormatV1};players:[SeriesGamePlayerV1,SeriesGamePlayerV1];evidence:'native-digital';games:Array<{gameNumber:number;operations:SeriesGameReceiptV1[]}>};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(v);
const integer=(v:unknown,min=0):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=2147483647&&!Object.is(v,-0);
const array=(v:unknown):v is unknown[]=>Array.isArray(v)&&Reflect.ownKeys(v).length===v.length+1;
const canonical=(v:unknown)=>JSON.stringify(v,(_k,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
// Mirrors SQL actor-scoped operation identity. Players may share a UUID; it is
// never a globally unique submission row identifier or cross-player lookup key.
const operationKey=(actorProfileId:string,operationId:string)=>actorProfileId+':'+operationId;
function freeze<T>(v:T):T{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
const copy=<T>(v:T):T=>freeze(JSON.parse(canonical(v))as T);
function binding(v:unknown):v is SeriesGameBindingV1{
 if(!exact(v,['tournamentId','eventId','activationId','generationId','settingsBindingId','reviewId','qualificationId','playoffStartId','sourceDigest','matchId','matchVersion','slot','round','parentResultPins'])||![v.tournamentId,v.eventId,v.activationId,v.generationId,v.settingsBindingId,v.reviewId,v.qualificationId,v.playoffStartId,v.matchId].every(uuid)||!integer(v.matchVersion,1)||!integer(v.slot,1)||!['regular','semifinal','final'].includes(v.round as string)||typeof v.sourceDigest!=='string'||!/^[a-f0-9]{64}$/.test(v.sourceDigest)||!array(v.parentResultPins)||v.parentResultPins.length!==2)return false;
 const matches=new Set<string>(),results=new Set<string>();for(const p of v.parentResultPins){if(p===null)continue;if(!exact(p,['matchId','resultId','version'])||!uuid(p.matchId)||!uuid(p.resultId)||!integer(p.version,1)||p.matchId===v.matchId||matches.has(p.matchId)||results.has(p.resultId))return false;matches.add(p.matchId);results.add(p.resultId);}return v.round!=='final'||v.parentResultPins.every(p=>p!==null);
}
function players(v:unknown):v is[SeriesGamePlayerV1,SeriesGamePlayerV1]{return array(v)&&v.length===2&&v.every(p=>exact(p,['participantId','profileId','cardMode'])&&uuid(p.participantId)&&(p.profileId===null||uuid(p.profileId))&&(p.cardMode==='digital'||p.cardMode==='paper'))&&(v[0]as SeriesGamePlayerV1).participantId!==(v[1]as SeriesGamePlayerV1).participantId;}
function operation(v:unknown):v is SeriesGameOperationV1{return object(v)&&uuid(v.operationId)&&uuid(v.participantId)&&(v.action==='submit'?exact(v,['operationId','participantId','action','winnerParticipantId','priorSubmissionOperationId'])&&uuid(v.winnerParticipantId)&&(v.priorSubmissionOperationId===null||uuid(v.priorSubmissionOperationId)):v.action==='confirm'&&exact(v,['operationId','participantId','action','submissionOperationId'])&&uuid(v.submissionOperationId));}
function request(v:unknown):v is SeriesGameRequestV1{return exact(v,['binding','players','format','gameNumber','expectedVersion','operation'])&&binding(v.binding)&&players(v.players)&&isSeriesFormatV1(v.format)&&integer(v.gameNumber,1)&&integer(v.expectedVersion)&&operation(v.operation);}
type GameState={gameNumber:number;version:number;status:'pending'|'conflicted'|'verified';winnerParticipantId:string|null;submissions:[{id:string;winner:string}|null,{id:string;winner:string}|null];confirmations:[string|null,string|null];confirmationOperationIds:[string|null,string|null]};
function apply(state:GameState,r:SeriesGameRequestV1,actor:string,ps:[SeriesGamePlayerV1,SeriesGamePlayerV1]):string|null{
 if(state.status==='verified')return'game_verified_immutable';const side=ps.findIndex(p=>p.participantId===r.operation.participantId);if(side<0||ps[side].profileId!==actor)return'player_identity_mismatch';const index=side as 0|1,op=r.operation;
 if(op.action==='submit'){
  if(!ps.some(p=>p.participantId===op.winnerParticipantId))return'foreign_winner';const previous=state.submissions[index];if((previous?.id??null)!==op.priorSubmissionOperationId)return'stale_submission';state.submissions[index]={id:op.operationId,winner:op.winnerParticipantId};state.confirmations[index]=null;state.confirmationOperationIds[index]=null;
 }else{const own=state.submissions[index];if(!own||own.id!==op.submissionOperationId)return'confirmation_not_latest_own_submission';if(state.confirmations[index]===own.id)return'already_confirmed';state.confirmations[index]=own.id;state.confirmationOperationIds[index]=op.operationId;}
 state.version++;const[a,b]=state.submissions;state.status=a&&b?(a.winner!==b.winner?'conflicted':state.confirmations[0]===a.id&&state.confirmations[1]===b.id?'verified':'pending'):'pending';state.winnerParticipantId=state.status==='verified'?a!.winner:null;return null;
}
const noAuthority={advancementAllowed:false as const,verificationPersisted:false as const,databaseWriteAllowed:false as const,qualifyingScoresChanged:false as const,moneyMoved:false as const};
/** Pure semantic model over native server-loaded history and a separately
 * verified auth actor. Director checkboxes, paper and synthetic evidence cannot
 * replace two distinct player profiles. No qualifying game/card row is touched.
 * Binding.matchVersion is an immutable generation fence; expectedVersion is
 * per-game operation sequence. Reviewed corrections need a separate generation
 * protocol; this model never silently rebases older evidence.
 *
 * SQL wire normalization is NOT implemented/proved here. SQL priorSubmissionId
 * identifies an immutable submission ROW; priorSubmissionOperationId identifies
 * its operation. A future adapter must resolve row-to-operation under the same
 * tournament/event/match/generation/game/player ownership and latest-submission
 * locks. Confirmation row IDs need the same mapping. Never merely rename/cast
 * these UUIDs; the SQL 17-key request is not this pure DTO. Runtime parity remains
 * unproved until the real transaction adapter is tested.
 */
function deriveLoaded(loaded:unknown,verifiedActorProfileId:unknown,proposed?:SeriesGameRequestV1){
 const fail=(code:string)=>({status:'blocked' as const,code,...noAuthority});
 if(!exact(loaded,['binding','settings','players','evidence','games'])||!binding(loaded.binding)||!players(loaded.players)||!exact(loaded.settings,['settingsBindingId','regular','final'])||loaded.settings.settingsBindingId!==loaded.binding.settingsBindingId||!isSeriesFormatV1(loaded.settings.regular)||!isSeriesFormatV1(loaded.settings.final)||!array(loaded.games)||!uuid(verifiedActorProfileId))return fail('invalid_input');
 if(loaded.evidence!=='native-digital')return fail('unsupported_evidence');
 const ps=loaded.players;if(ps.some(p=>p.cardMode!=='digital'))return fail('paper_scoring_unsupported');if(ps.some(p=>p.profileId===null)||ps[0].profileId===ps[1].profileId)return fail('two_distinct_native_profiles_required');
 const format=loaded.binding.round==='final'?loaded.settings.final:loaded.settings.regular;
 // This module processes at most10,000 operation records. A verified game
 // requires at least four actions; reject an unfinishable declared format.
 // Technical bound only, not an ACC maximum and never a shortened series.
 if(format.maximumGames*4>10000)return fail('technical_format_bound');
 if(proposed){if(canonical(proposed.binding)!==canonical(loaded.binding))return fail('stale_source_binding');if(canonical(proposed.players)!==canonical(ps))return fail('stale_player_binding');if(canonical(proposed.format)!==canonical(format))return fail('stale_round_format');
 if(!ps.some(p=>p.profileId===verifiedActorProfileId&&p.participantId===proposed.operation.participantId))return fail('player_identity_mismatch');}
 if(!ps.some(p=>p.profileId===verifiedActorProfileId))return fail('player_identity_mismatch');
 const acceptedOperationCount=loaded.games.reduce<number>((n,g)=>n+(object(g)&&Array.isArray(g.operations)?g.operations.length:0),0);
 if(loaded.games.length>10000||acceptedOperationCount>10000)return fail('technical_history_bound');
 const states:GameState[]=[],operations=new Map<string,SeriesGameReceiptV1>();const wins:[number,number]=[0,0];let seriesWinner:string|null=null;
 for(const[index,g]of loaded.games.entries()){
  if(seriesWinner!==null)return fail('games_after_series_complete');if(!exact(g,['gameNumber','operations'])||g.gameNumber!==index+1||!array(g.operations)||index>=format.maximumGames)return fail('invalid_game_sequence');if(index>0&&states[index-1].status!=='verified')return fail('prior_game_not_verified');
  const state:GameState={gameNumber:index+1,version:0,status:'pending',winnerParticipantId:null,submissions:[null,null],confirmations:[null,null],confirmationOperationIds:[null,null]};
  for(const raw of g.operations){if(!exact(raw,['version','actorProfileId','request'])||!uuid(raw.actorProfileId)||!request(raw.request)||raw.version!==state.version+1||raw.request.expectedVersion!==state.version||raw.request.gameNumber!==state.gameNumber||canonical(raw.request.binding)!==canonical(loaded.binding)||canonical(raw.request.players)!==canonical(ps)||canonical(raw.request.format)!==canonical(format)||operations.has(operationKey(raw.actorProfileId,raw.request.operation.operationId)))return fail('invalid_operation_history');const error=apply(state,raw.request,raw.actorProfileId,ps);if(error)return fail(error);operations.set(operationKey(raw.actorProfileId,raw.request.operation.operationId),raw as SeriesGameReceiptV1);}
  states.push(state);if(state.status==='verified'){const side=ps.findIndex(p=>p.participantId===state.winnerParticipantId)as 0|1;wins[side]++;if(wins[side]===format.winsRequired)seriesWinner=state.winnerParticipantId;}
 }
 return{status:'derived' as const,states,operations,wins,seriesWinner,acceptedOperationCount,format,players:ps,binding:loaded.binding,actorProfileId:verifiedActorProfileId};
}
export function planSeriesGameOperationV1(loaded:unknown,proposed:unknown,verifiedActorProfileId:unknown){
 const fail=(code:string)=>({status:'blocked' as const,code,...noAuthority});
 if(!request(proposed))return fail('invalid_input');const derived=deriveLoaded(loaded,verifiedActorProfileId,proposed);if(derived.status==='blocked')return derived;
 const{states,operations,wins,acceptedOperationCount,format,players:ps,actorProfileId}=derived;let{seriesWinner}=derived; const old=operations.get(operationKey(actorProfileId,proposed.operation.operationId));let nextReceipt:SeriesGameReceiptV1|null=null;
 if(old){if(old.actorProfileId!==actorProfileId||canonical(old.request)!==canonical(proposed))return fail('operation_conflict');}
 else{
  if(acceptedOperationCount>=10000)return fail('technical_history_bound');
  let target=states.find(s=>s.gameNumber===proposed.gameNumber);
  if(target?.status==='verified')return fail('game_verified_immutable');if(seriesWinner!==null)return fail('games_after_series_complete');
  if(!target){if(proposed.gameNumber!==states.length+1||proposed.gameNumber>format.maximumGames||(states.length>0&&states.at(-1)!.status!=='verified'))return fail('prior_game_not_verified');target={gameNumber:proposed.gameNumber,version:0,status:'pending',winnerParticipantId:null,submissions:[null,null],confirmations:[null,null],confirmationOperationIds:[null,null]};states.push(target);}
  if(proposed.expectedVersion!==target.version)return fail('stale_game_version');const error=apply(target,proposed,actorProfileId,ps);if(error)return fail(error);nextReceipt=copy({version:target.version,actorProfileId:actorProfileId,request:proposed});if(target.status==='verified'){const side=ps.findIndex(p=>p.participantId===target!.winnerParticipantId)as 0|1;wins[side]++;if(wins[side]===format.winsRequired)seriesWinner=target.winnerParticipantId;}
 }
 const last=states.at(-1),nextGameNumber=seriesWinner?null:last?.status==='verified'?states.length+1:last?.gameNumber??1;
 return{status:old?'operation_replay' as const:'planned_operation' as const,nextReceipt,games:copy(states),series:{wins,complete:seriesWinner!==null,winnerParticipantId:seriesWinner,nextGameNumber},format:copy(format),...noAuthority};
}
/** Read-only history derivation. It constructs no trial operation/receipt and
 * changes no submitted history. A derived verified status is not a DB ACK.
 */
export function projectSeriesGameLoadedV1(loaded:unknown,verifiedActorProfileId:unknown){
 const d=deriveLoaded(loaded,verifiedActorProfileId);if(d.status==='blocked')return d;
 const actorIndex=d.players.findIndex(p=>p.profileId===d.actorProfileId)as 0|1,last=d.states.at(-1),nextGameNumber=d.seriesWinner?null:last?.status==='verified'?d.states.length+1:last?.gameNumber??1;
 const active=d.seriesWinner?last:d.states.find(g=>g.gameNumber===nextGameNumber),own=active?.submissions[actorIndex]??null;
 return{status:'projected_series_game_workspace' as const,binding:copy(d.binding),players:copy(d.players),format:copy(d.format),actorParticipantId:d.players[actorIndex].participantId,
  games:copy(d.states),currentGame:{gameNumber:active?.gameNumber??nextGameNumber??1,version:active?.version??0,status:active?.status??'not_started' as const,
   ownSubmission:own?copy({operationId:own.id,winnerParticipantId:own.winner}):null,ownConfirmationOperationId:active?.confirmationOperationIds[actorIndex]??null,ownConfirmedSubmissionOperationId:active?.confirmations[actorIndex]??null},
  series:{wins:copy(d.wins),complete:d.seriesWinner!==null,winnerParticipantId:d.seriesWinner,nextGameNumber},operationCapacityRemaining:10000-d.acceptedOperationCount,...noAuthority};
}
