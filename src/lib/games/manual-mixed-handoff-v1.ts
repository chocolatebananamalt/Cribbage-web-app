import { integratedTestUiEnabled as integratedTestFeatureEnabled } from '../integrated-test-target.ts';
import {isUuid} from '../api/validation.ts';
import {deriveScore} from '../score.ts';
export const manualMixedHandoffEnabledV1=()=>integratedTestFeatureEnabled();
export type ManualMixedHandoffV1={kind:'manual-mixed-handoff-v1';actorId:string;gameId:string;gameVersion:number;submission:{id:string;winnerSide:'a'|'b';margin:number};paperPlayer:{displayName:string;side:'a'|'b';tableSeat:string;verificationId:string};digitalPlayer:{displayName:string;side:'a'|'b';tableSeat:string;verificationId:string};response:null|{operationId:string;decision:'yes'|'no';recordedAt:string};canRespond:boolean;tentative:true;verified:false};
export type ManualMixedResponseV1={submissionId:string;gameVersion:number;operationId:string;decision:'yes'|'no'};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function isManualMixedResponseV1(v:unknown):v is ManualMixedResponseV1{return object(v)&&Object.keys(v).length===4&&isUuid(v.submissionId)&&isUuid(v.operationId)&&Number.isSafeInteger(v.gameVersion)&&Number(v.gameVersion)>0&&['yes','no'].includes(String(v.decision));}
export function readManualMixedHandoffV1(v:unknown,actorId:string,gameId:string):ManualMixedHandoffV1|null{
 if(!object(v)||Object.keys(v).length!==11||v.kind!=='manual-mixed-handoff-v1'||v.actorId!==actorId||v.gameId!==gameId||!isUuid(actorId)||!isUuid(gameId)||!Number.isSafeInteger(v.gameVersion)||Number(v.gameVersion)<1||typeof v.canRespond!=='boolean'||v.tentative!==true||v.verified!==false||!object(v.submission)||Object.keys(v.submission).length!==3||!isUuid(v.submission.id)||!['a','b'].includes(String(v.submission.winnerSide))||!Number.isInteger(v.submission.margin)||Number(v.submission.margin)<1||Number(v.submission.margin)>121)return null;
 for(const p of [v.paperPlayer,v.digitalPlayer])if(!object(p)||Object.keys(p).length!==4||typeof p.displayName!=='string'||!p.displayName||!['a','b'].includes(String(p.side))||typeof p.tableSeat!=='string'||typeof p.verificationId!=='string'||!(/^[A-Z]-[1-9][0-9]*$/).test(p.verificationId))return null;
 if((v.paperPlayer as Record<string,unknown>).side===(v.digitalPlayer as Record<string,unknown>).side)return null;
 if(v.response!==null&&(!object(v.response)||Object.keys(v.response).length!==3||!isUuid(v.response.operationId)||!['yes','no'].includes(String(v.response.decision))||typeof v.response.recordedAt!=='string'||!Number.isFinite(Date.parse(v.response.recordedAt))))return null;
 return v as ManualMixedHandoffV1;
}
export function tentativePaperResultV1(v:ManualMixedHandoffV1){const score=deriveScore(v.submission.margin,v.submission.winnerSide===v.paperPlayer.side?'player':'opponent');return{gamePoints:score.playerGamePoints,plus:score.playerPlus,minus:score.playerMinus,verified:false as const,countsForFinalization:false as const,disputed:v.response?.decision==='no'};}

/** A current observation can retire only this exact retained operation. Version
 * drift is held: the response DTO does not expose its historical game version. */
export function isAcknowledgedManualMixedResponseV1(value:unknown,actorId:string,gameId:string,request:ManualMixedResponseV1):boolean {
 if(!isManualMixedResponseV1(request))return false;
 const view=readManualMixedHandoffV1(value,actorId,gameId);
 return !!view&&view.gameVersion===request.gameVersion&&view.submission.id===request.submissionId&&view.response?.operationId===request.operationId&&view.response.decision===request.decision;
}
