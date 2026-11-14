import {isUuid} from './validation.ts';
import {isCustomPayoutIntentV1,type CustomPayoutIntentV1} from './custom-payout-intent-v1.ts';
import {
  calculateCustomGraduatedAmountsV3,
  customGraduatedAmountsVersionV3,
  customGraduatedMaximumRatioV3,
  type CustomGraduatedAmountsCalculationV3,
} from '../results/custom-graduated-amounts-v3.ts';

export const customSidePolicyMethodV4='side-custom-graduated-policy-v4' as const;
export const customSideAmountSourceVersionV4='side-custom-amount-source-v4' as const;
export const customSideRefundPolicyV1='no-pool-refunds-v1' as const;
export const customSideOperationKindV4='custom-side-operating-operation-v4' as const;
export const customSideWorkspaceKindV4='custom-side-operating-workspace-v4' as const;
export const customSideProviderWriteKindV4='custom-side-operating-provider-write-v4' as const;

const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const exact=(value:unknown,keys:readonly string[]):value is Record<string,unknown>=>object(value)&&Reflect.ownKeys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const uuid=(value:unknown):value is string=>isUuid(value)&&value===value.toLowerCase();
const hash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const whole=(value:unknown,minimum=0,maximum=Number.MAX_SAFE_INTEGER):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=minimum&&value<=maximum&&!Object.is(value,-0);
const text=(value:unknown,maximum:number):value is string=>typeof value==='string'&&value.length>0&&value.length<=maximum&&value===value.trim()&&!/[\u0000-\u001f\u007f]/.test(value);
const same=(left:unknown,right:unknown)=>JSON.stringify(left,(_key,value)=>object(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,value[key]])):value)===JSON.stringify(right,(_key,value)=>object(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,value[key]])):value);
const clone=<T>(value:T):T=>structuredClone(value);

export type CustomSidePolicyRequestV4={
 action:'publish';setupSidePoolVersionId:string;definitionVersionId:string;
 method:typeof customSidePolicyMethodV4;ratio:number;amountMethod:typeof customGraduatedAmountsVersionV3;
 disclosureReference:string;disclosed:true;intent:CustomPayoutIntentV1;
};
export type CustomSideOperatingOperationV4={kind:typeof customSideOperationKindV4;operationId:string;request:CustomSidePolicyRequestV4};
export type CustomSidePolicyResultV4=
 |{status:'side_custom_policy_published_v4';policyId:string;poolId:string;setupSidePoolVersionId:string;definitionVersionId:string;ratio:number;amountMethod:typeof customGraduatedAmountsVersionV3;moneyMoved:false}
 |{status:'rejected';code:'idempotency_conflict'|'invalid_request'|'setup_pool_mismatch'|'unsupported_scope'|'definition_changed'|'setup_method_conflict'|'unsupported_payout_domain'|'custom_intent_required'|'policy_frozen'|'collection_or_play_started'};

const policyRequestKeys=['action','setupSidePoolVersionId','definitionVersionId','method','ratio','amountMethod','disclosureReference','disclosed','intent'] as const;
const operationKeys=['kind','operationId','request'] as const;
const rejectionCodes=new Set(['idempotency_conflict','invalid_request','setup_pool_mismatch','unsupported_scope','definition_changed','setup_method_conflict','unsupported_payout_domain','custom_intent_required','policy_frozen','collection_or_play_started']);

