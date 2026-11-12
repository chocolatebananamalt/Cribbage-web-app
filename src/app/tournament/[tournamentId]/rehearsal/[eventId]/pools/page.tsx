import{notFound}from'next/navigation';
import{nativeMixedPoolPlayerRouteEnabledV1,prepareNativeMixedPoolPlayerRouteV1}from'../../../../../../lib/finance/native-mixed-pool-player-route-v1';
import{NativeMixedPoolPlayerProviderV1}from'../../../../../../components/native-mixed-pool-player-provider-v1';
import{createClient}from'../../../../../../lib/supabase/server';
import{getPublicSupabaseEnv}from'../../../../../../lib/env';

export const dynamic='force-dynamic';
export default async function NativeMixedPoolPlayerPage({params}:{params:Promise<{tournamentId:string;eventId:string}>}){
 if(!nativeMixedPoolPlayerRouteEnabledV1())notFound();
 const p=await params,env=getPublicSupabaseEnv();
 const target=await prepareNativeMixedPoolPlayerRouteV1({enabled:true,params:p,projectUrl:env.url,
  projectRef:new URL(env.url).hostname.split('.')[0],createAuthenticated:expected=>createClient(expected)});
 if(!target)notFound();
 return <NativeMixedPoolPlayerProviderV1 enabled target={target}/>;
}
