import {isScoreEntryReady} from '../score.ts';
import type {SimulatedGameActionV1,SimulatedGameEntryV1} from './native-mixed-post-start-admission-v1.ts';

type ActionPayload<A extends SimulatedGameActionV1>=Omit<Extract<SimulatedGameEntryV1,{action:A}>,
 'id'|'operationId'|'receiptId'|'payloadDigest'|'sequence'|'actorId'|'tournamentId'|'eventId'|'startId'|'gameId'|'startSourceDigest'|'action'|'artifactDigest'>;
type PaperReviewPayload=Pick<Extract<SimulatedGameEntryV1,{action:'paper-review'}>,'captureId'|'artifactId'|'artifactDigest'|'reenteredClaims'|'decision'|'statement'>;
export type NativeMixedGameWriteRequestV1={ [A in SimulatedGameActionV1]:{
 kind:'native-mixed-simulation-game-write-v1';operationId:string;startId:string;gameId:string;
 expectedStartSourceDigest:string;expectedRevision:number;expectedHistoryDigest:string;
 action:A;payload:A extends 'paper-review'?PaperReviewPayload:ActionPayload<A>;
}}[SimulatedGameActionV1];
export type NativeMixedGameTargetV1={actorId:string;sessionId:string;projectUrl:string;projectRef:string;
 tournamentId:string;eventId:string;startId:string;gameId:string;startSourceDigest:string};
const falseFlags=['ordinaryScoreWritten','normalStartAuthorized','scoringAuthorized','officialResultVerified','humanPlayVerified','moneyMoved','payoutAuthorized']as const;
type FalseFlags={ [K in typeof falseFlags[number]]:false };
export type NativeMixedGameWriteReceiptV1=FalseFlags&{kind:'native-mixed-simulation-game-write-receipt-v1';status:'accepted';code:'simulation_evidence_recorded';
 actorId:string;tournamentId:string;eventId:string;operationId:string;request:NativeMixedGameWriteRequestV1;entry:SimulatedGameEntryV1;
 revision:number;historyDigest:string;simulationOnly:true;historicalReceipt:boolean;currentSourceVerified:boolean};
export type NativeMixedGameClosedV1=FalseFlags&{kind:'native-mixed-game-closed-v1';status:'closed';code:'terminal_operation_closed';actorId:string;tournamentId:string;eventId:string;operationId:string;request:NativeMixedGameWriteRequestV1;closureId:string;reason:'source_changed'|'history_changed';simulationOnly:true;noWriteCommitted:true};
export type NativeMixedGameOutcomeV1=NativeMixedGameWriteReceiptV1|NativeMixedGameClosedV1|{status:'rejected'|'blocked'|'retry_exact';code:string};
// Player state entries use opaque game-local references for nonself actors.
// They are display DTOs, not canonical journal rows or profile-ID lookup data.
// Own entries remain exact for receipt recovery; historyDigest is server CAS.
export type NativeMixedGameStateV1=FalseFlags&{playOrder:'current'|'upcoming'|'complete'|'official';kind:'native-mixed-simulation-game-state-v1';actorId:string;tournamentId:string;eventId:string;
 startId:string;gameId:string;startSourceDigest:string;revision:number;historyDigest:string;evidenceVisibility:'metadata-only'|'evidence';entries:SimulatedGameEntryV1[];currentSourceVerified:true;simulationOnly:true};