export function isCustomSidePolicyRequestV4(value:unknown):value is CustomSidePolicyRequestV4{
 if(!exact(value,policyRequestKeys)||value.action!=='publish'||!uuid(value.setupSidePoolVersionId)||!uuid(value.definitionVersionId)||value.method!==customSidePolicyMethodV4||!whole(value.ratio,1,customGraduatedMaximumRatioV3)||value.amountMethod!==customGraduatedAmountsVersionV3||!text(value.disclosureReference,500)||value.disclosed!==true||!isCustomPayoutIntentV1(value.intent))return false;
 return value.intent.scope==='side'&&value.intent.ratioDenominator===value.ratio;
}
export type CustomSidePolicyPreparationV4={
 kind:'custom-side-policy-preparation-v4';poolId:string;setupSidePoolVersionId:string;setupRevisionId:string;setupEventVersionId:string;
 eventClientRowId:string;poolSlot:number;customRatio:number;payoutType:null;definitionVersionId:string;definition:Record<string,unknown>;
 setupBatchId:string;setupActorId:string;setupOperationId:string;setupRequestHash:string;originalIntent:CustomPayoutIntentV1;
 baseSetupRevisionId:string|null;baseSetupVersion:number;baseSourceDigest:string;blockers:string[];canPublish:boolean;
};
const preparationKeys=['kind','poolId','setupSidePoolVersionId','setupRevisionId','setupEventVersionId','eventClientRowId','poolSlot','customRatio','payoutType','definitionVersionId','definition','setupBatchId','setupActorId','setupOperationId','setupRequestHash','originalIntent','baseSetupRevisionId','baseSetupVersion','baseSourceDigest','blockers','canPublish'] as const;
export function isCustomSidePolicyPreparationV4(value:unknown):value is CustomSidePolicyPreparationV4{
 if(!exact(value,preparationKeys)||value.kind!=='custom-side-policy-preparation-v4'||![value.poolId,value.setupSidePoolVersionId,value.setupRevisionId,value.setupEventVersionId,value.eventClientRowId,value.definitionVersionId,value.setupBatchId,value.setupActorId,value.setupOperationId].every(uuid)||!whole(value.poolSlot,1,6)||!whole(value.customRatio,1,customGraduatedMaximumRatioV3)||value.payoutType!==null||!object(value.definition)||value.definition.id!==value.definitionVersionId||!hash(value.setupRequestHash)||!isCustomPayoutIntentV1(value.originalIntent)||value.originalIntent.scope!=='side'||value.originalIntent.ratioDenominator!==value.customRatio||value.originalIntent.source.eventClientRowId!==value.eventClientRowId||value.originalIntent.source.poolSlot!==value.poolSlot||!whole(value.baseSetupVersion,0,2147483647)||(value.baseSetupRevisionId!==null&&!uuid(value.baseSetupRevisionId))||!hash(value.baseSourceDigest)||value.originalIntent.source.setupRevisionId!==value.baseSetupRevisionId||value.originalIntent.source.setupVersion!==value.baseSetupVersion||value.originalIntent.source.sourceDigest!==value.baseSourceDigest||!Array.isArray(value.blockers)||!value.blockers.every(item=>typeof item==='string'&&/^[a-z0-9_]+$/.test(item))||typeof value.canPublish!=='boolean')return false;
 return value.canPublish===(value.blockers.length===0);
}
export function createCustomSidePolicyRequestV4(preparation:unknown,disclosureReference:unknown):CustomSidePolicyRequestV4|null{
 if(!isCustomSidePolicyPreparationV4(preparation)||!preparation.canPublish||!text(disclosureReference,500))return null;
 return clone({action:'publish',setupSidePoolVersionId:preparation.setupSidePoolVersionId,definitionVersionId:preparation.definitionVersionId,method:customSidePolicyMethodV4,ratio:preparation.customRatio,amountMethod:customGraduatedAmountsVersionV3,disclosureReference,disclosed:true,intent:preparation.originalIntent});
}
export function isCustomSideOperatingOperationV4(value:unknown):value is CustomSideOperatingOperationV4{
 return exact(value,operationKeys)&&value.kind===customSideOperationKindV4&&uuid(value.operationId)&&isCustomSidePolicyRequestV4(value.request);
}
export function createCustomSideOperatingOperationV4(operationId:unknown,request:unknown):CustomSideOperatingOperationV4|null{
 const value={kind:customSideOperationKindV4,operationId,request};
 return isCustomSideOperatingOperationV4(value)?clone(value):null;
}
export function isCustomSidePolicyResultV4(value:unknown):value is CustomSidePolicyResultV4{
 if(!object(value))return false;
 if(value.status==='rejected')return exact(value,['status','code'])&&typeof value.code==='string'&&rejectionCodes.has(value.code);
 return exact(value,['status','policyId','poolId','setupSidePoolVersionId','definitionVersionId','ratio','amountMethod','moneyMoved'])&&value.status==='side_custom_policy_published_v4'&&uuid(value.policyId)&&uuid(value.poolId)&&uuid(value.setupSidePoolVersionId)&&uuid(value.definitionVersionId)&&whole(value.ratio,1,customGraduatedMaximumRatioV3)&&value.amountMethod===customGraduatedAmountsVersionV3&&value.moneyMoved===false;
}
export function customSidePolicyResultMatchesV4(result:unknown,operation:unknown,poolId:unknown):result is CustomSidePolicyResultV4{
 if(!isCustomSidePolicyResultV4(result)||!isCustomSideOperatingOperationV4(operation)||!uuid(poolId))return false;
 if(result.status==='rejected')return true;
 return result.poolId===poolId&&result.setupSidePoolVersionId===operation.request.setupSidePoolVersionId&&result.definitionVersionId===operation.request.definitionVersionId&&result.ratio===operation.request.ratio&&result.amountMethod===operation.request.amountMethod;
}

