import{fictionalDrawBoundaryEnabled}from"../../../../../lib/api/fictional-draw-enabled";
import{headers}from"next/headers";
import{notFound}from"next/navigation";
import{rosterDrawEnabled}from"../../../../../lib/api/roster-random-draw-handlers";
import{isLoopbackPlannerUrl}from"../../../../../lib/api/local-seating-planner";
import{requireTournamentAccess}from"../../../../../lib/auth/require-tournament-access";
import{isUuid}from"../../../../../lib/api/validation";
import{RecoveryDocumentBoundary}from"../../../../../components/recovery-document-boundary";
import Client from"../../../../../components/roster-random-draw-client";
export default async function Page({params}:{params:Promise<{tournamentId:string}>}){if(!fictionalDrawBoundaryEnabled()&&!rosterDrawEnabled(process.env))notFound();const host=(await headers()).get("host");if(!host||(!fictionalDrawBoundaryEnabled()&&!isLoopbackPlannerUrl(`http://${host}`)))notFound();const{tournamentId}=await params;if(!isUuid(tournamentId))notFound();const access=await requireTournamentAccess(tournamentId);if(!["director","co_director"].includes(access.role))notFound();return<RecoveryDocumentBoundary actorId={access.user.id}><main className="auth-shell"><section className="auth-card corrections-card"><h1>Roster-bound random seating candidate</h1><Client actorId={access.user.id} tournamentId={tournamentId}/></section></main></RecoveryDocumentBoundary>;}

