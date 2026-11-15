import { integratedTestUiEnabled as integratedTestFeatureEnabled } from '../integrated-test-target.ts';
import {RecordedCostReviewControllerV1,parseRecordedCostReviewDraftV1} from './recorded-cost-review-controller-v1.ts';
import {NativeCostAdoptionOperationV1,type NativeCostAdoptionOperationPortV1} from './native-cost-adoption-operation-v1.ts';
import {isPreparedNativeCostAdoptionV1} from './native-cost-adoption-plan-v1.ts';
import {isRestorableEventFinanceEditorV1} from './event-finance-draft-codec-v1.ts';
import {isEventFinanceWorkspaceV1} from './event-finance-workspace-v1.ts';
import type {FinanceDraftRetainedPortV1} from './event-finance-draft-retained-v1.ts';
import type {FinanceProviderScopeV1,FinanceProviderUiWorkspaceV1} from './operational-finance-provider-ui-v1.ts';

export const recordedCostAdoptionPageEnabledV1=()=>integratedTestFeatureEnabled();
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const canonical=(v:unknown)=>JSON.stringify(v,(_k,x)=>obj(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const same=(a:unknown,b:unknown)=>canonical(a)===canonical(b);
const uuid=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
export type RecordedCostAdoptionPagePortsV1={finance:()=>Promise<FinanceProviderUiWorkspaceV1>;adoption:()=>Promise<{raw:unknown;prepared:unknown;blocked:boolean}>;operation:NativeCostAdoptionOperationPortV1};
function financeMatches(v:FinanceProviderUiWorkspaceV1,scope:FinanceProviderScopeV1){return same(v.scope,scope)&&isEventFinanceWorkspaceV1(v.current)&&isRestorableEventFinanceEditorV1(v.editor)&&v.current.source.tournamentId===scope.tournamentId&&v.current.source.eventId===scope.eventId&&v.current.payoutSource.tournamentId===scope.tournamentId&&v.current.payoutSource.eventId===scope.eventId&&v.editor.basis.source.tournamentId===scope.tournamentId&&v.editor.basis.source.eventId===scope.eventId;}
/** Fixed-account page composition, not authority. HTTP ports must independently
 * authenticate each request. No storage enumeration, deletion or source rebasing.
 * Existing ordinary Finance work conservatively blocks NEW adoption submissions;
 * its independent recovery flow remains responsible for resolving that work. */
export async function prepareRecordedCostAdoptionPageV1(input:{enabled?:boolean;scope:FinanceProviderScopeV1;role:string;retained:FinanceDraftRetainedPortV1;ports:RecordedCostAdoptionPagePortsV1;isCurrent:()=>boolean}){
 const {retained,ports,isCurrent}=input,scope=structuredClone(input.scope);
 if(input.enabled!==true||!['director','co_director'].includes(input.role)||Object.keys(scope).length!==3||!Object.values(scope).every(uuid))return{status:'blocked' as const,code:'page_disabled_or_scope_unavailable'};
 const check=()=>{if(!isCurrent())throw Error('page_owner_changed');};
 check();const workspace=await ports.finance();check();if(!financeMatches(workspace,scope))throw Error('finance_scope_unavailable');
 // Authenticate first, then inspect only the three exact matching recovery keys.
 const suffix=`${scope.actorId}:${scope.tournamentId}:${scope.eventId}`;
 const ordinaryKeys=[`finance-device-draft-v1:${suffix}`,`finance-provider-operation-v1:${suffix}`];
 const ordinaryClear=async()=>{check();for(const key of ordinaryKeys){if(await retained.read(key)!==null){check();return false;}check();}return true;};
 const clear=await ordinaryClear();check();
 const savedRaw=await retained.read(`recorded-cost-review-draft-v1:${suffix}`);check();
 const saved=savedRaw===null?null:parseRecordedCostReviewDraftV1(savedRaw,scope);
 if(savedRaw!==null&&!saved)return{status:'blocked' as const,code:'retained_review_unreadable'};
 const next=await ports.adoption();check();
 const prepared=isPreparedNativeCostAdoptionV1(next.prepared)&&same({actorId:next.prepared.actorId,tournamentId:next.prepared.tournamentId,eventId:next.prepared.eventId},scope)?next.prepared:null;
 if(!obj(next.raw)||next.raw.kind!=='operational-finance-source-adoption-workspace-v1'||!['available','blocked'].includes(next.raw.status as string)||next.blocked!==(next.raw.status==='blocked')||next.raw.actorId!==scope.actorId||next.raw.tournamentId!==scope.tournamentId||next.raw.eventId!==scope.eventId||next.raw.proposalOnly!==true||next.raw.moneyMoved!==false||next.raw.payoutAuthorized!==false||next.raw.finalizationAuthorized!==false)throw Error('adoption_scope_unavailable');
 if(prepared&&(next.blocked||!same(workspace.current,prepared.current)||workspace.sourceDigest!==prepared.current.source.sourceDigest||workspace.basisDigest!==prepared.currentBasisDigest||workspace.headRevisionId!==prepared.head.revisionId||workspace.version!==prepared.head.version||!same(workspace.editor,prepared.head.editor)))throw Error('page_sources_changed');
 if(!prepared&&!next.blocked)throw Error('adoption_source_unavailable');
 if(!prepared&&!saved)return{status:'blocked' as const,code:'no_current_adoption_source'};
 const controller=new RecordedCostReviewControllerV1(scope,saved?.source??prepared,saved?.feeMetadata??next.raw.sanctioning??null);
 // A changed/unavailable source hides old amounts but still permits explicit
 // operation reconciliation and accepted-head archival from retained evidence.
 controller.updateSource(clear?prepared:null,next.raw.sanctioning??null);
 const operation=new NativeCostAdoptionOperationV1(scope,retained,{
  save:async request=>{check();if(!await ordinaryClear())throw Error('ordinary_finance_recovery_required');const fresh=await ports.finance();check();if(!financeMatches(fresh,scope)||fresh.headRevisionId!==request.expectedPriorRevisionId||fresh.version!==request.expectedVersion||fresh.sourceDigest!==request.expectedCurrentSourceDigest||fresh.basisDigest!==request.expectedCurrentBasisDigest)throw Error('page_sources_changed');if(!await ordinaryClear())throw Error('ordinary_finance_recovery_required');check();return ports.operation.save(request);},
  reconcile:async operationId=>{check();const reply=await ports.operation.reconcile(operationId);check();return reply;},
 });
 return{status:'ready' as const,controller,operation,ordinaryRecoveryRequired:!clear,readCurrentFinance:async()=>{check();const fresh=await ports.finance();check();if(!financeMatches(fresh,scope))throw Error('finance_scope_unavailable');return fresh;}};
}
