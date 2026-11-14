import {isRestorableEventFinanceEditorV1} from './event-finance-draft-codec-v1.ts';
import {isOperationalFinanceEstimateBasisV1,type OperationalFinanceEstimateBasisV1} from './operational-finance-estimate-basis-v1.ts';
import type {EventFinanceEditorV1} from './event-finance-workspace-v1.ts';
export type OperationalFinanceProposalRequestV1={kind:'operational-event-finance-proposal-v1';operationId:string;expectedVersion:number;expectedSourceDigest:string;expectedBasisDigest:string;editor:EventFinanceEditorV1;reason:string};
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const canonical=(v:unknown):string=>JSON.stringify(v,(_k,x)=>obj(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
/** Structural preflight only. The database must independently authenticate, lock,
 * rerun the source, CAS, and journal the exact operation. This grants no write. */
export function validateOperationalFinanceProposalRequestV1(value:unknown,current:OperationalFinanceEstimateBasisV1,basisDigest:string):OperationalFinanceProposalRequestV1|null{
 const keys=['kind','operationId','expectedVersion','expectedSourceDigest','expectedBasisDigest','editor','reason'];
 if(!isOperationalFinanceEstimateBasisV1(current)||!hash(basisDigest)||!obj(value)||Reflect.ownKeys(value).length!==keys.length||!keys.every(k=>{const d=Object.getOwnPropertyDescriptor(value,k);return !!d&&'value'in d&&d.enumerable;})
 ||value.kind!=='operational-event-finance-proposal-v1'||typeof value.operationId!=='string'||!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value.operationId)
 ||typeof value.expectedVersion!=='number'||!Number.isSafeInteger(value.expectedVersion)||value.expectedVersion<0||value.expectedVersion>2147483646||Object.is(value.expectedVersion,-0)
 ||value.expectedSourceDigest!==current.sourceDigest||value.expectedBasisDigest!==basisDigest||typeof value.reason!=='string'||value.reason!==value.reason.trim()||!value.reason||value.reason.length>2000||/[\u0000-\u001f\u007f]/.test(value.reason)
 ||!isRestorableEventFinanceEditorV1(value.editor)||canonical(value.editor.basis)!==canonical(current.workspace))return null;
 return structuredClone(value) as OperationalFinanceProposalRequestV1;
}