export type CustomSidePolicyBindingV4={
 kind:'custom-side-policy-binding-v4';policyId:string;operationReceiptId:string;poolId:string;
 method:typeof customSidePolicyMethodV4;ratio:number;amountMethod:typeof customGraduatedAmountsVersionV3;
 definitionVersionId:string;definition:Record<string,unknown>;disclosureReference:string;policyActorId:string;policyOperationId:string;policyRequestHash:string;
 materializationId:string;materializationReceiptId:string;setupSidePoolVersionId:string;setupRevisionId:string;setupEventVersionId:string;eventClientRowId:string;
 poolSlot:number;customRatio:number;payoutType:null;setupBatchId:string;setupActorId:string;setupOperationId:string;setupRequestHash:string;
 originalIntent:CustomPayoutIntentV1;baseSetupRevisionId:string|null;baseSetupVersion:number;baseSourceDigest:string;
};
const bindingKeys=['kind','policyId','operationReceiptId','poolId','method','ratio','amountMethod','definitionVersionId','definition','disclosureReference','policyActorId','policyOperationId','policyRequestHash','materializationId','materializationReceiptId','setupSidePoolVersionId','setupRevisionId','setupEventVersionId','eventClientRowId','poolSlot','customRatio','payoutType','setupBatchId','setupActorId','setupOperationId','setupRequestHash','originalIntent','baseSetupRevisionId','baseSetupVersion','baseSourceDigest'] as const;
export function isCustomSidePolicyBindingV4(value:unknown):value is CustomSidePolicyBindingV4{
 if(!exact(value,bindingKeys)||value.kind!=='custom-side-policy-binding-v4'||![value.policyId,value.operationReceiptId,value.poolId,value.definitionVersionId,value.policyActorId,value.policyOperationId,value.materializationId,value.materializationReceiptId,value.setupSidePoolVersionId,value.setupRevisionId,value.setupEventVersionId,value.eventClientRowId,value.setupBatchId,value.setupActorId,value.setupOperationId].every(uuid)||!object(value.definition)||value.definition.id!==value.definitionVersionId||value.method!==customSidePolicyMethodV4||value.amountMethod!==customGraduatedAmountsVersionV3||!whole(value.ratio,1,customGraduatedMaximumRatioV3)||value.customRatio!==value.ratio||!whole(value.poolSlot,1,6)||value.payoutType!==null||!text(value.disclosureReference,500)||![value.policyRequestHash,value.setupRequestHash,value.baseSourceDigest].every(hash)||!isCustomPayoutIntentV1(value.originalIntent)||value.originalIntent.scope!=='side'||value.originalIntent.ratioDenominator!==value.ratio||value.originalIntent.source.eventClientRowId!==value.eventClientRowId||value.originalIntent.source.poolSlot!==value.poolSlot||!whole(value.baseSetupVersion,0,2147483647)||(value.baseSetupRevisionId!==null&&!uuid(value.baseSetupRevisionId))||value.originalIntent.source.setupRevisionId!==value.baseSetupRevisionId||value.originalIntent.source.setupVersion!==value.baseSetupVersion||value.originalIntent.source.sourceDigest!==value.baseSourceDigest)return false;
 return true;
}

