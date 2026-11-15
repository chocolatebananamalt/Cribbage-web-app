import {createEventFinanceEditorV1,isEventFinanceWorkspaceV1,projectEventFinanceSectionV1,type EventFinanceEditorV1,type EventFinanceWorkspaceV1} from './event-finance-workspace-v1.ts';
import {isRestorableEventFinanceEditorV1} from './event-finance-draft-codec-v1.ts';
export type FinanceProviderScopeV1={actorId:string;tournamentId:string;eventId:string};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const version=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>=0;
const same=(a:unknown,b:unknown)=>JSON.stringify(a,(_k,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x)===JSON.stringify(b,(_k,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const inScope=(w:EventFinanceWorkspaceV1,s:FinanceProviderScopeV1)=>w.source.tournamentId===s.tournamentId&&w.source.eventId===s.eventId&&w.payoutSource.tournamentId===s.tournamentId&&w.payoutSource.eventId===s.eventId;
/** Decode only the authenticated route's server-prepared projection. This is
 * not authentication and cannot turn supplied JSON into ledger evidence. */
export function readFinanceProviderUiWorkspaceV1(v:unknown,scope:FinanceProviderScopeV1){
 if(!exact(scope,['actorId','tournamentId','eventId'])||!Object.values(scope).every(uuid)||!exact(v,['kind','actorId','tournamentId','eventId','currentSource','head','compatibility','proposalOnly','moneyMoved','payoutAuthorized','finalizationAuthorized','preparedCurrent','currentBasisDigest'])||v.kind!=='operational-finance-provider-workspace-v1'||v.actorId!==scope.actorId||v.tournamentId!==scope.tournamentId||v.eventId!==scope.eventId||v.proposalOnly!==true||v.moneyMoved!==false||v.payoutAuthorized!==false||v.finalizationAuthorized!==false||!isEventFinanceWorkspaceV1(v.preparedCurrent)||!inScope(v.preparedCurrent,scope)||v.preparedCurrent.mode!=='estimate'||!hash(v.currentBasisDigest)||!object(v.currentSource)||v.currentSource.actorId!==scope.actorId||v.currentSource.tournamentId!==scope.tournamentId||v.currentSource.eventId!==scope.eventId||v.currentSource.sourceDigest!==v.preparedCurrent.source.sourceDigest||v.currentSource.basisDigest!==v.currentBasisDigest)return null;
 if(!exact(v.compatibility,['status','editable'])||!['empty','same_basis','source_revision_changed_requires_review'].includes(v.compatibility.status as string)||v.compatibility.editable!==(v.compatibility.status!=='source_revision_changed_requires_review'))return null;
 const current=structuredClone(v.preparedCurrent),head=v.head;
 if(head===null)return v.compatibility.status==='empty'?{scope:structuredClone(scope),current,sourceDigest:current.source.sourceDigest,basisDigest:v.currentBasisDigest,version:0,headRevisionId:null,editor:createEventFinanceEditorV1(current)!,editable:true}:null;
 if(!exact(head,['revisionId','version','sourceDigest','basisDigest','editor','reason','createdAt'])||!uuid(head.revisionId)||!version(head.version)||head.version<1||!hash(head.sourceDigest)||!hash(head.basisDigest)||!isRestorableEventFinanceEditorV1(head.editor)||!inScope(head.editor.basis,scope)||typeof head.reason!=='string'||!head.reason.trim()||typeof head.createdAt!=='string'||!Number.isFinite(Date.parse(head.createdAt))||v.compatibility.status==='empty')return null;
 const compatible=head.sourceDigest===current.source.sourceDigest&&head.basisDigest===v.currentBasisDigest&&same(head.editor.basis,current);
 if(compatible!==(v.compatibility.status==='same_basis'))return null;
 return{scope:structuredClone(scope),current,sourceDigest:current.source.sourceDigest,basisDigest:v.currentBasisDigest,version:head.version,headRevisionId:head.revisionId,editor:structuredClone(head.editor),editable:compatible};
}
export type FinanceProviderUiWorkspaceV1=NonNullable<ReturnType<typeof readFinanceProviderUiWorkspaceV1>>;
export function prepareFinanceProviderSaveV1(workspace:FinanceProviderUiWorkspaceV1,editor:EventFinanceEditorV1,operationId:string,reason:string){
 if(!workspace.editable||!uuid(operationId)||typeof reason!=='string'||!reason.trim()||reason.trim().length>2000||!isRestorableEventFinanceEditorV1(editor)||!same(editor.basis,workspace.current)||editor.lineForm!==null||editor.bandForm!==null)return null;
 const view=projectEventFinanceSectionV1(editor,workspace.current);
 if(view.blocked||view.payoutReview?.status==='review_required'||view.payoutReview?.status==='blocked')return null;
 return{kind:'operational-event-finance-proposal-v1' as const,operationId,expectedVersion:workspace.version,expectedSourceDigest:workspace.sourceDigest,expectedBasisDigest:workspace.basisDigest,editor:structuredClone(editor),reason:reason.trim()};
}
