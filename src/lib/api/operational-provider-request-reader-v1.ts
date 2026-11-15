import 'server-only';
import{readBoundedJson}from'./bounded-json.ts';

export const operationalProviderRequestBodyLimitV1=4_200_000;

export async function readOperationalProviderJsonV1(request:Request,limit:{maxBytes:number}){
 const requested=limit.maxBytes;
 if(!Number.isSafeInteger(requested)||requested<1)return null;
 return readBoundedJson(request,Math.min(requested,operationalProviderRequestBodyLimitV1));
}
