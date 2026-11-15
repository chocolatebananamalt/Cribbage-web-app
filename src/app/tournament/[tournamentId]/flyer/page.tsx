import Link from'next/link';
import{notFound}from'next/navigation';
import{requireTournamentAccess}from'../../../../lib/auth/require-tournament-access';
import{createClient}from'../../../../lib/supabase/server';
import{requireVerifiedSubject}from'../../../../lib/api/verified-subject';
import{isUuid}from'../../../../lib/api/validation';
import{buildSetupFlyerWithSavedPolicies,setupFlyerCustomPoolsEnabledV1}from'../../../../lib/setup-flyer-saved-policies';
import{createEventPrizeRpcV1}from'../../../../lib/api/event-prize-rpc-v1';
import{eventPrizeSetupTestProjectEnabledV1}from'../../../../lib/api/event-prize-setup-test-project-v1';
import{SetupFlyer}from'../../../../components/setup-flyer';
export const dynamic='force-dynamic';
export default async function FlyerPage({params}:{params:Promise<{tournamentId:string}>}){
 const{tournamentId}=await params;if(!isUuid(tournamentId))notFound();
 const access=await requireTournamentAccess(tournamentId);if(!['director','co_director'].includes(access.role))notFound();
 const client=await createClient();if(await requireVerifiedSubject(client)!==access.user.id)notFound();
 const result=await client.rpc('get_tournament_setup_workspace',{p_tournament_id:tournamentId});
 if(await requireVerifiedSubject(client)!==access.user.id)notFound();
 let prizeWorkspace:unknown,customPools:unknown;
 if(eventPrizeSetupTestProjectEnabledV1()){const r=await createEventPrizeRpcV1(client,{actorId:access.user.id,tournamentId},{read:eventPrizeSetupTestProjectEnabledV1}).workspace();if(r.status==='available')prizeWorkspace=r.workspace;}
 if(setupFlyerCustomPoolsEnabledV1()){try{const r=await client.rpc('get_setup_flyer_custom_pools_v1',{p_tournament_id:tournamentId});if(!r.error)customPools=r.data;}catch{/* Missing source stays explicitly unavailable. */}}
 if(await requireVerifiedSubject(client)!==access.user.id)notFound();
 const flyer=result.error?null:buildSetupFlyerWithSavedPolicies({workspace:result.data,prizeWorkspace,customPools,actorId:access.user.id,tournamentId});
 return <><nav className="setup-flyer-screen-nav"><Link href={`/tournament/${tournamentId}/setup`}>Back to Saved Tournament Setup</Link></nav>{flyer?<SetupFlyer flyer={flyer}/>:<main><h1>Saved Flyer Draft Unavailable</h1><p>Save tournament details first. If setup is already saved, its current data or time format could not be verified for this view. Nothing was changed.</p></main>}</>;
}
