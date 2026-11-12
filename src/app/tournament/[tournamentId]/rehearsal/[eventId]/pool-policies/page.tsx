import Link from 'next/link';
import{notFound}from'next/navigation';
import{nativeMixedPoolDirectorRouteEnabledV1}from'../../../../../../lib/finance/native-mixed-finance-route-gates-v1';
import{prepareNativeMixedPoolPlayerRouteV1}from'../../../../../../lib/finance/native-mixed-pool-player-route-v1';
import{NativeMixedPoolPolicyProviderV1}from'../../../../../../components/native-mixed-pool-policy-provider-v1';
import{createClient}from'../../../../../../lib/supabase/server';
import{getPublicSupabaseEnv}from'../../../../../../lib/env';
export const dynamic='force-dynamic';
export default async function NativeMixedPoolDirectorPage({params}:{params:Promise<{tournamentId:string;eventId:string}>}){
 if(!nativeMixedPoolDirectorRouteEnabledV1())notFound();
 const p=await params,env=getPublicSupabaseEnv();
 const target=await prepareNativeMixedPoolPlayerRouteV1({enabled:true,params:p,projectUrl:env.url,projectRef:new URL(env.url).hostname.split('.')[0],createAuthenticated:expected=>createClient(expected)});
 if(!target)notFound();
 return <><Link href={`/tournament/${target.tournamentId}/rehearsal-prepare/${target.eventId}`}>Back to Rehearsal Preparation</Link><NativeMixedPoolPolicyProviderV1 enabled target={target}/></>;
}
