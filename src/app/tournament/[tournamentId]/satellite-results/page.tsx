import Link from "next/link";
import { notFound } from "next/navigation";
import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";
import { isSatelliteWorkspace } from "../../../../lib/api/satellite-results";
import { isUuid } from "../../../../lib/api/validation";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { createServerOnlyAdminClient } from "../../../../lib/supabase/private-admin";
import SatelliteResultsClient from "./satellite-results-client";
export const dynamic="force-dynamic";
export default async function Page({params,searchParams}:{params:Promise<{tournamentId:string}>;searchParams:Promise<{event?:string}>}){const{tournamentId}=await params;const{event}=await searchParams;if(!isUuid(tournamentId)||(event!==undefined&&!isUuid(event)))notFound();const access=await requireTournamentAccess(tournamentId);const{data,error}=await createServerOnlyAdminClient().rpc("get_satellite_results_workspace_v1",{p_actor_id:access.user.id,p_tournament_id:tournamentId});if(error||!isSatelliteWorkspace(data))notFound();const canManage=["director","co_director"].includes(access.role);const visibleData=canManage?data:{...data,events:data.events.map((item)=>({...item,current:item.current?.status==="finalized"||item.current?.status==="corrected"?item.current:null}))};return <main className="auth-shell"><section className="auth-card standings-card"><p className="eyebrow">TOURNAMENT RESULTS</p><h1>Satellite Results and ACC Report</h1><p className="card-context">{data.tournamentName}</p><p className="auth-note">Every cashing scorecard requires cross-check evidence. Satellite results never award MRPs or affect Main or Consy qualification.</p><SatelliteResultsClient tournamentId={tournamentId} workspace={visibleData} initialEventId={event} canManage={canManage}/><Link className="guide-link" href={`/tournament/${tournamentId}/results`}>Previous Screen</Link><SharedDeviceSignOut/></section></main>}
