import {isEventPrizeResponseValueV1,isEventPrizeWireValueV1,isEventPrizeSettingsSnapshotV1} from './event-prize-settings-v1.ts';
import {calculatePlayoffPrizeProposalsV2,isPlayoffPrizeProposalExtensionV2,type PlayoffPrizeProposalV2} from '../results/playoff-prize-proposals-v2.ts';
import {projectEventLedgerV1} from '../finance/event-ledger-projection-v1.ts';

export type PlayoffPrizeBrowserScopeV2={actorId:string;tournamentId:string;eventId:string};
export type PlayoffPrizeBrowserEvidenceV2={capture:{bindingId:string;activationId:string;setupEventVersionId:string;contextReviewId:string;intentActorId:string;intentOperationId:string;input:unknown};coverage:{additionalIncome:'not_supported';optionalPools:'blocked';feeCoverage:'unverified';fundReview:'unverified'}};
export type PlayoffPrizeBrowserCurrentV2={nativeSourceDigest:string;nativeInput:unknown;evidence:PlayoffPrizeBrowserEvidenceV2;proposal:PlayoffPrizeProposalV2};
export type PlayoffPrizeBrowserHeadV2={revisionId:string;version:number;priorRevisionId:string|null;actorId:string;operationId:string;tournamentId:string;eventId:string;nativeSourceDigest:string;mode:'append'|'adopt-current';reason:string;createdAt:string;sourceEvidence:PlayoffPrizeBrowserEvidenceV2;proposal:PlayoffPrizeProposalV2;proposalOnly:true;payoutAuthorized:false;moneyMoved:false};
export type PlayoffPrizeBrowserWorkspaceV2=PlayoffPrizeBrowserScopeV2&{kind:'playoff-prize-proposal-browser-workspace-v2';current:PlayoffPrizeBrowserCurrentV2|null;head:PlayoffPrizeBrowserHeadV2|null;stale:boolean;writeAuthorized:false;finalizationAllowed:false;payoutAuthorized:false;moneyMoved:false};
export type PlayoffPrizeBrowserSaveV2={kind:'playoff-prize-proposal-save-v2';operationId:string;expectedRevisionId:string|null;nativeSourceDigest:string;input:unknown;overrideHistory:PlayoffPrizeProposalV2['overrideHistory'];reason:string;mode:'append'|'adopt-current';confirmed:true};
export type PlayoffPrizeBrowserPreparedV2={request:PlayoffPrizeBrowserSaveV2;raw:string;hash:string;scope:PlayoffPrizeBrowserScopeV2};
export type PlayoffPrizeBrowserOperationV2=PlayoffPrizeBrowserScopeV2&{kind:'playoff-prize-proposal-browser-operation-v2';operationId:string;requestText:string;requestHash:string;result:{status:'saved';head:PlayoffPrizeBrowserHeadV2}|{status:'rejected';code:string};writeAuthorized:false;finalizationAllowed:false;payoutAuthorized:false;moneyMoved:false};
export type PlayoffPrizeBrowserAttemptV2=PlayoffPrizeBrowserScopeV2&{kind:'playoff-prize-proposal-attempt-v2';operationId:string;requestHash:string;status:'rejected'|'retry_exact'|'unknown'|'blocked'|'unavailable';code:string};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const digest=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const canonical=(v:unknown):string=>JSON.stringify(v,(_k,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const same=(a:unknown,b:unknown)=>canonical(a)===canonical(b);
const reason=(v:unknown):v is string=>typeof v==='string'&&!!v.trim()&&v.length<=2000;
const scopeValid=(v:unknown):v is PlayoffPrizeBrowserScopeV2=>isEventPrizeResponseValueV1(v)&&exact(v,['actorId','tournamentId','eventId'])&&Object.values(v).every(uuid);
const scoped=(v:Record<string,unknown>,s:PlayoffPrizeBrowserScopeV2)=>v.actorId===s.actorId&&v.tournamentId===s.tournamentId&&v.eventId===s.eventId;
const flags={writeAuthorized:false as const,finalizationAllowed:false as const,payoutAuthorized:false as const,moneyMoved:false as const};
function freeze<T>(v:T):T{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
function databaseText(v:unknown):boolean{if(typeof v==='string'){for(let i=0;i<v.length;i++){const c=v.charCodeAt(i);if(c===0)return false;if(c>=0xd800&&c<=0xdbff){const next=v.charCodeAt(++i);if(!(next>=0xdc00&&next<=0xdfff))return false;}else if(c>=0xdc00&&c<=0xdfff)return false;}return true;}if(Array.isArray(v))return v.every(databaseText);return object(v)?Object.entries(v).every(([k,x])=>databaseText(k)&&databaseText(x)):true;}
function evidence(v:unknown):v is PlayoffPrizeBrowserEvidenceV2{
 if(!exact(v,['capture','coverage'])||!exact(v.capture,['bindingId','activationId','setupEventVersionId','contextReviewId','intentActorId','intentOperationId','input'])||!exact(v.coverage,['additionalIncome','optionalPools','feeCoverage','fundReview']))return false;
 const capture=v.capture;return['bindingId','activationId','setupEventVersionId','contextReviewId','intentActorId','intentOperationId'].every(k=>uuid(capture[k]))&&v.coverage.additionalIncome==='not_supported'&&v.coverage.optionalPools==='blocked'&&v.coverage.feeCoverage==='unverified'&&v.coverage.fundReview==='unverified';
}

/** Cross-check server-projected basis against the carried native input. Full
 * qualification/source validation and the opaque content digests remain the
 * authenticated server projector's responsibility; these DTOs are not proof
 * of a ledger read, authentication or permission if supplied by a client. */
function projection(input:unknown,p:unknown,s:{tournamentId:string;eventId:string}):p is PlayoffPrizeProposalV2{
 if(!exact(p,['source','input','overrideHistory'])||calculatePlayoffPrizeProposalsV2(p,{source:p.source,input:p.input}).status!=='proposal_review'||!object(p.source)||!object(p.input)
  ||!exact(input,['binding','prizeSource','ledger','qualification'])||!exact(input.binding,['tournamentId','eventId','eventClientRowId','eventKind','setupRevisionId','settingsSnapshotId','settingsDigest','prizeSnapshotId','prizeDigest'])
  ||!exact(input.prizeSource,['snapshot','currentPrizeSnapshotId','currentPrizeDigest'])||!isEventPrizeSettingsSnapshotV1(input.prizeSource.snapshot)
  ||!exact(input.ledger,['allocationRevisionId','currentAllocationRevisionId','current','retained'])||!exact(input.qualification,['currentResultVersionId','result'])||!object(input.qualification.result))return false;
 const b=input.binding,snapshot=input.prizeSource.snapshot,q=input.qualification.result,source=p.source;
 if(b.tournamentId!==s.tournamentId||b.eventId!==s.eventId||Object.keys(b).some(k=>b[k]!==source[k])||snapshot.tournamentId!==b.tournamentId||snapshot.setupRevisionId!==b.setupRevisionId||snapshot.settingsSnapshotId!==b.settingsSnapshotId||snapshot.settingsDigest!==b.settingsDigest||snapshot.prizeSnapshotId!==b.prizeSnapshotId||snapshot.prizeDigest!==b.prizeDigest||input.prizeSource.currentPrizeSnapshotId!==snapshot.prizeSnapshotId||input.prizeSource.currentPrizeDigest!==snapshot.prizeDigest
  ||input.ledger.allocationRevisionId!==input.ledger.currentAllocationRevisionId||p.source.allocationRevisionId!==input.ledger.allocationRevisionId||p.source.qualificationResultVersionId!==input.qualification.currentResultVersionId||q.resultVersionId!==input.qualification.currentResultVersionId||q.tournamentId!==s.tournamentId||q.eventId!==s.eventId||q.status!=='qualification_finalized')return false;
 const plan=snapshot.plans.find(x=>x.eventClientRowId===b.eventClientRowId&&x.eventKind===b.eventKind);
 if(plan?.mode!=='proposed_v2'||!same(plan.draft,p.input.plan)||!same(p.input.field,{status:'known',qualifierCount:q.qualifierCount,firstRoundLoserPlaces:null,entryFeeMinor:null}))return false;
 const ledger=projectEventLedgerV1({eventId:s.eventId,current:input.ledger.current,retained:input.ledger.retained});
 if(ledger.status!=='projected'||ledger.tournamentId!==s.tournamentId||ledger.mode!=='documented_actual'||ledger.sourceVersion<1||ledger.reviewRequired||ledger.regularFundMinor!==p.input.fundMinor)return false;
 const current=input.ledger.current as {sources:Array<{kind:string;allocations:Array<{poolId:unknown;bucket:string}>}>};
 return current.sources.every(x=>['entry_receipt','expense'].includes(x.kind)&&x.allocations.every(a=>a.poolId===null&&['regular_entry','player_benefit','operating_expense'].includes(a.bucket)));
}
export function readPlayoffPrizeBrowserHeadV2(v:unknown,s:{tournamentId:string;eventId:string}):PlayoffPrizeBrowserHeadV2|null{
 try{if(!isEventPrizeResponseValueV1(v)||!databaseText(v)||!exact(v,['revisionId','version','priorRevisionId','actorId','operationId','tournamentId','eventId','nativeSourceDigest','mode','reason','createdAt','sourceEvidence','proposal','proposalOnly','payoutAuthorized','moneyMoved'])||!['revisionId','actorId','operationId','tournamentId','eventId'].every(k=>uuid(v[k]))||v.tournamentId!==s.tournamentId||v.eventId!==s.eventId||!Number.isSafeInteger(v.version)||Number(v.version)<1||!(v.priorRevisionId===null||uuid(v.priorRevisionId))||v.priorRevisionId===v.revisionId||(v.version===1)!==(v.priorRevisionId===null)||!digest(v.nativeSourceDigest)||!reason(v.reason)||!['append','adopt-current'].includes(v.mode as string)||typeof v.createdAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v.createdAt)||!Number.isFinite(Date.parse(v.createdAt))||new Date(v.createdAt).toISOString()!==v.createdAt||v.proposalOnly!==true||v.payoutAuthorized!==false||v.moneyMoved!==false||!evidence(v.sourceEvidence)||!projection(v.sourceEvidence.capture.input,v.proposal,s)||(v.mode==='adopt-current'&&v.proposal.overrideHistory.length!==0))return null;
  return freeze(structuredClone(v) as PlayoffPrizeBrowserHeadV2);
 }catch{return null;}
}
export function readPlayoffPrizeBrowserWorkspaceV2(v:unknown,s:PlayoffPrizeBrowserScopeV2):PlayoffPrizeBrowserWorkspaceV2|null{
 try{if(!scopeValid(s)||!isEventPrizeResponseValueV1(v)||!databaseText(v)||!exact(v,['kind','actorId','tournamentId','eventId','current','head','stale','writeAuthorized','finalizationAllowed','payoutAuthorized','moneyMoved'])||v.kind!=='playoff-prize-proposal-browser-workspace-v2'||!scoped(v,s)||typeof v.stale!=='boolean'||Object.entries(flags).some(([k,x])=>v[k]!==x))return null;
  const head=v.head===null?null:readPlayoffPrizeBrowserHeadV2(v.head,s);if(v.head!==null&&!head)return null;
  if(v.current!==null&&(!exact(v.current,['nativeSourceDigest','nativeInput','evidence','proposal'])||!digest(v.current.nativeSourceDigest)||!evidence(v.current.evidence)||!same(v.current.nativeInput,v.current.evidence.capture.input)||!projection(v.current.nativeInput,v.current.proposal,s)||v.current.proposal.overrideHistory.length!==0))return null;
  const current=v.current as PlayoffPrizeBrowserCurrentV2|null,stale=current===null||head!==null&&!same(head.sourceEvidence,current.evidence);if(stale!==v.stale)return null;
  return freeze(structuredClone({...v,head}) as PlayoffPrizeBrowserWorkspaceV2);
 }catch{return null;}
}

/** Wire-shape validation for retained requests. The authenticated server still
 * reassembles the full native/qualification basis on save and recovery. */
function request(v:unknown,s:PlayoffPrizeBrowserScopeV2):v is PlayoffPrizeBrowserSaveV2{
 if(!isEventPrizeWireValueV1(v)||!databaseText(v)||!exact(v,['kind','operationId','expectedRevisionId','nativeSourceDigest','input','overrideHistory','reason','mode','confirmed'])||v.kind!=='playoff-prize-proposal-save-v2'||!uuid(v.operationId)||!(v.expectedRevisionId===null||uuid(v.expectedRevisionId))||!digest(v.nativeSourceDigest)||!reason(v.reason)||!['append','adopt-current'].includes(v.mode as string)||v.confirmed!==true||!Array.isArray(v.overrideHistory)||!exact(v.input,['binding','prizeSource','ledger','qualification'])||!object(v.input.binding)||v.input.binding.tournamentId!==s.tournamentId||v.input.binding.eventId!==s.eventId||(v.mode==='adopt-current'&&v.overrideHistory.length!==0))return false;
 return v.overrideHistory.every(r=>exact(r,['recordId','firstPlace','lastPlace','priorRecordId','perPersonMinor','voided','reason'])&&uuid(r.recordId)&&(r.priorRecordId===null||uuid(r.priorRecordId))&&Number.isSafeInteger(r.firstPlace)&&Number(r.firstPlace)>=1&&Number.isSafeInteger(r.lastPlace)&&Number(r.lastPlace)>=Number(r.firstPlace)&&Number.isSafeInteger(r.perPersonMinor)&&Number(r.perPersonMinor)>=0&&typeof r.voided==='boolean'&&reason(r.reason));
}
async function sha(raw:string):Promise<string|null>{try{const result=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));return Array.from(new Uint8Array(result),b=>b.toString(16).padStart(2,'0')).join('');}catch{return null;}}
export async function readPlayoffPrizeBrowserPreparedV2(value:unknown,s:PlayoffPrizeBrowserScopeV2):Promise<PlayoffPrizeBrowserPreparedV2|null>{
 try{if(!scopeValid(s)||!isEventPrizeResponseValueV1(value)||!exact(value,['request','raw','hash','scope'])||!scopeValid(value.scope)||!same(value.scope,s)||typeof value.raw!=='string'||new TextEncoder().encode(value.raw).byteLength>1_000_000||!digest(value.hash)||!request(value.request,s)||canonical(value.request)!==value.raw)return null;
  const snapshot=structuredClone(value) as PlayoffPrizeBrowserPreparedV2;return await sha(snapshot.raw)===snapshot.hash?freeze(snapshot):null;
 }catch{return null;}
}
export async function preparePlayoffPrizeBrowserSaveV2(value:unknown,proposal:unknown,reasonText:string,mode:'append'|'adopt-current',operationId:string):Promise<PlayoffPrizeBrowserPreparedV2|null>{
 try{if(!isEventPrizeResponseValueV1(value)||!object(value))return null;const s={actorId:value.actorId,tournamentId:value.tournamentId,eventId:value.eventId};if(!scopeValid(s))return null;
  const w=readPlayoffPrizeBrowserWorkspaceV2(value,s);if(!w?.current)return null;const current={source:w.current.proposal.source,input:w.current.proposal.input};
  if(calculatePlayoffPrizeProposalsV2(proposal,current).status!=='proposal_review')return null;const p=proposal as PlayoffPrizeProposalV2;
  if(mode==='append'&&(w.stale||w.head&&!isPlayoffPrizeProposalExtensionV2(w.head.proposal,p,current)))return null;
  if(mode==='adopt-current'&&(!w.head||!w.stale||p.overrideHistory.length!==0))return null;
  const r={kind:'playoff-prize-proposal-save-v2' as const,operationId,expectedRevisionId:w.head?.revisionId??null,nativeSourceDigest:w.current.nativeSourceDigest,input:structuredClone(w.current.nativeInput),overrideHistory:structuredClone(p.overrideHistory),reason:reasonText,mode,confirmed:true as const};if(!request(r,s))return null;
  const raw=canonical(r);if(new TextEncoder().encode(raw).byteLength>1_000_000)return null;const hash=await sha(raw);return hash?freeze({request:r,raw,hash,scope:structuredClone(s)}):null;
 }catch{return null;}
}
export const prepareBrowserSave=preparePlayoffPrizeBrowserSaveV2;
export async function readPlayoffPrizeBrowserReplyV2(value:unknown,expected:PlayoffPrizeBrowserPreparedV2):Promise<PlayoffPrizeBrowserOperationV2|PlayoffPrizeBrowserAttemptV2|null>{
 try{if(!isEventPrizeResponseValueV1(value)||!databaseText(value)||!object(value)||!isEventPrizeResponseValueV1(expected)||!object(expected))return null;
  const v=structuredClone(value),p=await readPlayoffPrizeBrowserPreparedV2(expected,expected.scope);if(!p||!scoped(v,p.scope)||v.operationId!==p.request.operationId||v.requestHash!==p.hash)return null;
  if(exact(v,['kind','actorId','tournamentId','eventId','operationId','requestHash','status','code'])&&v.kind==='playoff-prize-proposal-attempt-v2'&&['rejected','retry_exact','unknown','blocked','unavailable'].includes(v.status as string)&&typeof v.code==='string'&&v.code.length>0&&v.code.length<=100)return freeze(v as PlayoffPrizeBrowserAttemptV2);
  if(!exact(v,['kind','actorId','tournamentId','eventId','operationId','requestText','requestHash','result','writeAuthorized','finalizationAllowed','payoutAuthorized','moneyMoved'])||v.kind!=='playoff-prize-proposal-browser-operation-v2'||v.requestText!==p.raw||Object.entries(flags).some(([k,x])=>v[k]!==x)||!object(v.result))return null;
  if(exact(v.result,['status','code'])&&v.result.status==='rejected'&&typeof v.result.code==='string'&&v.result.code.length>0&&v.result.code.length<=100)return freeze(v as PlayoffPrizeBrowserOperationV2);
  if(!exact(v.result,['status','head'])||v.result.status!=='saved')return null;const h=readPlayoffPrizeBrowserHeadV2(v.result.head,p.scope),r=p.request;
  if(!h||h.actorId!==p.scope.actorId||h.operationId!==r.operationId||h.priorRevisionId!==r.expectedRevisionId||h.nativeSourceDigest!==r.nativeSourceDigest||!same(h.sourceEvidence.capture.input,r.input)||!same(h.proposal.overrideHistory,r.overrideHistory)||h.reason!==r.reason||h.mode!==r.mode)return null;
  return freeze({...v,result:{status:'saved',head:h}} as PlayoffPrizeBrowserOperationV2);
 }catch{return null;}
}
