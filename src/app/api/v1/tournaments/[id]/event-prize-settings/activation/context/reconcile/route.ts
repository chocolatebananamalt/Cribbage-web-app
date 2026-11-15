import {eventPrizeActivationHandlersV1} from '../../../../../../../../../lib/api/event-prize-activation-production-v1';
import {privateNoStore,withApiFailureBoundary} from '../../../../../../../../../lib/api/route-boundary';
import type {NextRequest} from 'next/server';
export const POST=(request:NextRequest,context:{params:Promise<{id:string}>})=>withApiFailureBoundary(async()=>{const response=await eventPrizeActivationHandlersV1.contextOperationPOST(request,context);response.headers.set('cache-control',privateNoStore['cache-control']);return response;});
