import {notFound}from'next/navigation';
import {nativeMixedPlayerRouteEnabledV1,prepareNativeMixedPlayerRouteV1}from'../../../../../../../lib/seating/native-mixed-player-route-v1';
import {createClient}from'../../../../../../../lib/supabase/server';
import {getPublicSupabaseEnv}from'../../../../../../../lib/env';
import {NativeMixedPlayerProviderV1}from'../../../../../../../components/native-mixed-player-provider-v1';
export const dynamic='force-dynamic';
export default async function NativeMixedPlayerPage({params,searchParams}:{params:Promise<{tournamentId:string;eventId:string;startId:string;gameId:string}>;searchParams:Promise<{page?:string}>}){
 // Reject before environment, cookie/client creation or provider I/O. This route
 // emits no ordinary assigned-game offline marker and is not an offline cache.
 if(!nativeMixedPlayerRouteEnabledV1())notFound();
 const p=await params,q=await searchParams;if(q.page!==undefined&&!['entry','card'].includes(q.page))notFound();
 const env=getPublicSupabaseEnv(),host=new URL(env.url).hostname;if(!host.endsWith('.supabase.co'))notFound();
 const prepared=await prepareNativeMixedPlayerRouteV1({enabled:true,params:p,page:q.page==='card'?'card':'entry',projectUrl:env.url,projectRef:host.split('.')[0],createAuthenticated:createClient});if(!prepared)notFound();
 return <NativeMixedPlayerProviderV1 enabled target={prepared.target} page={prepared.page}/>;
}
