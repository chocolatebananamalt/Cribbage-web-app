import {notFound}from'next/navigation';
import {nativeMixedPaperRouteEnabledV1,prepareNativeMixedPaperRouteV1}from'../../../../../../../lib/seating/native-mixed-paper-route-v1';
import {createClient}from'../../../../../../../lib/supabase/server';
import {getPublicSupabaseEnv}from'../../../../../../../lib/env';
import {NativeMixedPaperProviderV1}from'../../../../../../../components/native-mixed-paper-provider-v1';
export const dynamic='force-dynamic';
export default async function NativeMixedPaperPage({params}:{params:Promise<{tournamentId:string;eventId:string;startId:string;gameId:string}>}){
 // Reject before environment, cookie/client creation or provider I/O. This route
 // emits no ordinary assigned-game offline marker and is not an offline cache.
 if(!nativeMixedPaperRouteEnabledV1())notFound();
 const p=await params;
 const env=getPublicSupabaseEnv(),host=new URL(env.url).hostname;if(!host.endsWith('.supabase.co'))notFound();
 const prepared=await prepareNativeMixedPaperRouteV1({enabled:true,params:p,projectUrl:env.url,projectRef:host.split('.')[0],createAuthenticated:createClient});if(!prepared)notFound();
 return <NativeMixedPaperProviderV1 enabled target={prepared.target}/>;
}
