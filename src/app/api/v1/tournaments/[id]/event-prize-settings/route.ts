import {eventPrizeProviderV1} from '../../../../../../lib/api/event-prize-provider-v1';
import {privateNoStore,withApiFailureBoundary} from '../../../../../../lib/api/route-boundary';
import type {NextRequest} from 'next/server';
type Context={params:Promise<{id:string}>};
export const GET=(request:NextRequest,context:Context)=>withApiFailureBoundary(async()=>{const response=await eventPrizeProviderV1.GET(request,context);response.headers.set('cache-control',privateNoStore['cache-control']);return response;});
export const POST=(request:NextRequest,context:Context)=>withApiFailureBoundary(async()=>{const response=await eventPrizeProviderV1.POST(request,context);response.headers.set('cache-control',privateNoStore['cache-control']);return response;});
