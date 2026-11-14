import'server-only';
import{readNativePlayoffSportingFrameV1}from'./native-playoff-sporting-frame-v1.ts';
import type{QualificationResult}from'../api/qualification-finalization.ts';
import type{EventScheduleWorkspace}from'../api/event-schedule.ts';
import{playoffCorrectionPlainV1 as plain,playoffCorrectionExactV1 as exact,playoffCorrectionSameV1 as same}from'../playoffs/native-mixed-playoff-reopen-v1.ts';
/** Normal-auth source intake only. The actual SQL producer verifies locked rows,
 * receipts and current generations; arbitrary posted JSON grants no authority. */
export function readNativePlayoffMrpSourceV1(value:unknown,scope:{tournamentId:string;eventId:string},identity:{actorId:string;sessionId:string}|undefined,q:QualificationResult,eventKind:'main'|'consolation',participants:EventScheduleWorkspace['participants']){
 const fail=(code:string,fatal=false)=>({status:'blocked' as const,code,fatal});try{
 if(value===null||value===undefined)return fail('native_playoff_source_unavailable');if(!plain(value))return fail('native_playoff_source_invalid');
 if(value&&typeof value==='object'&&!Array.isArray(value)&&(value as Record<string,unknown>).status==='blocked'&&(value as Record<string,unknown>).code==='qualification_source_changed')return fail('qualification_source_changed',true);
 if(!exact(value,['status','kind','actorId','sessionId','tournamentId','eventId','qualification','eventKind','binding','draft','playoff','readOnly','actualMrpAwarded','accSubmissionPerformed','sourceConsistency','sourceDigest'])||value.status!=='source_available'||value.kind!=='native-playoff-sporting-source-v1'||value.readOnly!==true||value.actualMrpAwarded!==false||value.accSubmissionPerformed!==false||value.sourceConsistency!=='locked_database_capture')return fail('native_playoff_source_unavailable');
 if(!identity||value.actorId!==identity.actorId||value.sessionId!==identity.sessionId||value.tournamentId!==scope.tournamentId||value.eventId!==scope.eventId||value.eventKind!==eventKind)return fail('native_playoff_scope_changed',true);
 const qualification={resultVersionId:q.resultVersionId,version:q.version,participantCount:q.participantCount,qualifierCount:q.qualifierCount};if(!same(value.qualification,qualification))return fail('qualification_source_changed',true);
 const result=readNativePlayoffSportingFrameV1({playoff:value.playoff,sourceDigest:value.sourceDigest},{actorId:identity.actorId,...scope},qualification,value.binding,eventKind,value.draft);if(result.status!=='available')return fail(result.code);
 if(result.frame.players.length!==q.qualifiers.length||result.frame.players.some(p=>{const qualifier=q.qualifiers.find(x=>x.participantId===p.participantId),people=participants.filter(x=>x.eventId===scope.eventId&&x.participantId===p.participantId);return!qualifier||qualifier.qualificationRank!==p.seed||qualifier.displayName!==p.displayName||people.length!==1||people[0].verificationId!==p.tournamentPlayerId||people[0].displayName!==p.displayName;}))return fail('native_player_qualification_changed',true);
 return{status:'available' as const,input:result.input,display:result.display,origin:'native-digital-protocol-origin-unverified' as const};
 }catch{return fail('native_playoff_source_invalid');}
}