export type CustomSideAmountSourceV4={
 definitionId:string;eventId:string;poolId:string;name:string;feeMinor:number;
 policy:{id:string;method:typeof customSidePolicyMethodV4;ratio:number;disclosureReference:string;publishedAt:string};
 paidCount:number;entries:Array<{participantId:string;electionId:string;version:number;elected:boolean;dueMinor:number;receivedMinor:number}>;
 sourceDigest:string;manifest:Record<string,unknown>&{sourceVersion:typeof customSideAmountSourceVersionV4;customAlgorithmVersion:typeof customGraduatedAmountsVersionV3;refundPolicy:typeof customSideRefundPolicyV1;customPolicyBinding:CustomSidePolicyBindingV4;blockers:string[]};
 blockers:string[];calculation:CustomGraduatedAmountsCalculationV3|null;
};
function customCalculation(value:unknown,paidCount:number,feeMinor:number,ratio:number):value is CustomGraduatedAmountsCalculationV3{
 const calculated=calculateCustomGraduatedAmountsV3({paidCount,feeMinor,ratio});
 return calculated.status==='calculated'&&same(value,calculated);
}
export function isCustomSideAmountSourceV4(value:unknown,expected:{eventId:string;poolId:string;binding:CustomSidePolicyBindingV4}):value is CustomSideAmountSourceV4{
 if(!object(value)||!uuid(expected.eventId)||!uuid(expected.poolId)||!isCustomSidePolicyBindingV4(expected.binding)||!uuid(value.definitionId)||value.eventId!==expected.eventId||value.poolId!==expected.poolId||value.definitionId!==expected.binding.definitionVersionId||!text(value.name,100)||!whole(value.feeMinor,500,100000000)||value.feeMinor%500!==0||!object(value.policy)||!exact(value.policy,['id','method','ratio','disclosureReference','publishedAt'])||value.policy.id!==expected.binding.policyId||value.policy.method!==customSidePolicyMethodV4||value.policy.ratio!==expected.binding.ratio||value.policy.disclosureReference!==expected.binding.disclosureReference||typeof value.policy.publishedAt!=='string'||!Number.isFinite(Date.parse(value.policy.publishedAt))||!whole(value.paidCount,0,10000)||!Array.isArray(value.entries)||value.entries.length>10000||!hash(value.sourceDigest)||!Array.isArray(value.blockers)||!value.blockers.every(item=>typeof item==='string'&&/^[a-z0-9_]+$/.test(item))||!object(value.manifest))return false;
 if(value.manifest.sourceVersion!==customSideAmountSourceVersionV4||value.manifest.customAlgorithmVersion!==customGraduatedAmountsVersionV3||value.manifest.refundPolicy!==customSideRefundPolicyV1||!isCustomSidePolicyBindingV4(value.manifest.customPolicyBinding)||!same(value.manifest.customPolicyBinding,expected.binding)||!same(value.manifest.blockers,value.blockers))return false;
 if(!value.entries.every(entry=>exact(entry,['participantId','electionId','version','elected','dueMinor','receivedMinor'])&&uuid(entry.participantId)&&uuid(entry.electionId)&&whole(entry.version,1,256)&&typeof entry.elected==='boolean'&&whole(entry.dueMinor,0,100000000)&&whole(entry.receivedMinor,0,100000000)))return false;
 const unique=new Set(value.entries.map(entry=>object(entry)?entry.participantId:null));if(unique.size!==value.entries.length)return false;
 const paid=value.entries.filter(entry=>object(entry)&&entry.elected===true&&entry.dueMinor===value.feeMinor&&entry.receivedMinor===value.feeMinor).length;if(value.paidCount!==paid)return false;
 if(value.blockers.length!==0)return value.calculation===null;
 return customCalculation(value.calculation,value.paidCount,value.feeMinor,value.policy.ratio)&&value.calculation.recipientCount>0&&value.paidCount>0;
}

