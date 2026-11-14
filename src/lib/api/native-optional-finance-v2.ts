// Pure, bounded decoding of the private V2 candidate. No provider or write authority.
import {isEventFinanceWorkspaceV1,type EventFinanceWorkspaceV1} from '../finance/event-finance-workspace-v1.ts';
import {isRestorableEventFinanceEditorV1} from '../finance/event-finance-draft-codec-v1.ts';
import {calculateEventRegularFinanceV1} from '../results/event-regular-finance-v1.ts';

export type NativeOptionalFinanceScopeV2={actorId:string;tournamentId:string;eventId:string};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const whole=(v:unknown,min=0):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&!Object.is(v,-0);
const same=(a:unknown,b:unknown)=>JSON.stringify(a,(_k,v)=>object(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)===JSON.stringify(b,(_k,v)=>object(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const scopeValid=(s:NativeOptionalFinanceScopeV2)=>[s.actorId,s.tournamentId,s.eventId].every(uuid);
const scoped=(v:Record<string,unknown>,s:NativeOptionalFinanceScopeV2)=>v.actorId===s.actorId&&v.tournamentId===s.tournamentId&&v.eventId===s.eventId;
function safe(v:unknown,parents=new Set<object>(),depth=0,budget={remaining:100000}):boolean{
 if(depth>80||--budget.remaining<0)return false;
 if(v===null||typeof v==='string'||typeof v==='boolean')return true;
 if(typeof v==='number')return Number.isFinite(v)&&!Object.is(v,-0);
 if((!Array.isArray(v)&&!object(v))||parents.has(v))return false;
 if(Array.isArray(v)&&v.length>20000)return false;
 parents.add(v);const keys=Reflect.ownKeys(v);if(keys.length>20001)return false;
 if(Array.isArray(v)&&(keys.length!==v.length+1||!Array.from({length:v.length},(_,i)=>Object.hasOwn(v,i)).every(Boolean)))return false;
 for(const key of keys){if(Array.isArray(v)&&key==='length')continue;const d=Object.getOwnPropertyDescriptor(v,key);if(typeof key!=='string'||!d||!('value'in d)||!d.enumerable||!safe(d.value,parents,depth+1,budget))return false;}
 parents.delete(v);return true;
}
function bounded(v:unknown){return safe(v)&&new TextEncoder().encode(JSON.stringify(v)).byteLength<=4200000;}
function financial(w:EventFinanceWorkspaceV1){return calculateEventRegularFinanceV1({source:w.source,mode:w.mode,grossEntry:{source:w.source,mode:w.mode,amountMinor:w.grossEntryMinor},history:w.history.map(r=>r.line)});}
const flags=(v:Record<string,unknown>)=>v.proposalOnly===true&&v.moneyMoved===false&&v.payoutAuthorized===false&&v.finalizationAuthorized===false;
function awardRows(rows:unknown,total:number,side=false){
 if(!Array.isArray(rows)||!rows.length||rows.length>10000)return false;let sum=BigInt(0);const ids=new Set<string>();
 for(const r of rows){if(!object(r)||!uuid(r.participantId)||ids.has(r.participantId)||!whole(r.amountMinor,500)||r.amountMinor%500!==0||(side&&r.status!=='unpaid'))return false;ids.add(r.participantId);sum+=BigInt(r.amountMinor);}
 return sum===BigInt(total);
}
export type NativeOptionalFinanceSourceV2=NativeOptionalFinanceScopeV2&{
 kind:'native-optional-finance-client-source-v2';sourceDigest:string;basisDigest:string;ownershipRevisionId:string;ownershipVersion:number;
 workspace:EventFinanceWorkspaceV1;funds:{regularReceiptsMinor:number;qReceiptsMinor:number;sideReceiptsMinor:number;recordedReceiptsMinor:number;regularFundMinor:number};
 proposalOnly:true;moneyMoved:false;payoutAuthorized:false;finalizationAuthorized:false;
};
/** The SQL seam owns catalog currentness; this decoder checks the exact declared
 * contract, scope, source pins and arithmetic, then discards individual evidence. */
export function readNativeOptionalFinanceSourceV2(value:unknown,scope:NativeOptionalFinanceScopeV2):NativeOptionalFinanceSourceV2|null{
 try{
  if(!scopeValid(scope)||!bounded(value)||!exact(value,['status','kind','actorId','tournamentId','eventId','sourceDigest','basisDigest','raw','basis','proposalOnly','moneyMoved','finalizationAuthorized','payoutAuthorized'])||value.status!=='source_available'||value.kind!=='native-optional-finance-source-v2'||!scoped(value,scope)||!flags(value)||!hash(value.sourceDigest)||!hash(value.basisDigest))return null;
  const raw=value.raw,basis=value.basis;
  if(!exact(raw,['kind','ownershipRevisionId','ownershipVersion','ownershipSource','costClassifications','settings'])||raw.kind!==value.kind||!uuid(raw.ownershipRevisionId)||!whole(raw.ownershipVersion,1)||raw.ownershipVersion>2147483647||!exact(basis,['kind','sourceDigest','workspace','coverage'])||basis.kind!=='native-optional-finance-basis-v2'||basis.sourceDigest!==value.sourceDigest||!exact(basis.coverage,['additionalIncome','optionalPools','recordedFundAvailable'])||basis.coverage.additionalIncome!=='unavailable'||basis.coverage.optionalPools!=='versioned_ownership_annex'||basis.coverage.recordedFundAvailable!==false||!isEventFinanceWorkspaceV1(basis.workspace))return null;
  const w=basis.workspace,ownership=raw.ownershipSource;
  if(w.mode!=='estimate'||w.eventKind!=='main'||w.overrideHistory.length||w.source.tournamentId!==scope.tournamentId||w.source.eventId!==scope.eventId||w.source.sourceVersion!==raw.ownershipVersion||w.source.sourceDigest!==value.sourceDigest||w.payoutSource.ledgerDigest!==value.sourceDigest||w.payoutSource.resultsDigest!==value.sourceDigest||!same(w.settings,raw.settings)||!whole(w.entryCount,1)||w.paidEntryCount!==w.entryCount||w.qualifierCount!==Math.ceil(w.entryCount/4))return null;
  if(!exact(ownership,['status','kind','actorId','tournamentId','eventId','sourceDigest','capture','funds','moneyMoved','bankReceiptVerified','finalizationAuthorized'])||ownership.status!=='ownership_source_available'||ownership.kind!=='native-optional-pool-ownership-source-v2'||!scoped(ownership,scope)||!hash(ownership.sourceDigest)||ownership.moneyMoved!==false||ownership.bankReceiptVerified!==false||ownership.finalizationAuthorized!==false||!object(ownership.capture)||!exact(ownership.funds,['regularReceiptsMinor','qReceiptsMinor','sideReceiptsMinor','recordedReceiptsMinor'])||!Object.values(ownership.funds).every(n=>whole(n)))return null;
  const c=ownership.capture,f=ownership.funds;
  if(c.kind!==ownership.kind||c.tournamentId!==scope.tournamentId||c.eventId!==scope.eventId||c.refundPolicy!=='no-pool-refunds-v1'||!object(c.nativePlayoffSource)||!object(c.nativePlayoffSource.source)||!object(c.nativePlayoffSource.source.settingsBinding)||c.nativePlayoffSource.source.settingsBinding.settings_snapshot_id!==w.payoutSource.settingsSnapshotId||!object(c.basis)||!Array.isArray(c.basis.expenses)||!object(c.qSource)||!Array.isArray(c.qSource.obligations)||!object(c.sideBasis)||!Array.isArray(c.sideBasis.manifest)||!Array.isArray(raw.costClassifications))return null;
  const expected:Array<{category:string;amount:number;label?:string}>=[],seen=new Set<string>();
  for(const cost of raw.costClassifications){if(!exact(cost,['expenseEventId','category'])||!uuid(cost.expenseEventId)||seen.has(cost.expenseEventId)||!['player_benefit','operating_expense'].includes(cost.category as string))return null;seen.add(cost.expenseEventId);const rows=c.basis.expenses.filter(x=>object(x)&&x.expenseEventId===cost.expenseEventId);if(rows.length!==1||!object(rows[0])||!whole(rows[0].amountMinor))return null;expected.push({category:cost.category as string,amount:rows[0].amountMinor,label:rows[0].description as string});}
  if(seen.size!==c.basis.expenses.length)return null;
  if(!hash(c.qSource.sourceDigest)||!object(c.qReview)||c.qReview.source_digest!==c.qSource.sourceDigest||!same(c.qReview.obligations,c.qSource.obligations))return null;
  let q=BigInt(0),side=BigInt(0);const qPools=new Set<string>(),sidePools=new Set<string>();
  for(const p of c.qSource.obligations){if(!object(p)||p.kind!=='award'||p.status!=='unpaid'||!uuid(p.poolVersionId)||qPools.has(p.poolVersionId)||!whole(p.fundMinor,500)||!awardRows(p.rows,p.fundMinor))return null;qPools.add(p.poolVersionId);q+=BigInt(p.fundMinor);expected.push({category:'q_pool_fund',amount:p.fundMinor});}
  for(const p of c.sideBasis.manifest){if(!object(p)||!object(p.source)||!uuid(p.source.poolId)||sidePools.has(p.source.poolId)||p.source.eventId!==scope.eventId||!whole(p.source.fundMinor,500)||!hash(p.source.sourceDigest)||!Array.isArray(p.source.blockers)||p.source.blockers.length||!object(p.review)||p.review.pool_id!==p.source.poolId||p.review.event_id!==scope.eventId||p.review.tournament_id!==scope.tournamentId||p.review.source_digest!==p.source.sourceDigest||!same(p.review.obligations,p.source.obligations)||!awardRows(p.source.obligations,p.source.fundMinor,true))return null;sidePools.add(p.source.poolId);side+=BigInt(p.source.fundMinor);expected.push({category:'side_pool_fund',amount:p.source.fundMinor});}
  if(!c.sideBasis.manifest.length||!c.qSource.obligations.length||w.history.length!==expected.length)return null;
  for(let i=0;i<expected.length;i++){const row=w.history[i],e=expected[i];if(row.line.category!==e.category||row.line.amountMinor!==e.amount||row.line.voided||row.line.priorRecordId!==null||row.line.recordId!==row.line.lineId||(e.label!==undefined&&row.label!==e.label))return null;}
  const calc=financial(w);
  if(calc.status!=='calculated'||calc.additionalIncomeMinor!==0||calc.excludedQMinor!==f.qReceiptsMinor||calc.excludedSideMinor!==f.sideReceiptsMinor||q!==BigInt(f.qReceiptsMinor as number)||side!==BigInt(f.sideReceiptsMinor as number)||w.grossEntryMinor!==f.regularReceiptsMinor||BigInt(f.regularReceiptsMinor as number)+q+side!==BigInt(f.recordedReceiptsMinor as number))return null;
  return structuredClone({...scope,kind:'native-optional-finance-client-source-v2' as const,sourceDigest:value.sourceDigest,basisDigest:value.basisDigest,ownershipRevisionId:raw.ownershipRevisionId,ownershipVersion:raw.ownershipVersion,workspace:w,funds:{regularReceiptsMinor:f.regularReceiptsMinor as number,qReceiptsMinor:f.qReceiptsMinor as number,sideReceiptsMinor:f.sideReceiptsMinor as number,recordedReceiptsMinor:f.recordedReceiptsMinor as number,regularFundMinor:calc.regularFundMinor},proposalOnly:true as const,moneyMoved:false as const,payoutAuthorized:false as const,finalizationAuthorized:false as const});
 }catch{return null;}
}

export function readNativeOptionalFinanceWorkspaceV2(value:unknown,scope:NativeOptionalFinanceScopeV2){
 try{
  if(!scopeValid(scope)||!bounded(value)||!exact(value,['kind','actorId','tournamentId','eventId','source','currentVersion','current','history','proposalOnly','moneyMoved','payoutAuthorized','finalizationAuthorized'])||value.kind!=='native-optional-finance-workspace-v2'||!scoped(value,scope)||!flags(value)||!whole(value.currentVersion)||typeof value.current!=='boolean'||!Array.isArray(value.history)||value.history.length>10000||value.currentVersion!==value.history.length)return null;
  const source=readNativeOptionalFinanceSourceV2(value.source,scope);if(!source)return null;
  const ids=new Set<string>();let previous:string|null=null;
  for(let i=0;i<value.history.length;i++){const r=value.history[i];if(!exact(r,['revisionId','version','priorRevisionId','ownershipRevisionId','actorId','operationId','sourceDigest','basisDigest','editor','reason','savedAt'])||!uuid(r.revisionId)||ids.has(r.revisionId)||r.version!==i+1||r.priorRevisionId!==previous||![r.ownershipRevisionId,r.actorId,r.operationId].every(uuid)||!hash(r.sourceDigest)||!hash(r.basisDigest)||!isRestorableEventFinanceEditorV1(r.editor)||typeof r.reason!=='string'||!r.reason.trim()||r.reason.length>2000||typeof r.savedAt!=='string'||!Number.isFinite(Date.parse(r.savedAt))||r.editor.basis.mode!=='estimate'||r.editor.basis.source.tournamentId!==scope.tournamentId||r.editor.basis.source.eventId!==scope.eventId||r.editor.basis.source.sourceDigest!==r.sourceDigest||r.editor.basis.payoutSource.ledgerDigest!==r.sourceDigest||r.editor.basis.payoutSource.resultsDigest!==r.sourceDigest)return null;ids.add(r.revisionId);previous=r.revisionId;}
  const last=value.history.at(-1);const current=!!last&&last.sourceDigest===source.sourceDigest&&last.basisDigest===source.basisDigest;
  if(value.current!==current||(current&&(!same(last.editor.basis,source.workspace)||last.ownershipRevisionId!==source.ownershipRevisionId)))return null;
  return structuredClone({...scope,kind:'native-optional-finance-client-workspace-v2' as const,source,currentVersion:value.currentVersion,current,history:value.history,proposalOnly:true as const,moneyMoved:false as const,payoutAuthorized:false as const,finalizationAuthorized:false as const});
 }catch{return null;}
}

export type NativeOptionalFinanceProposalRequestV2={kind:'native-optional-finance-proposal-v2';expectedVersion:number;sourceDigest:string;basisDigest:string;editor:import('../finance/event-finance-workspace-v1.ts').EventFinanceEditorV1;reason:string;reviewed:true};
export type NativeOptionalOwnershipRequestV2={kind:'native-optional-pool-ownership-v2';expectedVersion:number;sourceDigest:string;reason:string;reviewed:true;costClassifications:Array<{expenseEventId:string;category:'player_benefit'|'operating_expense'}>};
const reason=(v:unknown):v is string=>typeof v==='string'&&v.length>=1&&v.length<=2000&&v===v.trim()&&!/[\u0000-\u001f\u007f]/.test(v);
export function isNativeOptionalFinanceProposalRequestV2(value:unknown):value is NativeOptionalFinanceProposalRequestV2{
 try{return bounded(value)&&exact(value,['kind','expectedVersion','sourceDigest','basisDigest','editor','reason','reviewed'])&&value.kind==='native-optional-finance-proposal-v2'&&whole(value.expectedVersion)&&value.expectedVersion<2147483647&&hash(value.sourceDigest)&&hash(value.basisDigest)&&value.reviewed===true&&reason(value.reason)&&isRestorableEventFinanceEditorV1(value.editor)&&value.editor.basis.mode==='estimate'&&value.editor.basis.source.sourceDigest===value.sourceDigest&&value.editor.basis.payoutSource.ledgerDigest===value.sourceDigest&&value.editor.basis.payoutSource.resultsDigest===value.sourceDigest;}catch{return false;}
}
export function isNativeOptionalOwnershipRequestV2(value:unknown):value is NativeOptionalOwnershipRequestV2{
 try{if(!bounded(value)||!exact(value,['kind','expectedVersion','sourceDigest','reason','reviewed','costClassifications'])||value.kind!=='native-optional-pool-ownership-v2'||!whole(value.expectedVersion)||value.expectedVersion>=2147483647||!hash(value.sourceDigest)||value.reviewed!==true||!reason(value.reason)||!Array.isArray(value.costClassifications)||value.costClassifications.length>10000)return false;const ids=new Set<string>();for(const r of value.costClassifications){if(!exact(r,['expenseEventId','category'])||!uuid(r.expenseEventId)||ids.has(r.expenseEventId)||!['player_benefit','operating_expense'].includes(r.category as string))return false;ids.add(r.expenseEventId);}return true;}catch{return false;}
}
export function readNativeOptionalFinanceReconciliationV2(value:unknown,expected:NativeOptionalFinanceScopeV2&{operationId:string;request:unknown}){
 try{
  if(!scopeValid(expected)||!uuid(expected.operationId)||!bounded(value)||!isNativeOptionalFinanceProposalRequestV2(expected.request)||expected.request.editor.basis.source.tournamentId!==expected.tournamentId||expected.request.editor.basis.source.eventId!==expected.eventId)return null;
  if(exact(value,['status','actorId','tournamentId','eventId','operationId'])&&value.status==='unknown'&&scoped(value,expected)&&value.operationId===expected.operationId)return structuredClone(value);
  if(!exact(value,['status','result','currentFundAuthority','moneyMoved'])||value.status!=='historical_operation'||value.currentFundAuthority!==false||value.moneyMoved!==false||!exact(value.result,['status','revisionId','version','actorId','tournamentId','eventId','operationId','sourceDigest','basisDigest','proposalOnly','moneyMoved','payoutAuthorized']))return null;
  const r=value.result;if(r.status!=='optional_finance_proposal_saved_v2'||!uuid(r.revisionId)||r.version!==expected.request.expectedVersion+1||!scoped(r,expected)||r.operationId!==expected.operationId||r.sourceDigest!==expected.request.sourceDigest||r.basisDigest!==expected.request.basisDigest||r.proposalOnly!==true||r.moneyMoved!==false||r.payoutAuthorized!==false)return null;
  return structuredClone(value);
 }catch{return null;}
}
