/** Own-operation proof only. Never authorizes a replacement nonce or request. */
import type{NativeMixedPlayoffPreparedV1,NativeMixedPlayoffReceiptV1}from'../api/native-mixed-playoff-own-transport-v1.ts';
import{readNativeMixedPlayoffOwnV1,buildNativeMixedPlayoffOwnCommandV1,type NativeMixedPlayoffOwnStateV1}from'./native-mixed-playoff-own-view-v1.ts';
import{playoffCorrectionPlainV1 as plain,playoffCorrectionExactV1 as exact,playoffCorrectionUuidV1 as uuid,playoffCorrectionDigestV1 as hash,playoffCorrectionSameV1 as same}from'./native-mixed-playoff-reopen-v1.ts';
type Flags={simulationOnly:true;ordinaryQualificationRecorded:false;mrpAwarded:false;moneyMoved:false;writeAuthorized:false};
export type PlayoffOwnClosureV1=Flags&{kind:'native-mixed-playoff-own-closure-receipt-v1';status:'closed';actorId:string;sessionId:string;tournamentId:string;eventId:string;operationId:string;request:NativeMixedPlayoffPreparedV1['request'];code:'source_changed'|'history_changed'|'match_or_game_changed';historicalReceipt:boolean;currentSourceVerified:false;noWriteCommitted:true};
type Base=Flags&{kind:'native-mixed-playoff-own-operation-v1';actorId:string;sessionId:string;tournamentId:string;eventId:string;operationId:string;request:NativeMixedPlayoffPreparedV1['request']};
export type PlayoffOwnRecoveryV1=Base&({status:'retry-original';currentOwnState:NativeMixedPlayoffOwnStateV1;currentSourceVerified:true}|{status:'accepted'|'superseded';receipt:NativeMixedPlayoffReceiptV1;currentOwnState:NativeMixedPlayoffOwnStateV1;currentSourceVerified:true;reopenId?:string}|{status:'closed';closureReceipt:PlayoffOwnClosureV1;currentSourceVerified:false});
const flags=(v:Record<string,unknown>)=>v.simulationOnly===true&&v.ordinaryQualificationRecorded===false&&v.mrpAwarded===false&&v.moneyMoved===false&&v.writeAuthorized===false;
const baseKeys=['kind','status','actorId','sessionId','tournamentId','eventId','operationId','request','writeAuthorized','simulationOnly','ordinaryQualificationRecorded','mrpAwarded','moneyMoved'];
function bound(v:Record<string,unknown>,p:NativeMixedPlayoffPreparedV1){const t=p.target;return v.actorId===t.actorId&&v.sessionId===t.sessionId&&v.tournamentId===t.ownScope.tournamentId&&v.eventId===t.ownScope.eventId&&v.operationId===p.operationId&&same(v.request,p.request)&&flags(v);}
export function readPlayoffOwnClosureV1(v:unknown,p:NativeMixedPlayoffPreparedV1):PlayoffOwnClosureV1|null{try{
 if(!plain(v)||!exact(v,[...baseKeys,'code','historicalReceipt','currentSourceVerified','noWriteCommitted'])||v.kind!=='native-mixed-playoff-own-closure-receipt-v1'||v.status!=='closed'||!bound(v,p)||!['source_changed','history_changed','match_or_game_changed'].includes(v.code as string)||typeof v.historicalReceipt!=='boolean'||v.currentSourceVerified!==false||v.noWriteCommitted!==true)return null;
 return structuredClone(v)as PlayoffOwnClosureV1;
}catch{return null;}}
function ack(v:unknown,p:NativeMixedPlayoffPreparedV1):NativeMixedPlayoffReceiptV1|null{
 const r=p.request;if(!exact(v,['status','contextId','slot','gameNumber','entryId','revision','historyDigest','sourceDigest','matchDigest','gameComplete','matchComplete','winnerId','simulationOnly','ordinaryQualificationRecorded','mrpAwarded','moneyMoved','historicalReceipt','currentSourceVerified'])||v.status!=='simulated_playoff_evidence_recorded'||v.contextId!==r.data.contextId||v.slot!==r.data.slot||v.gameNumber!==r.data.gameNumber||v.sourceDigest!==r.expectedSourceDigest||v.matchDigest!==r.data.expectedMatchDigest||v.revision!==r.data.expectedRevision+1||!uuid(v.entryId)||!hash(v.historyDigest)||v.historyDigest===r.data.expectedHistoryDigest||typeof v.gameComplete!=='boolean'||typeof v.matchComplete!=='boolean'||v.historicalReceipt!==true||v.currentSourceVerified!==false||v.simulationOnly!==true||v.ordinaryQualificationRecorded!==false||v.mrpAwarded!==false||v.moneyMoved!==false)return null;
 if(r.data.entry.type==='digital-submit'&&(v.gameComplete||v.matchComplete||v.winnerId!==null))return null;
 if(v.matchComplete?(!v.gameComplete||v.winnerId!==r.data.entry.winnerParticipantId):v.winnerId!==null)return null;
 return structuredClone(v)as NativeMixedPlayoffReceiptV1;
}
export function readPlayoffOwnRecoveryV1(v:unknown,p:NativeMixedPlayoffPreparedV1):PlayoffOwnRecoveryV1|null{try{
 if(!plain(v)||!v||typeof v!=='object'||Array.isArray(v))return null;const x=v as Record<string,unknown>,keys=[...baseKeys,'currentSourceVerified'];
 if(x.status==='closed')keys.push('closureReceipt');else if(x.status==='retry-original')keys.push('currentOwnState');else if(x.status==='accepted'||x.status==='superseded'){keys.push('receipt','currentOwnState');if(x.status==='superseded')keys.push('reopenId');}else return null;
 if(!exact(x,keys)||x.kind!=='native-mixed-playoff-own-operation-v1'||!bound(x,p))return null;
 if(x.status==='closed'){const c=readPlayoffOwnClosureV1(x.closureReceipt,p);return c&&x.currentSourceVerified===false?structuredClone(x)as PlayoffOwnRecoveryV1:null;}
 if(x.currentSourceVerified!==true)return null;
 const state=readNativeMixedPlayoffOwnV1(x.currentOwnState,p.target.ownScope),r=p.request;if(state?.status!=='simulated_playoff_own_available'||state.contextId!==r.data.contextId||state.sourceDigest!==r.expectedSourceDigest)return null;
 const m=state.matches.find(m=>m.slot===r.data.slot&&m.matchDigest===r.data.expectedMatchDigest),g=m?.games.find(g=>g.gameNumber===r.data.gameNumber);if(!m)return null;
 if(x.status==='retry-original'){
  if(r.data.entry.type!=='digital-submit'||g?.reviewRequired===true)return null;
  const wanted={...r}as Record<string,unknown>;delete wanted.reason;
  const c=buildNativeMixedPlayoffOwnCommandV1(state,p.target.ownScope,r.data.entry.winnerParticipantId===p.target.ownScope.participantId?'own':'opponent');
  return c&&same(c,wanted)?structuredClone(x)as PlayoffOwnRecoveryV1:null;
 }
 const a=ack(x.receipt,p);if(!a)return null;
 const expected={id:a.entryId,...r.data.entry}as Record<string,unknown>;delete expected.statement;
 if(x.status==='accepted'){
  if(!g?.counterEvidenceAvailable||g.revision<a.revision||!same(g.entries[a.revision-1],expected))return null;
 }else{
  if(!uuid(x.reopenId)||g?.entries.some(e=>e.id===a.entryId))return null;
  const head=g?.historyDigest??(m.nextGame?.gameNumber===r.data.gameNumber?m.nextGame.expectedHistoryDigest:null);
  if(!hash(head)||head===a.historyDigest||head===r.data.expectedHistoryDigest)return null;
 }
 return structuredClone(x)as PlayoffOwnRecoveryV1;
}catch{return null;}}
