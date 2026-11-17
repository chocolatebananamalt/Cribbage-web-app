import{selectedStepAwardRecoveryEnabledV41}from'../../../../../../lib/finance/selected-step-award-recovery-gate-v41';
import Link from'next/link';import{notFound}from'next/navigation';
import{requireTournamentAccess}from'../../../../../../lib/auth/require-tournament-access';
import{isUuid}from'../../../../../../lib/api/validation';
import{SelectedStepAwardSectionV3}from'../../../../../../components/selected-step-award-section-v3';
import{selectedStepAwardPageEnabledV3,selectedStepAwardWritesVerifiedV3}from'../../../../../../lib/api/selected-step-award-transport-v3';
import{SelectedStepFundSectionV3}from'../../../../../../components/selected-step-fund-section-v3';
import{selectedStepFundEnabledV3,selectedStepFundWritesVerifiedV3}from'../../../../../../lib/api/selected-step-fund-transport-v3';
import{ModernEventCloseSectionV1}from'../../../../../../components/modern-event-close-section-v1';
import{modernEventClosePageEnabledV1,modernEventCloseWritesVerifiedV1}from'../../../../../../lib/finance/modern-event-close-transport-v1';
export const dynamic='force-dynamic';
export default async function SelectedStepAwards({params}:{params:Promise<{tournamentId:string;eventId:string}>}){
 if(!selectedStepAwardPageEnabledV3())notFound();const{tournamentId,eventId}=await params;if(!isUuid(tournamentId)||!isUuid(eventId))notFound();const access=await requireTournamentAccess(tournamentId);if(access.role!=='director')notFound();
 return <main><h1>Regular Prize Review</h1><SelectedStepFundSectionV3 enabled={selectedStepFundEnabledV3()} writesVerified={selectedStepFundWritesVerifiedV3()} scope={{actorId:access.user.id,tournamentId,eventId}}/><SelectedStepAwardSectionV3 enabled recoveryVerified={selectedStepAwardRecoveryEnabledV41()} writesVerified={selectedStepAwardWritesVerifiedV3()} scope={{actorId:access.user.id,tournamentId,eventId}} role={access.role}/>
 {modernEventClosePageEnabledV1()&&<section aria-labelledby="event-final-approval"><h2 id="event-final-approval">Final Event Approval and Closure</h2><p>After recording the awards, refresh the current records below to review the next required approval. Each approval applies only to this event. Awards remain unpaid.</p><ModernEventCloseSectionV1 enabled writesVerified={modernEventCloseWritesVerifiedV1()} scope={{actorId:access.user.id,tournamentId,eventId}}/></section>}
 <Link href={`/tournament/${tournamentId}/results?event=${eventId}`}>View Event Results</Link></main>;
}
