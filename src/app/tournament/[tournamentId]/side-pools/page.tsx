import Link from "next/link";
import { notFound } from "next/navigation";
import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";
import { isUuid } from "../../../../lib/api/validation";
import { isSidePoolWorkspace } from "../../../../lib/api/side-pools";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { createServerOnlyAdminClient } from "../../../../lib/supabase/private-admin";
import SidePoolsClient from "./side-pools-client";
export const dynamic="force-dynamic";
export default async function SidePoolsPage({params}:{params:Promise<{tournamentId:string}>}){const{tournamentId}=await params;if(!isUuid(tournamentId))notFound();const access=await requireTournamentAccess(tournamentId);if(!["director","co_director"].includes(access.role))notFound();const{data,error}=await createServerOnlyAdminClient().rpc("get_event_side_pool_workspace_v1",{p_actor_id:access.user.id,p_tournament_id:tournamentId});if(error||!isSidePoolWorkspace(data))notFound();return <main className="auth-shell"><section className="auth-card"><p className="eyebrow">FINANCIALS</p><h1>Event Side Pools</h1><p className="card-context">{data.tournamentName}</p><p className="auth-note">Side Pools are separate from Q Pools. Each event may use up to the four customary categories.</p><SidePoolsClient tournamentId={tournamentId} workspace={data}/><Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to Tournament</Link><SharedDeviceSignOut/></section></main>}