const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:readonly string[]):v is Record<string,unknown>=>object(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const digest=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const canonical=(v:unknown):string=>JSON.stringify(v,(_k,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const same=(a:unknown,b:unknown)=>canonical(a)===canonical(b);
const result=(v:unknown)=>exact(v,['winnerSide','margin'])&&(v.winnerSide==='a'||v.winnerSide==='b')&&isScoreEntryReady(v.margin as number,v.winnerSide==='a'?'player':'opponent');
const payloadKeys:Record<SimulatedGameActionV1,string[]>={
 'digital-submit':['participantId','result','statement'],'digital-confirm':['participantId','result','references','statement'],
 'paper-capture':['artifactId','claims','physicalOriginal','fictionalOpponentPlayed','independentHumanPlayClaimed','statement'],
 'paper-review':['captureId','artifactId','artifactDigest','reenteredClaims','decision','statement']};
const claims=(v:unknown)=>Array.isArray(v)&&v.length>=1&&v.length<=2&&v.every(c=>exact(c,['side','result'])&&(c.side==='a'||c.side==='b')&&result(c.result))&&new Set(v.map(c=>c.side)).size===v.length;
function payload(action:unknown,v:unknown):boolean{
 if(typeof action!=='string'||!Object.hasOwn(payloadKeys,action)||!exact(v,payloadKeys[action as SimulatedGameActionV1]))return false;
 if(action==='digital-submit')return uuid(v.participantId)&&result(v.result)&&v.statement==='simulation-own-result-v1';
 if(action==='digital-confirm')return uuid(v.participantId)&&result(v.result)&&v.statement==='simulation-own-confirmation-v1'
  &&Array.isArray(v.references)&&v.references.length>=2&&v.references.length<=3&&v.references.every(uuid)&&new Set(v.references).size===v.references.length;
 if(action==='paper-review')return uuid(v.captureId)&&uuid(v.artifactId)&&digest(v.artifactDigest)&&claims(v.reenteredClaims)&&v.decision==='accepted-simulation-only'&&v.statement==='fictional-paper-review-v1';
 return uuid(v.artifactId)&&v.physicalOriginal===false&&v.fictionalOpponentPlayed===false&&v.independentHumanPlayClaimed===false
  &&v.statement==='fictional-paper-capture-v1'&&Array.isArray(v.claims)&&v.claims.length>=1&&v.claims.length<=2
  &&v.claims.every(c=>exact(c,['side','result'])&&(c.side==='a'||c.side==='b')&&result(c.result))&&new Set(v.claims.map(c=>c.side)).size===v.claims.length;
}
export function isNativeMixedGameWriteRequestV1(v:unknown):v is NativeMixedGameWriteRequestV1{
 return exact(v,['kind','operationId','startId','gameId','expectedStartSourceDigest','expectedRevision','expectedHistoryDigest','action','payload'])
  &&v.kind==='native-mixed-simulation-game-write-v1'&&uuid(v.operationId)&&uuid(v.startId)&&uuid(v.gameId)
  &&digest(v.expectedStartSourceDigest)&&digest(v.expectedHistoryDigest)&&typeof v.expectedRevision==='number'
  &&Number.isInteger(v.expectedRevision)&&v.expectedRevision>=0&&v.expectedRevision<=3&&payload(v.action,v.payload);
}
export function isNativeMixedGameTargetV1(v:unknown):v is NativeMixedGameTargetV1{
 if(!exact(v,['actorId','sessionId','projectUrl','projectRef','tournamentId','eventId','startId','gameId','startSourceDigest'])
  ||![v.actorId,v.sessionId,v.tournamentId,v.eventId,v.startId,v.gameId].every(uuid)||!digest(v.startSourceDigest)
  ||typeof v.projectRef!=='string'||!/^[a-z0-9-]{1,128}$/.test(v.projectRef)||typeof v.projectUrl!=='string')return false;
 try{const url=new URL(v.projectUrl);return url.protocol==='https:'&&!url.username&&!url.password&&url.origin===v.projectUrl;}catch{return false;}
}
const common=['id','operationId','receiptId','payloadDigest','sequence','actorId','tournamentId','eventId','startId','gameId','startSourceDigest','action'];
function entry(v:unknown,t:NativeMixedGameTargetV1):v is SimulatedGameEntryV1{
 if(!object(v)||typeof v.action!=='string'||!Object.hasOwn(payloadKeys,v.action))return false;
 const action=v.action as SimulatedGameActionV1;
 if(!exact(v,[...common,...payloadKeys[action],...(action==='paper-capture'?['artifactDigest']:[])])
  ||![v.id,v.operationId,v.receiptId,v.actorId].every(uuid)||!digest(v.payloadDigest)
  ||typeof v.sequence!=='number'||!Number.isInteger(v.sequence)||v.sequence<1||v.sequence>4
  ||v.tournamentId!==t.tournamentId||v.eventId!==t.eventId||v.startId!==t.startId||v.gameId!==t.gameId||v.startSourceDigest!==t.startSourceDigest)return false;
 const p=Object.fromEntries(payloadKeys[action].map(k=>[k,v[k]]));return payload(action,p)&&(action!=='paper-capture'||digest(v.artifactDigest));
}
export function readNativeMixedGameWriteReceiptV1(v:unknown,t:NativeMixedGameTargetV1,r:NativeMixedGameWriteRequestV1,historicalOnly=false):NativeMixedGameWriteReceiptV1|null{
 if(!isNativeMixedGameTargetV1(t)||!isNativeMixedGameWriteRequestV1(r)||r.startId!==t.startId||r.gameId!==t.gameId||r.expectedStartSourceDigest!==t.startSourceDigest
  ||!exact(v,['kind','status','code','actorId','tournamentId','eventId','operationId','request','entry','revision','historyDigest','simulationOnly','historicalReceipt','currentSourceVerified',...falseFlags])
  ||v.kind!=='native-mixed-simulation-game-write-receipt-v1'||v.status!=='accepted'||v.code!=='simulation_evidence_recorded'
  ||v.actorId!==t.actorId||v.tournamentId!==t.tournamentId||v.eventId!==t.eventId||v.operationId!==r.operationId||!same(v.request,r)
  ||v.revision!==r.expectedRevision+1||!digest(v.historyDigest)||v.simulationOnly!==true||falseFlags.some(k=>v[k]!==false)
  ||!entry(v.entry,t)||v.entry.actorId!==t.actorId||v.entry.operationId!==r.operationId||v.entry.sequence!==v.revision||v.entry.action!==r.action
  ||!(v.historicalReceipt===true&&v.currentSourceVerified===false||v.historicalReceipt===false&&v.currentSourceVerified===true)
  ||historicalOnly&&v.historicalReceipt!==true)return null;
 const p=Object.fromEntries(payloadKeys[r.action].map(k=>[k,(v.entry as unknown as Record<string,unknown>)[k]]));
 return same(p,r.payload)?structuredClone(v)as NativeMixedGameWriteReceiptV1:null;
}
export function readNativeMixedGameClosedV1(v:unknown,t:NativeMixedGameTargetV1,r:NativeMixedGameWriteRequestV1):NativeMixedGameClosedV1|null{
 if(!isNativeMixedGameTargetV1(t)||!isNativeMixedGameWriteRequestV1(r)||r.startId!==t.startId||r.gameId!==t.gameId||r.expectedStartSourceDigest!==t.startSourceDigest
  ||!exact(v,['kind','status','code','actorId','tournamentId','eventId','operationId','request','closureId','reason','simulationOnly','noWriteCommitted',...falseFlags])
  ||v.kind!=='native-mixed-game-closed-v1'||v.status!=='closed'||v.code!=='terminal_operation_closed'||!uuid(v.closureId)
  ||v.actorId!==t.actorId||v.tournamentId!==t.tournamentId||v.eventId!==t.eventId||v.operationId!==r.operationId||!same(v.request,r)
  ||!['source_changed','history_changed'].includes(v.reason as string)||v.simulationOnly!==true||v.noWriteCommitted!==true||falseFlags.some(k=>v[k]!==false))return null;
 return structuredClone(v)as NativeMixedGameClosedV1;
}
const rejected=new Set(['feature_unavailable','invalid_request','idempotency_conflict','source_changed','game_not_in_scope','operation_conflict','history_changed',
 'prior_game_incomplete','evidence_complete_or_review_required','mismatch_requires_review','own_digital_side_required','exact_confirmation_required','independent_official_required','paper_capture_required','independent_paper_review_required']);
export function readNativeMixedGameOutcomeV1(v:unknown,t:NativeMixedGameTargetV1,r:NativeMixedGameWriteRequestV1):NativeMixedGameOutcomeV1|null{
 if(!isNativeMixedGameTargetV1(t)||!isNativeMixedGameWriteRequestV1(r))return null;
 const receipt=readNativeMixedGameWriteReceiptV1(v,t,r);if(receipt)return receipt;
 const closed=readNativeMixedGameClosedV1(v,t,r);if(closed)return closed;
 if(!exact(v,['status','code']))return null;
 if(v.status==='retry_exact'&&v.code==='source_busy'||v.status==='rejected'&&rejected.has(v.code as string)||v.status==='blocked'&&['operation_history_unavailable','resolution_scope_unavailable','resolution_source_unavailable','resolution_not_terminal'].includes(v.code as string))return structuredClone(v)as NativeMixedGameOutcomeV1;
 return null;
}
export function readNativeMixedGameStateV1(v:unknown,t:NativeMixedGameTargetV1):NativeMixedGameStateV1|null{
 if(!isNativeMixedGameTargetV1(t)||!exact(v,['kind','playOrder','actorId','tournamentId','eventId','startId','gameId','startSourceDigest','revision','historyDigest','evidenceVisibility','entries','currentSourceVerified','simulationOnly',...falseFlags])
  ||v.kind!=='native-mixed-simulation-game-state-v1'||!['current','upcoming','complete','official'].includes(v.playOrder as string)||v.actorId!==t.actorId||v.tournamentId!==t.tournamentId||v.eventId!==t.eventId||v.startId!==t.startId||v.gameId!==t.gameId
  ||v.startSourceDigest!==t.startSourceDigest||v.currentSourceVerified!==true||v.simulationOnly!==true||falseFlags.some(k=>v[k]!==false)
  ||!digest(v.historyDigest)||!Array.isArray(v.entries)||v.entries.length>4||typeof v.revision!=='number'||!Number.isInteger(v.revision)||v.revision<0||v.revision>4
  ||!(v.evidenceVisibility==='metadata-only'&&v.entries.length===0||v.evidenceVisibility==='evidence'&&v.revision===v.entries.length))return null;
 const ids=new Set(),ops=new Set(),receipts=new Set();
 for(const[i,e]of v.entries.entries()){
  if(!entry(e,t)||e.sequence!==i+1||ids.has(e.id)||ops.has(`${e.actorId}:${e.operationId}`)||receipts.has(e.receiptId))return null;
  ids.add(e.id);ops.add(`${e.actorId}:${e.operationId}`);receipts.add(e.receiptId);
 }
 return structuredClone(v)as NativeMixedGameStateV1;
}
