import {isSetupSaveRequest, type SetupSaveRequest} from './api/setup.ts';
import {isUuid} from './api/validation.ts';
type StoragePort=Pick<Storage,'getItem'|'removeItem'>;
export type AcceptedSetupReceipt={revisionId:string;version:number};
export function acceptedSetupKey(key:string,operationId:string){return `${key}:accepted:${operationId}`;}
export function parseAcceptedSetupReceipt(raw:string|null,request:SetupSaveRequest):AcceptedSetupReceipt|null{
 try{
  const v:unknown=JSON.parse(raw??'null');
  if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join()!=='kind,operationId,revisionId,version')return null;
  const x=v as Record<string,unknown>;
  return x.kind==='tournament-setup-accepted'&&x.operationId===request.idempotencyKey&&isUuid(x.revisionId)&&x.version===request.expectedVersion+1?{revisionId:x.revisionId,version:x.version}:null;
 }catch{return null;}
}
/** Called only after server receipt and exact saved-term verification. Never delete conflicting recovery data. */
export function clearVerifiedSetupRecovery(storage:StoragePort,key:string,request:SetupSaveRequest,receipt:AcceptedSetupReceipt):'cleared'|'conflict'|'unavailable'{
 try{
  const raw=storage.getItem(key);
  if(raw!==null){
   const original:unknown=JSON.parse(raw);
   if(!original||typeof original!=='object'||!('kind'in original)||original.kind!=='tournament-setup'||!('request'in original)||!isSetupSaveRequest(original.request)||JSON.stringify(original.request)!==JSON.stringify(request))return'conflict';
  }
  const ackKey=acceptedSetupKey(key,request.idempotencyKey),ackRaw=storage.getItem(ackKey);
  if(ackRaw!==null){const ack=parseAcceptedSetupReceipt(ackRaw,request);if(!ack||ack.revisionId!==receipt.revisionId||ack.version!==receipt.version)return'conflict';}
  // Keep the original retry operation if acknowledgement cleanup cannot finish.
  storage.removeItem(ackKey);if(storage.getItem(ackKey)!==null)return'unavailable';
  if(storage.getItem(key)!==raw)return'conflict';
  storage.removeItem(key);return storage.getItem(key)===null?'cleared':'unavailable';
 }catch{return'unavailable';}
}
