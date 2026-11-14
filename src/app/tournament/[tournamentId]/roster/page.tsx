import{RegistrationResolutionV1}from'../../../../components/registration-resolution-v1';
import{registrationResolutionEnabledV1}from'../../../../lib/api/registration-resolution-v1';
import{requireVerifiedIdentity}from'../../../../lib/api/verified-subject';
import{stationaryRegistrationEnabledV1,readStationaryWorkspaceV1,type StationaryRequestItemV1}from'../../../../lib/api/stationary-registration-v1';
import{createClient}from'../../../../lib/supabase/server';
import{requireVerifiedSubject}from'../../../../lib/api/verified-subject';
import{StationaryRequestReviewV1}from'../../../../components/stationary-request-review-v1';
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { isUuid } from "../../../../lib/api/validation";
import { getRosterWorkspace } from "../../../../lib/roster/workspace";
import { getRegistrationClaimReviewWorkspace } from "../../../../lib/registration-claim-review-workspace";
import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";
import RosterClient from "./roster-client";
import RegistrationClaimReviewClient from "./registration-claim-review-client";
import { readRosterIntakeState } from "../../../../lib/director-checklist-reader";

export const dynamic = "force-dynamic";

export default async function RosterPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  if (!isUuid(tournamentId)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  if (!["director", "co_director"].includes(access.role)) notFound();
  const [workspace, claims, intakeState] = await Promise.all([getRosterWorkspace(tournamentId), getRegistrationClaimReviewWorkspace(tournamentId), readRosterIntakeState(access.user.id, tournamentId)]);
  let resolutionSession:string|null=null;
  if(registrationResolutionEnabledV1()){const client=await createClient();const identity=await requireVerifiedIdentity(client);if(identity?.subject===access.user.id)resolutionSession=identity.sessionId;}
  let stationary:StationaryRequestItemV1[]|null=null;
  if(stationaryRegistrationEnabledV1()){try{const client=await createClient();if(await requireVerifiedSubject(client)===access.user.id){const r=await client.rpc('get_registration_stationary_workspace_v1',{p_tournament_id:tournamentId});if(!r.error&&await requireVerifiedSubject(client)===access.user.id)stationary=readStationaryWorkspaceV1(r.data,access.user.id);}}catch{/* Keep unknown separate from zero requests. */}}
  return <main className="auth-shell"><section className="auth-card corrections-card" aria-labelledby="roster-title"><p className="eyebrow">OPERATIONS</p><h1 id="roster-title">Players and Registration</h1><p className="auth-note">Review signup requests, add players directly, or import a player list. A roster identity is not an account, payment, check-in, event enrollment, Table/Seat, or verification-ID assignment.</p><Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to tournament</Link><RegistrationClaimReviewClient actorId={access.user.id} tournamentId={tournamentId} claims={claims} />{stationaryRegistrationEnabledV1()&&<StationaryRequestReviewV1 actorId={access.user.id} tournamentId={tournamentId} requests={stationary}/>}{resolutionSession&&<RegistrationResolutionV1 actorId={access.user.id} tournamentId={tournamentId} sessionId={resolutionSession}/>}<RosterClient intakeState={intakeState} actorId={access.user.id} tournamentId={tournamentId} {...workspace} /><SharedDeviceSignOut /></section></main>;
}
