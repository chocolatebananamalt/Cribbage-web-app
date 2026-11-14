import 'server-only';
import {createHash} from 'node:crypto';
import {isEventPrizeResponseValueV1,isEventPrizeWireValueV1} from '../api/event-prize-settings-v1.ts';
import {assemblePlayoffPrizeNativeSourceV2} from './playoff-prize-native-read-v2.ts';
import {buildPlayoffPrizeProposalBasisV2} from './playoff-prize-proposal-basis-v2.ts';
import {calculatePlayoffPrizeProposalsV2,isPlayoffPrizeProposalExtensionV2,type PlayoffPrizeProposalV2} from '../results/playoff-prize-proposals-v2.ts';
export const playoffPrizeProposalRequestBytesV2=1_000_000;
type Scope={actorId:string;tournamentId:string;eventId:string};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const digest=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const canonical=(v:unknown):string=>JSON.stringify(v,(_k,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const same=(a:unknown,b:unknown)=>canonical(a)===canonical(b);
const reason=(v:unknown):v is string=>typeof v==='string'&&!!v.trim()&&v.length<=2000;
// PostgreSQL JSONB cannot represent NUL or unpaired UTF-16 surrogates. Reject
// before a legitimate browser request can be retained/sent and left unknown.
function databaseText(v:unknown):boolean{if(typeof v==='string'){for(let i=0;i<v.length;i++){const c=v.charCodeAt(i);if(c===0)return false;if(c>=0xd800&&c<=0xdbff){const next=v.charCodeAt(++i);if(!(next>=0xdc00&&next<=0xdfff))return false;}else if(c>=0xdc00&&c<=0xdfff)return false;}return true;}if(Array.isArray(v))return v.every(databaseText);return object(v)?Object.entries(v).every(([k,x])=>databaseText(k)&&databaseText(x)):true;}
export type PlayoffPrizeProposalSaveV2={kind:'playoff-prize-proposal-save-v2';operationId:string;expectedRevisionId:string|null;nativeSourceDigest:string;input:unknown;overrideHistory:PlayoffPrizeProposalV2['overrideHistory'];reason:string;mode:'append'|'adopt-current';confirmed:true};
export function readPlayoffPrizeProposalSaveV2(value:unknown):PlayoffPrizeProposalSaveV2|null{
 try{if(!isEventPrizeWireValueV1(value)||!databaseText(value)||!exact(value,['kind','operationId','expectedRevisionId','nativeSourceDigest','input','overrideHistory','reason','mode','confirmed'])||value.kind!=='playoff-prize-proposal-save-v2'||!uuid(value.operationId)||!(value.expectedRevisionId===null||uuid(value.expectedRevisionId))||!digest(value.nativeSourceDigest)||!reason(value.reason)||!['append','adopt-current'].includes(value.mode as string)||value.confirmed!==true||!Array.isArray(value.overrideHistory))return null;
  const basis=buildPlayoffPrizeProposalBasisV2(value.input);if(basis.status!=='proposal_basis'||basis.ledgerMode!=='documented_actual')return null;
  if(calculatePlayoffPrizeProposalsV2({source:basis.source,input:basis.input,overrideHistory:value.overrideHistory},{source:basis.source,input:basis.input}).status!=='proposal_review'||(value.mode==='adopt-current'&&value.overrideHistory.length!==0))return null;
  return structuredClone(value) as PlayoffPrizeProposalSaveV2;
 }catch{return null;}
}
export function serializePlayoffPrizeProposalSaveV2(value:unknown):string|null{const v=readPlayoffPrizeProposalSaveV2(value);if(!v)return null;const raw=canonical(v);return Buffer.byteLength(raw,'utf8')<=playoffPrizeProposalRequestBytesV2?raw:null;}
export function playoffPrizeProposalRequestHashV2(raw:string):string{return createHash('sha256').update(raw,'utf8').digest('hex');}
export type PlayoffPrizeProposalRevisionV2={revisionId:string;version:number;priorRevisionId:string|null;actorId:string;operationId:string;tournamentId:string;eventId:string;nativeSourceDigest:string;sourceCapture:unknown;input:unknown;overrideHistory:PlayoffPrizeProposalV2['overrideHistory'];mode:'append'|'adopt-current';reason:string;createdAt:string;proposalOnly:true;payoutAuthorized:false;moneyMoved:false};
export function readPlayoffPrizeProposalRevisionV2(value:unknown,scope:{tournamentId:string;eventId:string}):PlayoffPrizeProposalRevisionV2|null{
 try{if(!isEventPrizeResponseValueV1(value)||!databaseText(value)||!exact(value,['revisionId','version','priorRevisionId','actorId','operationId','tournamentId','eventId','nativeSourceDigest','sourceCapture','input','overrideHistory','mode','reason','createdAt','proposalOnly','payoutAuthorized','moneyMoved'])||!['revisionId','actorId','operationId','tournamentId','eventId'].every(k=>uuid(value[k]))||!Number.isSafeInteger(value.version)||Number(value.version)<1||!(value.priorRevisionId===null||uuid(value.priorRevisionId))||value.priorRevisionId===value.revisionId||value.tournamentId!==scope.tournamentId||value.eventId!==scope.eventId||!digest(value.nativeSourceDigest)||!reason(value.reason)||!['append','adopt-current'].includes(value.mode as string)||typeof value.createdAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value.createdAt)||!Number.isFinite(Date.parse(value.createdAt))||new Date(value.createdAt).toISOString()!==value.createdAt||value.proposalOnly!==true||value.payoutAuthorized!==false||value.moneyMoved!==false)return null;
  if((value.version===1)!==(value.priorRevisionId===null))return null;
  const native=assemblePlayoffPrizeNativeSourceV2(value.sourceCapture,{actorId:value.actorId as string,tournamentId:scope.tournamentId,eventId:scope.eventId});if(!native||native.nativeSourceDigest!==value.nativeSourceDigest||!object(value.sourceCapture)||!object(value.sourceCapture.capture)||!same(value.input,value.sourceCapture.capture.input)||!Array.isArray(value.overrideHistory))return null;
  const current={source:native.basis.source,input:native.basis.input};if(calculatePlayoffPrizeProposalsV2({...current,overrideHistory:value.overrideHistory},current).status!=='proposal_review'||(value.mode==='adopt-current'&&value.overrideHistory.length!==0))return null;
  return structuredClone(value) as PlayoffPrizeProposalRevisionV2;
 }catch{return null;}
}
const evidence=(v:unknown)=>object(v)?{capture:v.capture,coverage:v.coverage}:null;
export type PlayoffPrizeProposalWorkspaceV2={kind:'playoff-prize-proposal-workspace-v2';actorId:string;tournamentId:string;eventId:string;nativeSource:unknown;head:PlayoffPrizeProposalRevisionV2|null;stale:boolean;writeAuthorized:false;finalizationAllowed:false;moneyMoved:false};
export function readPlayoffPrizeProposalWorkspaceV2(value:unknown,scope:Scope):PlayoffPrizeProposalWorkspaceV2|null{
 try{if(!Object.values(scope).every(uuid)||!isEventPrizeResponseValueV1(value)||!exact(value,['kind','actorId','tournamentId','eventId','nativeSource','head','stale','writeAuthorized','finalizationAllowed','moneyMoved'])||value.kind!=='playoff-prize-proposal-workspace-v2'||value.actorId!==scope.actorId||value.tournamentId!==scope.tournamentId||value.eventId!==scope.eventId||typeof value.stale!=='boolean'||value.writeAuthorized!==false||value.finalizationAllowed!==false||value.moneyMoved!==false)return null;
  const head=value.head===null?null:readPlayoffPrizeProposalRevisionV2(value.head,scope);if(value.head!==null&&!head)return null;
  const native=assemblePlayoffPrizeNativeSourceV2(value.nativeSource,scope);
  const stale=!native||!!head&&!same(evidence(head.sourceCapture),evidence(value.nativeSource));if(value.stale!==stale)return null;
  if(!native&&value.nativeSource!==null&&(!object(value.nativeSource)||!['blocked','retry_exact'].includes(value.nativeSource.status as string)||typeof value.nativeSource.code!=='string'))return null;
  return {...structuredClone(value),head} as PlayoffPrizeProposalWorkspaceV2;
 }catch{return null;}
}
export function buildPlayoffPrizeProposalSaveV2(w:PlayoffPrizeProposalWorkspaceV2,proposal:PlayoffPrizeProposalV2,reasonText:string,mode:'append'|'adopt-current',operationId:string,confirmed:boolean):PlayoffPrizeProposalSaveV2|null{
 const scope={actorId:w.actorId,tournamentId:w.tournamentId,eventId:w.eventId};const workspace=readPlayoffPrizeProposalWorkspaceV2(w,scope),native=workspace?assemblePlayoffPrizeNativeSourceV2(workspace.nativeSource,scope):null;if(!workspace||!native||!confirmed||!object(workspace.nativeSource)||!object(workspace.nativeSource.capture))return null;
 const current={source:native.basis.source,input:native.basis.input};if(calculatePlayoffPrizeProposalsV2(proposal,current).status!=='proposal_review')return null;
 if(mode==='append'&&(workspace.stale||workspace.head&&!isPlayoffPrizeProposalExtensionV2(revisionProposal(workspace.head)!,proposal,current)))return null;
 if(mode==='adopt-current'&&(!workspace.head||!workspace.stale||proposal.overrideHistory.length!==0))return null;
 return readPlayoffPrizeProposalSaveV2({kind:'playoff-prize-proposal-save-v2',operationId,expectedRevisionId:workspace.head?.revisionId??null,nativeSourceDigest:native.nativeSourceDigest,input:workspace.nativeSource.capture.input,overrideHistory:proposal.overrideHistory,reason:reasonText,mode,confirmed:true});
}
export function revisionProposal(value:PlayoffPrizeProposalRevisionV2):PlayoffPrizeProposalV2|null{const basis=buildPlayoffPrizeProposalBasisV2(value.input);return basis.status==='proposal_basis'?{source:basis.source,input:basis.input,overrideHistory:structuredClone(value.overrideHistory)}:null;}
export type PlayoffPrizeProposalOperationV2={kind:'playoff-prize-proposal-operation-v2';actorId:string;tournamentId:string;eventId:string;operationId:string;requestText:string;requestHash:string;result:{status:'saved';revision:PlayoffPrizeProposalRevisionV2}|{status:'rejected';code:string}};
export function readPlayoffPrizeProposalOperationV2(value:unknown,scope:Scope,request:PlayoffPrizeProposalSaveV2):PlayoffPrizeProposalOperationV2|null{
 try{const raw=serializePlayoffPrizeProposalSaveV2(request);if(!raw||!isEventPrizeResponseValueV1(value)||!exact(value,['kind','actorId','tournamentId','eventId','operationId','requestText','requestHash','result'])||value.kind!=='playoff-prize-proposal-operation-v2'||value.actorId!==scope.actorId||value.tournamentId!==scope.tournamentId||value.eventId!==scope.eventId||value.operationId!==request.operationId||value.requestText!==raw||value.requestHash!==playoffPrizeProposalRequestHashV2(raw)||!object(value.result))return null;
  if(exact(value.result,['status','code'])&&value.result.status==='rejected'&&typeof value.result.code==='string'&&value.result.code.length>0&&value.result.code.length<=100)return structuredClone(value) as PlayoffPrizeProposalOperationV2;
  if(!exact(value.result,['status','revision'])||value.result.status!=='saved')return null;const revision=readPlayoffPrizeProposalRevisionV2(value.result.revision,scope);
  if(!revision||revision.actorId!==scope.actorId||revision.operationId!==request.operationId||revision.priorRevisionId!==request.expectedRevisionId||revision.nativeSourceDigest!==request.nativeSourceDigest||!same(revision.input,request.input)||!same(revision.overrideHistory,request.overrideHistory)||revision.mode!==request.mode||revision.reason!==request.reason)return null;
  return {...structuredClone(value),result:{status:'saved',revision}} as PlayoffPrizeProposalOperationV2;
 }catch{return null;}
}
export type PlayoffPrizeProposalAttemptV2={kind:'playoff-prize-proposal-attempt-v2';actorId:string;tournamentId:string;eventId:string;operationId:string;requestHash:string;status:'rejected'|'retry_exact'|'unknown'|'blocked'|'unavailable';code:string};

export function readPlayoffPrizeProposalReplyV2(value:unknown,scope:Scope,request:PlayoffPrizeProposalSaveV2):PlayoffPrizeProposalOperationV2|PlayoffPrizeProposalAttemptV2|null{
 const operation=readPlayoffPrizeProposalOperationV2(value,scope,request);if(operation)return operation;
 try{const raw=serializePlayoffPrizeProposalSaveV2(request);if(!raw||!isEventPrizeResponseValueV1(value)||!object(value)||value.actorId!==scope.actorId||value.tournamentId!==scope.tournamentId||value.eventId!==scope.eventId||value.operationId!==request.operationId||value.requestHash!==playoffPrizeProposalRequestHashV2(raw))return null;

  if(exact(value,['kind','actorId','tournamentId','eventId','operationId','requestHash','status','code'])&&value.kind==='playoff-prize-proposal-attempt-v2'&&['rejected','retry_exact','unknown','blocked','unavailable'].includes(value.status as string)&&typeof value.code==='string'&&value.code.length>0&&value.code.length<=100)return structuredClone(value) as PlayoffPrizeProposalAttemptV2;
  return null;
 }catch{return null;}
}
