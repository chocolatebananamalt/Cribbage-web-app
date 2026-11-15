import {createFinanceJsonHttpV1} from './finance-provider-json-http-v1.ts';
import {readNativeRecordedFundReviewSourceV1} from './native-recorded-fund-review-source-v1.ts';
import type {FinanceProviderScopeV1} from './operational-finance-provider-ui-v1.ts';
import type {NativeFundReviewRequestV1} from './native-fund-review-operation-v1.ts';
/** Fixed account, source and review only. Does not expose income/final-award POST. */
export function createNativeFundReviewHttpV1(scope:FinanceProviderScopeV1,options:{enabled?:()=>boolean;fetch?:typeof globalThis.fetch}={}){
 if(Object.keys(scope).length!==3||!['actorId','tournamentId','eventId'].every(k=>Object.hasOwn(scope,k)&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(scope[k as keyof FinanceProviderScopeV1])))throw Error('invalid_review_scope');
 const fixed=Object.freeze(structuredClone(scope)),send=createFinanceJsonHttpV1({...options,expectedActorId:fixed.actorId}),base=`/api/v1/tournaments/${fixed.tournamentId}/events/${fixed.eventId}/native-finance`;
 return{source:async()=>{const value=await send(`${base}/fund-review/source`),source=readNativeRecordedFundReviewSourceV1(value,fixed);if(!source)throw Error('review_source_unavailable');return source;},operation:{save:(request:NativeFundReviewRequestV1)=>send(`${base}/fund-review`,request),reconcile:(operationId:string)=>{if(!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(operationId))return Promise.reject(Error('invalid_operation'));return send(`${base}/operations/${operationId}`);}}};
}
