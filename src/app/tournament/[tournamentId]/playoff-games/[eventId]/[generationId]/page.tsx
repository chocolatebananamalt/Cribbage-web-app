import{notFound}from'next/navigation';
import{requireTournamentAccess}from'../../../../../../lib/auth/require-tournament-access';
import{SelectedStepPlayerEntryV3}from'../../../../../../components/selected-step-player-entry-v3';
import{isSelectedStepPlayerScopeV3,selectedStepPlayerPageEnabledV3,selectedStepPlayerWritesVerifiedV3}from'../../../../../../lib/playoffs/selected-step-player-v3';
export const dynamic='force-dynamic';
export default async function PlayoffGame({params,searchParams}:{params:Promise<{tournamentId:string;eventId:string;generationId:string}>;searchParams:Promise<{qualification?:string;slot?:string}>}){
 if(!selectedStepPlayerPageEnabledV3())notFound();const p=await params,q=await searchParams,access=await requireTournamentAccess(p.tournamentId);
 const scope={actorId:access.user.id,tournamentId:p.tournamentId,eventId:p.eventId,generationId:p.generationId,qualificationId:q.qualification,slot:Number(q.slot)};
 if(!isSelectedStepPlayerScopeV3(scope))notFound();
 return <SelectedStepPlayerEntryV3 enabled writesVerified={selectedStepPlayerWritesVerifiedV3()} scope={scope}/>;
}
