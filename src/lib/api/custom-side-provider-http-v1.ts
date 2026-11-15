import { integratedTestUiEnabled as integratedTestFeatureEnabled } from '../integrated-test-target.ts';
import {
 isCustomSideOperatingOperationV4,
 readCustomSideOperatingWorkspaceV4,
 readCustomSideProviderWriteV4,
 type CustomSideOperatingOperationV4,
 type CustomSideProviderWriteV4,
 type CustomSideOperatingWorkspaceV4,
} from './custom-side-operating-v4.ts';
import {isUuid} from './validation.ts';

export type CustomSideHttpScopeV1={actorId:string;tournamentId:string;eventId:string;poolId:string};
const uuid=(value:unknown):value is string=>isUuid(value)&&value===value.toLowerCase();
export const customSideHttpEnabledV1=()=>integratedTestFeatureEnabled();
const maximumBytes=4200000;

async function readJson(response:Response){
 if(response.redirected||!response.headers.get('content-type')?.toLowerCase().startsWith('application/json')||!response.body)throw Error('provider_response_unavailable');
 const reader=response.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let bytes=0,text='';
 try{for(;;){const{done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>maximumBytes){await reader.cancel();throw Error('provider_response_too_large');}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}
 catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
 return JSON.parse(text) as unknown;
}

/** Disabled injectable browser transport. It cannot address legacy Side V2 or
 * workbook comparison routes and never retries or changes an operation body. */
export function createCustomSideProviderHttpV1(scope:CustomSideHttpScopeV1,options:{enabled?:()=>boolean;fetch?:typeof globalThis.fetch}={}){
 const fixedScope=structuredClone(scope);if(![fixedScope.actorId,fixedScope.tournamentId,fixedScope.eventId,fixedScope.poolId].every(uuid))throw Error('invalid_provider_scope');
 const enabled=options.enabled??customSideHttpEnabledV1,fetcher=options.fetch??globalThis.fetch;
 const base=`/api/v1/tournaments/${fixedScope.tournamentId}/events/${fixedScope.eventId}/side-pools/${fixedScope.poolId}/custom-v4`;
 async function call(path:string,operation?:CustomSideOperatingOperationV4){
  if(enabled()!==true)throw Error('provider_disabled');if(operation!==undefined&&!isCustomSideOperatingOperationV4(operation))throw Error('invalid_provider_request');
  const raw=operation===undefined?undefined:JSON.stringify(operation);if(raw!==undefined&&new TextEncoder().encode(raw).byteLength>maximumBytes)throw Error('provider_request_too_large');
  const response=await fetcher(path,{method:raw===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',redirect:'error',headers:raw===undefined?{accept:'application/json','x-expected-actor-id':fixedScope.actorId}:{accept:'application/json','content-type':'application/json','x-expected-actor-id':fixedScope.actorId},...(raw===undefined?{}:{body:raw})});
  if(![200,409].includes(response.status))throw Error('provider_response_unavailable');return readJson(response);
 }
 return{
  workspace:async():Promise<CustomSideOperatingWorkspaceV4>=>{const value=await call(base),decoded=readCustomSideOperatingWorkspaceV4(value,fixedScope);if(!decoded)throw Error('invalid_provider_response');return decoded;},
  save:async(operation:CustomSideOperatingOperationV4):Promise<CustomSideProviderWriteV4>=>{const fixedOperation=structuredClone(operation);if(!isCustomSideOperatingOperationV4(fixedOperation))throw Error('invalid_provider_request');const value=await call(base,fixedOperation),decoded=readCustomSideProviderWriteV4(value,{...fixedScope,operation:fixedOperation});if(!decoded)throw Error('invalid_provider_response');return decoded;},
  reconcile:async(operation:CustomSideOperatingOperationV4):Promise<CustomSideProviderWriteV4>=>{const fixedOperation=structuredClone(operation);if(!isCustomSideOperatingOperationV4(fixedOperation))throw Error('invalid_provider_request');const value=await call(`${base}/operations/${fixedOperation.operationId}`,fixedOperation),decoded=readCustomSideProviderWriteV4(value,{...fixedScope,operation:fixedOperation});if(!decoded)throw Error('invalid_provider_response');return decoded;},
 };
}
