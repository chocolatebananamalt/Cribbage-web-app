import {isUuid} from './validation.ts';
import {balancedQMethodV3,isQOperatingRequestV3,isQOperatingResultV3,isQOperatingWorkspaceV3,type QOperatingResultV3,type QOperatingWorkspaceV3,type QOperatingPolicyRecordV3} from './q-operating-schedules.ts';
import {graduatedPoolAmountsVersionV2} from '../results/graduated-pool-amounts-v2.ts';

export const graduatedQMethodV4=graduatedPoolAmountsVersionV2;
export type QGraduatedPolicyRequestV4={action:'publish';poolVersionId:string;method:typeof graduatedQMethodV4;ratio:4|6;scheduleId:typeof graduatedQMethodV4;disclosureReference:string;disclosed:true};
export type QOperatingWorkspaceV4=Omit<QOperatingWorkspaceV3,'policies'>&{policies:Array<Omit<QOperatingPolicyRecordV3,'method'>&{method:QOperatingPolicyRecordV3['method']|typeof graduatedQMethodV4}>};
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
/** Adapt only the new literal for structural validation, preserving the strict
 * old codecs and every old retained request's original version and endpoint. */
export function isQGraduatedPolicyRequestV4(v:unknown):v is QGraduatedPolicyRequestV4{
 return obj(v)&&v.method===graduatedQMethodV4&&v.scheduleId===graduatedQMethodV4&&isQOperatingRequestV3({...v,method:balancedQMethodV3,scheduleId:balancedQMethodV3});
}
export function isQOperatingWorkspaceV4(v:unknown,tid:string):v is QOperatingWorkspaceV4{
 if(!obj(v)||!Array.isArray(v.policies))return false;
 const normalized={...v,policies:v.policies.map(p=>obj(p)&&p.method===graduatedQMethodV4?{...p,method:balancedQMethodV3,scheduleId:p.scheduleId===graduatedQMethodV4?balancedQMethodV3:p.scheduleId}:p)};
 if(!isQOperatingWorkspaceV3(normalized,tid))return false;
 return normalized.membership===null||v.policies.every(p=>!obj(p)||p.method!==graduatedQMethodV4||normalized.membership!.pools.some(pool=>pool.poolVersionId===p.poolVersionId&&pool.feeMinor>=500&&pool.feeMinor<=100_000_000&&pool.feeMinor%500===0));
}
export const isQGraduatedPolicyResultV4=isQOperatingResultV3;
export type QGraduatedPolicyResultV4=QOperatingResultV3;
export function qGraduatedPolicyResultMatchesV4(r:QGraduatedPolicyResultV4,request:QGraduatedPolicyRequestV4){return r.status==='rejected'||r.poolVersionId.toLowerCase()===request.poolVersionId.toLowerCase();}
export function isQGraduatedReconciliationRequestV4(v:unknown):v is{operationId:string;request:QGraduatedPolicyRequestV4}{return obj(v)&&exact(v,['operationId','request'])&&isUuid(v.operationId)&&isQGraduatedPolicyRequestV4(v.request);}
