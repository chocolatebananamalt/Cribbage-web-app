import { integratedTestUiEnabled as integratedTestFeatureEnabled } from '../integrated-test-target.ts';
import {isUuid} from '../api/validation.ts';
import {isSeriesGameWireRequestV1,type SeriesGameWireRequestV1} from './series-game-client-transport-v1.ts';
export const selectedStepPlayerPageEnabledV3=()=>integratedTestFeatureEnabled();
export const selectedStepPlayerRoutesEnabledV3=()=>integratedTestFeatureEnabled();
export const selectedStepPlayerWritesVerifiedV3=()=>integratedTestFeatureEnabled();
export type SelectedStepPlayerScopeV3={actorId:string;tournamentId:string;eventId:string;qualificationId:string;slot:number;generationId:string};
type Pin=null|{matchId:string;resultId:string;version:number};
export type SelectedStepPlayerViewV3={status:'player_game_available';kind:'selected-step-player-game-v3';tournamentId:string;eventId:string;qualificationId:string;slot:number;generationId:string;generationVersion:number;round:'regular'|'semifinal'|'final';sourceDigest:string;settingsBindingId:string;reviewId:string;playoffStartId:string;parentResultPins:[Pin,Pin];actorParticipantId:string;players:[{participantId:string;displayName:string;tournamentPlayerId:string},{participantId:string;displayName:string;tournamentPlayerId:string}];winsRequired:number;maximumGames:number;wins:[number,number];seriesComplete:boolean;gameNumber:number;gameId:string|null;gameVersion:number;ownSubmission:null|{submissionId:string;winnerParticipantId:string};ownConfirmed:boolean;opponentSubmitted:boolean;paperVerificationClaimed:false;moneyMoved:false};
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>obj(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=(v:unknown):v is string=>isUuid(v)&&v===v.toLowerCase();
const int=(v:unknown,min=0,max=2147483646):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
export const selectedStepSameV3=(a:unknown,b:unknown)=>JSON.stringify(a,(_k,v)=>obj(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)===JSON.stringify(b,(_k,v)=>obj(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export function isSelectedStepPlayerScopeV3(v:unknown):v is SelectedStepPlayerScopeV3{return exact(v,['actorId','tournamentId','eventId','qualificationId','slot','generationId'])&&[v.actorId,v.tournamentId,v.eventId,v.qualificationId,v.generationId].every(uuid)&&int(v.slot,1,63);}
export function readSelectedStepPlayerViewV3(v:unknown,s:SelectedStepPlayerScopeV3):SelectedStepPlayerViewV3|null{
 if(!isSelectedStepPlayerScopeV3(s)||!exact(v,['status','kind','tournamentId','eventId','qualificationId','slot','generationId','generationVersion','round','sourceDigest','settingsBindingId','reviewId','playoffStartId','parentResultPins','actorParticipantId','players','winsRequired','maximumGames','wins','seriesComplete','gameNumber','gameId','gameVersion','ownSubmission','ownConfirmed','opponentSubmitted','paperVerificationClaimed','moneyMoved'])
  ||v.status!=='player_game_available'||v.kind!=='selected-step-player-game-v3'||!['tournamentId','eventId','qualificationId','slot','generationId'].every(k=>v[k]===s[k as keyof typeof s])
  ||![v.settingsBindingId,v.reviewId,v.playoffStartId,v.actorParticipantId].every(uuid)||!int(v.generationVersion,1)||!['regular','semifinal','final'].includes(String(v.round))||typeof v.sourceDigest!=='string'||!/^[a-f0-9]{64}$/.test(v.sourceDigest)
  ||!Array.isArray(v.players)||v.players.length!==2||!v.players.every(p=>exact(p,['participantId','displayName','tournamentPlayerId'])&&uuid(p.participantId)&&typeof p.displayName==='string'&&p.displayName.trim()===p.displayName&&p.displayName.length>0&&p.displayName.length<=200&&!/[\u0000-\u001f\u007f]/.test(p.displayName)&&typeof p.tournamentPlayerId==='string'&&/^[A-Z]-[1-9][0-9]{0,3}$/.test(p.tournamentPlayerId))
  ||v.players[0].participantId===v.players[1].participantId||!v.players.some(p=>p.participantId===v.actorParticipantId)
  ||!int(v.winsRequired,1,1250)||v.maximumGames!==v.winsRequired*2-1||!Array.isArray(v.wins)||v.wins.length!==2||!v.wins.every(n=>int(n,0,v.winsRequired as number))
  ||typeof v.seriesComplete!=='boolean'||!int(v.gameNumber,1,v.maximumGames as number)||!int(v.gameVersion)||!(v.gameId===null||uuid(v.gameId))||typeof v.ownConfirmed!=='boolean'||typeof v.opponentSubmitted!=='boolean'||v.paperVerificationClaimed!==false||v.moneyMoved!==false
  ||!Array.isArray(v.parentResultPins)||v.parentResultPins.length!==2||!v.parentResultPins.every(p=>p===null||exact(p,['matchId','resultId','version'])&&uuid(p.matchId)&&uuid(p.resultId)&&int(p.version,1)))return null;
 const own=v.ownSubmission;
 if(own!==null&&(!exact(own,['submissionId','winnerParticipantId'])||!uuid(own.submissionId)||!v.players.some(p=>p.participantId===own.winnerParticipantId)))return null;
 if(v.ownConfirmed&&own===null||v.gameId===null&&(v.gameVersion!==0||own!==null||v.ownConfirmed)||own!==null&&v.gameVersion<1||v.ownConfirmed&&v.gameVersion<2
  ||(Math.max(...v.wins as number[])===v.winsRequired)!==v.seriesComplete||Math.min(...v.wins as number[])>=v.winsRequired
  ||v.gameNumber!==(v.wins as number[]).reduce((n,x)=>n+x,0)+(v.seriesComplete?0:1))return null;
 return structuredClone(v)as SelectedStepPlayerViewV3;
}
export type SelectedStepPendingV3={kind:'selected-step-player-pending-v3';scope:SelectedStepPlayerScopeV3;request:SeriesGameWireRequestV1};
export function readSelectedStepPendingV3(v:unknown,s:SelectedStepPlayerScopeV3):SelectedStepPendingV3|null{return exact(v,['kind','scope','request'])&&v.kind==='selected-step-player-pending-v3'&&isSelectedStepPlayerScopeV3(v.scope)&&selectedStepSameV3(v.scope,s)&&isSeriesGameWireRequestV1(v.request)&&v.request.generationId===s.generationId?structuredClone(v)as SelectedStepPendingV3:null;}
export function selectedStepPlayerRequestV3(view:SelectedStepPlayerViewV3,action:'submit'|'confirm',winner:string|null,makeId:()=>string):SeriesGameWireRequestV1|null{
 if(view.seriesComplete||action==='confirm'&&(!view.ownSubmission||view.ownConfirmed))return null;
 const r={operationId:makeId(),action,gameId:view.gameId??makeId(),gameNumber:view.gameNumber,expectedGameVersion:view.gameVersion,submissionId:action==='submit'?makeId():null,confirmationId:action==='confirm'?makeId():null,priorSubmissionId:action==='submit'?view.ownSubmission?.submissionId??null:null,winnerParticipantId:action==='submit'?winner:null,confirmedSubmissionId:action==='confirm'?view.ownSubmission!.submissionId:null,generationId:view.generationId,generationVersion:view.generationVersion,sourceDigest:view.sourceDigest,settingsBindingId:view.settingsBindingId,reviewId:view.reviewId,playoffStartId:view.playoffStartId,parentResultPins:view.parentResultPins};
 return isSeriesGameWireRequestV1(r)&&(!winner||view.players.some(p=>p.participantId===winner))?r:null;
}
