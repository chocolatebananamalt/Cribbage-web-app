import Link from 'next/link';
import{notFound}from'next/navigation';
import{nativeMixedMainFinanceRouteEnabledV1}from'../../../../../../lib/finance/native-mixed-finance-route-gates-v1';
import{prepareNativeMixedPoolPlayerRouteV1}from'../../../../../../lib/finance/native-mixed-pool-player-route-v1';
import{NativeMixedMainFinanceProviderV1}from'../../../../../../components/native-mixed-main-finance-provider-v1';
import{createClient}from'../../../../../../lib/supabase/server';
import{getPublicSupabaseEnv}from'../../../../../../lib/env';
export const dynamic='force-dynamic';
export default async function NativeMixedMainFinancePage({params}:{params:Promise<{tournamentId:string;eventId:string}>}){
 if(!nativeMixedMainFinanceRouteEnabledV1())notFound();
 const p=await params,env=getPublicSupabaseEnv();
 // Reuse only the current own-cookie identity/project target preparation. A
 // current Finance source must not be required to recover old owned requests.
 const target=await prepareNativeMixedPoolPlayerRouteV1({enabled:true,params:p,projectUrl:env.url,projectRef:new URL(env.url).hostname.split('.')[0],createAuthenticated:expected=>createClient(expected)});
 if(!target)notFound();
 return <><Link href={`/tournament/${target.tournamentId}/rehearsal-prepare/${target.eventId}`}>Back to Rehearsal Preparation</Link><NativeMixedMainFinanceProviderV1 enabled target={target}/></>;
}
