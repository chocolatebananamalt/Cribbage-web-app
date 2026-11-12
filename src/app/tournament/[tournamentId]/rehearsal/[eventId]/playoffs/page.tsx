import{notFound}from'next/navigation';
import{nativeMixedPlayoffOwnRouteEnabledV1,prepareNativeMixedPlayoffOwnRouteV1}from'../../../../../../lib/playoffs/native-mixed-playoff-own-route-v1';
import{createClient}from'../../../../../../lib/supabase/server';
import{getPublicSupabaseEnv}from'../../../../../../lib/env';
import{NativeMixedPlayoffPlayerProviderV1}from'../../../../../../components/native-mixed-playoff-player-provider-v1';

// Cookie-dependent own data is never prerendered or placed in a shared cache.
export const dynamic='force-dynamic';
export default async function NativeMixedPlayoffOwnPage({params}:{params:Promise<{tournamentId:string;eventId:string}>}){
 // Reject before environment, cookies, SDK construction or provider I/O.
 if(!nativeMixedPlayoffOwnRouteEnabledV1())notFound();
 const p=await params,env=getPublicSupabaseEnv();
 const prepared=await prepareNativeMixedPlayoffOwnRouteV1({enabled:true,params:p,projectUrl:env.url,
  projectRef:new URL(env.url).hostname.split('.')[0],createAuthenticated:expectedUrl=>createClient(expectedUrl)});
 if(!prepared)notFound();
 // Only the authenticated scope crosses hydration; result data is fetched
 // again under the browser's current verified identity before display.
 return <NativeMixedPlayoffPlayerProviderV1 enabled target={prepared.target}/>;
}
