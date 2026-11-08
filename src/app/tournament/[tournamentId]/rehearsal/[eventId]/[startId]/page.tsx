import{notFound,redirect}from'next/navigation';
import{nativeMixedPlayerRouteEnabledV1}from'../../../../../../lib/seating/native-mixed-player-route-v1';
import{prepareNativeMixedPlayerLaunchV1}from'../../../../../../lib/seating/native-mixed-player-launch-v1';
import{createClient}from'../../../../../../lib/supabase/server';
import{getPublicSupabaseEnv}from'../../../../../../lib/env';
export const dynamic='force-dynamic';
export default async function Launch({params}:{params:Promise<{tournamentId:string;eventId:string;startId:string}>}){
 if(!nativeMixedPlayerRouteEnabledV1())notFound();
 const env=getPublicSupabaseEnv(),host=new URL(env.url).hostname;
 const href=await prepareNativeMixedPlayerLaunchV1({enabled:true,params:await params,projectUrl:env.url,projectRef:host.split('.')[0],createAuthenticated:createClient});
 if(!href)notFound();redirect(href);
}
