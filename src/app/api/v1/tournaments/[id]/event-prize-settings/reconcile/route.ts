import {eventPrizeProviderV1} from '../../../../../../../lib/api/event-prize-provider-v1';
import {privateNoStore,withApiFailureBoundary} from '../../../../../../../lib/api/route-boundary';
import type {NextRequest} from 'next/server';
export const POST=(request:NextRequest,context:{params:Promise<{id:string}>})=>withApiFailureBoundary(async()=>{const response=await eventPrizeProviderV1.reconcilePOST(request,context);response.headers.set('cache-control',privateNoStore['cache-control']);return response;});