export type CustomSideOperatingWorkspaceV4={
 kind:typeof customSideWorkspaceKindV4;actorId:string;tournamentId:string;eventId:string;poolId:string;
 status:'prepared'|'published'|'blocked';preparation:CustomSidePolicyPreparationV4;
 binding:CustomSidePolicyBindingV4|null;source:CustomSideAmountSourceV4|null;
 proposalOnly:true;moneyMoved:false;payoutAuthorized:false;finalizationAuthorized:false;
};
const workspaceKeys=['kind','actorId','tournamentId','eventId','poolId','status','preparation','binding','source','proposalOnly','moneyMoved','payoutAuthorized','finalizationAuthorized'] as const;
export function readCustomSideOperatingWorkspaceV4(value:unknown,expected:{actorId:string;tournamentId:string;eventId:string;poolId:string}):CustomSideOperatingWorkspaceV4|null{
 if(![expected.actorId,expected.tournamentId,expected.eventId,expected.poolId].every(uuid)||!exact(value,workspaceKeys)||value.kind!==customSideWorkspaceKindV4||value.actorId!==expected.actorId||value.tournamentId!==expected.tournamentId||value.eventId!==expected.eventId||value.poolId!==expected.poolId||!['prepared','published','blocked'].includes(value.status as string)||value.proposalOnly!==true||value.moneyMoved!==false||value.payoutAuthorized!==false||value.finalizationAuthorized!==false||!isCustomSidePolicyPreparationV4(value.preparation)||value.preparation.poolId!==expected.poolId||value.preparation.originalIntent.source.tournamentId!==expected.tournamentId)return null;
 if(value.status==='published'){
  if(!isCustomSidePolicyBindingV4(value.binding)||value.binding.poolId!==expected.poolId||value.binding.originalIntent.source.tournamentId!==expected.tournamentId||value.binding.setupSidePoolVersionId!==value.preparation.setupSidePoolVersionId||value.binding.definitionVersionId!==value.preparation.definitionVersionId||!isCustomSideAmountSourceV4(value.source,{eventId:expected.eventId,poolId:expected.poolId,binding:value.binding}))return null;
 }else if(value.binding!==null||value.source!==null||value.status==='prepared'!==value.preparation.canPublish)return null;
 return clone(value) as CustomSideOperatingWorkspaceV4;
}

export type CustomSideProviderWriteV4={kind:typeof customSideProviderWriteKindV4;actorId:string;tournamentId:string;eventId:string;poolId:string;operationId:string;operation:CustomSideOperatingOperationV4;outcome:CustomSidePolicyResultV4|null};
export function readCustomSideProviderWriteV4(value:unknown,expected:{actorId:string;tournamentId:string;eventId:string;poolId:string;operation:CustomSideOperatingOperationV4}):CustomSideProviderWriteV4|null{
 if(![expected.actorId,expected.tournamentId,expected.eventId,expected.poolId].every(uuid)||!isCustomSideOperatingOperationV4(expected.operation)||!exact(value,['kind','actorId','tournamentId','eventId','poolId','operationId','operation','outcome'])||value.kind!==customSideProviderWriteKindV4||value.actorId!==expected.actorId||value.tournamentId!==expected.tournamentId||value.eventId!==expected.eventId||value.poolId!==expected.poolId||value.operationId!==expected.operation.operationId||!same(value.operation,expected.operation)||(value.outcome!==null&&!customSidePolicyResultMatchesV4(value.outcome,expected.operation,expected.poolId)))return null;
 return clone(value) as CustomSideProviderWriteV4;
}
