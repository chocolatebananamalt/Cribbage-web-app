import{readPlayoffPaperWorkspaceV1,readPlayoffPaperReceiptV1,readPlayoffPaperPreparedV1,buildPlayoffPaperRequestV1,type PlayoffPaperPreparedV1,type PlayoffPaperReceiptV1,type PlayoffPaperWorkspaceV1}from'./native-mixed-playoff-paper-v1.ts';
import{playoffCorrectionPlainV1 as plain,playoffCorrectionExactV1 as exact,playoffCorrectionSameV1 as same,playoffCorrectionUuidV1 as uuid}from'./native-mixed-playoff-reopen-v1.ts';
type Flags={writeAuthorized:false;simulationOnly:true;ordinaryQualificationRecorded:false;mrpAwarded:false;moneyMoved:false};
type Base=Flags&{actorId:string;sessionId:string;tournamentId:string;eventId:string;operationId:string;request:PlayoffPaperPreparedV1['request']};
export type PlayoffPaperClosureV1=Base&{kind:'native-mixed-playoff-own-closure-receipt-v1';status:'closed';code:'source_changed'|'history_changed'|'match_or_game_changed';historicalReceipt:boolean;currentSourceVerified:false;noWriteCommitted:true};
export type PlayoffPaperRecoveryV1=Base&{kind:'native-mixed-playoff-paper-operation-v1'}&({status:'retry-original';currentWorkspace:PlayoffPaperWorkspaceV1;currentSourceVerified:true}|{status:'accepted'|'superseded';receipt:PlayoffPaperReceiptV1;currentWorkspace:PlayoffPaperWorkspaceV1;currentSourceVerified:true;reopenId?:string}|{status:'closed';closureReceipt:PlayoffPaperClosureV1;currentSourceVerified:false});
const keys=['kind','status','actorId','sessionId','tournamentId','eventId','operationId','request','writeAuthorized','simulationOnly','ordinaryQualificationRecorded','mrpAwarded','moneyMoved'];
function bound(v:Record<string,unknown>,p:PlayoffPaperPreparedV1){return plain(p)&&!!readPlayoffPaperPreparedV1(p,p.target)&&v.actorId===p.target.actorId&&v.sessionId===p.target.sessionId&&v.tournamentId===p.target.tournamentId&&v.eventId===p.target.eventId&&v.operationId===p.operationId&&same(v.request,p.request)&&v.writeAuthorized===false&&v.simulationOnly===true&&v.ordinaryQualificationRecorded===false&&v.mrpAwarded===false&&v.moneyMoved===false;}
export function readPlayoffPaperClosureV1(v:unknown,p:PlayoffPaperPreparedV1):PlayoffPaperClosureV1|null{try{
 if(!plain(v)||!exact(v,[...keys,'code','historicalReceipt','currentSourceVerified','noWriteCommitted'])||v.kind!=='native-mixed-playoff-own-closure-receipt-v1'||v.status!=='closed'||!bound(v,p)||!['source_changed','history_changed','match_or_game_changed'].includes(v.code as string)||typeof v.historicalReceipt!=='boolean'||v.currentSourceVerified!==false||v.noWriteCommitted!==true)return null;
 return structuredClone(v)as PlayoffPaperClosureV1;
}catch{return null;}}
/** Full normal-auth RPC proof, not client cryptographic authority. A bare error,
 * receipt alone, different SID or guessed head never authorizes pending clear. */
export function readPlayoffPaperRecoveryV1(v:unknown,p:PlayoffPaperPreparedV1):PlayoffPaperRecoveryV1|null{try{
 if(!plain(v)||!v||typeof v!=='object'||Array.isArray(v))return null;const x=v as Record<string,unknown>,wanted=[...keys,'currentSourceVerified'];
 if(x.status==='closed')wanted.push('closureReceipt');else if(x.status==='retry-original')wanted.push('currentWorkspace');else if(x.status==='accepted'||x.status==='superseded'){wanted.push('receipt','currentWorkspace');if(x.status==='superseded')wanted.push('reopenId');}else return null;
 if(!exact(x,wanted)||x.kind!=='native-mixed-playoff-paper-operation-v1'||!bound(x,p))return null;
 if(x.status==='closed')return x.currentSourceVerified===false&&readPlayoffPaperClosureV1(x.closureReceipt,p)?structuredClone(x)as PlayoffPaperRecoveryV1:null;
 const w=readPlayoffPaperWorkspaceV1(x.currentWorkspace,p.target),r=p.request;if(x.currentSourceVerified!==true||!w||w.sourceDigest!==r.expectedSourceDigest||w.matchDigest!==r.data.expectedMatchDigest)return null;
 if(x.status==='retry-original'){
  const e=r.data.entry,claims=e.type==='paper-capture'?e.claims:e.reenteredClaims,answers=Object.fromEntries(claims.map(c=>[c.participantId,c.winnerParticipantId])),q=buildPlayoffPaperRequestV1(w,answers,e.type==='paper-capture'?e.artifactId:undefined);
  return q&&same(q,r)?structuredClone(x)as PlayoffPaperRecoveryV1:null;
 }
 const a=readPlayoffPaperReceiptV1(x.receipt,r);if(!a||a.historicalReceipt!==true||a.currentSourceVerified!==false)return null;const e=w.ownEvidence,q=r.data.entry;
 if(x.status==='accepted'){
  if(!e||e.id!==a.entryId||e.type!==q.type||w.revision<a.revision||e.artifactId!==q.artifactId)return null;
  if(e.type==='paper-capture'){if(q.type!=='paper-capture'||!same(e.claims,q.claims))return null;}
  else if(q.type!=='paper-review'||e.captureId!==q.captureId||e.artifactDigest!==q.artifactDigest||!same(e.reenteredClaims,q.reenteredClaims))return null;
 }else if(!uuid(x.reopenId)||e?.id===a.entryId||w.historyDigest===r.data.expectedHistoryDigest||w.historyDigest===a.historyDigest)return null;
 return structuredClone(x)as PlayoffPaperRecoveryV1;
}catch{return null;}}
