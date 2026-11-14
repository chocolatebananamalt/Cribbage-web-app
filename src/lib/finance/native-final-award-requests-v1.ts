import 'server-only';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return!!d&&'value'in d&&d.enumerable;});
const uuid=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const version=(v:unknown)=>typeof v==='number'&&Number.isInteger(v)&&v>=0&&v<=2147483646&&!Object.is(v,-0);
const text=(v:unknown,max:number)=>typeof v==='string'&&v.trim()===v&&v.length>0&&v.length<=max&&!/[\u0000-\u001f\u007f]/.test(v);
/** Structural preflight only; the private server re-reads all posted IDs and
 * digests. No posted recipient or amount is accepted as financial authority. */
export function validateNativeFinalAwardRequestV1(value:unknown){
 if(!exact(value,['kind','operationId','expectedVersion','expectedSourceDigest','expectedRecipientSourceDigest','expectedFundSourceDigest','expectedProposalRevisionId','expectedFundReviewId','reason'])||value.kind!=='native-playoff-final-awards-v1'||!uuid(value.operationId)||!version(value.expectedVersion)||value.expectedVersion!==0||![value.expectedSourceDigest,value.expectedRecipientSourceDigest,value.expectedFundSourceDigest].every(hash)||![value.expectedProposalRevisionId,value.expectedFundReviewId].every(uuid)||!text(value.reason,2000))return null;
 return structuredClone(value);
}
export function validateNativeRecordedIncomeRequestV1(value:unknown){
 if(!exact(value,['kind','operationId','expectedVersion','proposalRevisionId','recordId','physicalEvidenceId','evidenceReference'])||value.kind!=='native-unrestricted-income-record-v1'||![value.operationId,value.proposalRevisionId,value.recordId,value.physicalEvidenceId].every(uuid)||!version(value.expectedVersion)||!text(value.evidenceReference,500))return null;
 return structuredClone(value);
}
export function validateNativeFundReviewRequestV1(value:unknown){
 if(!exact(value,['kind','operationId','expectedVersion','proposalRevisionId','nativeAllocationRevisionId','incomeHeadVersion','incomeHeadDigest','status','sanctioningExpenseEventId','reason'])||value.kind!=='native-recorded-fund-review-v1'||![value.operationId,value.proposalRevisionId,value.nativeAllocationRevisionId].every(uuid)||!version(value.expectedVersion)||!version(value.incomeHeadVersion)||!hash(value.incomeHeadDigest)||!['reviewed_zero','recorded_complete'].includes(value.status as string)||(value.sanctioningExpenseEventId!==null&&!uuid(value.sanctioningExpenseEventId))||!text(value.reason,2000))return null;
 return structuredClone(value);
}
