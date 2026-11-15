import{notFound}from'next/navigation';
import Link from'next/link';
import{selectedStepOwnershipPageEnabledV3}from'../../../../../../lib/finance/selected-step-ownership-gates-v3';
import{SelectedStepPoolJournalSectionV3}from'../../../../../../components/selected-step-pool-journal-section-v3';
import{selectedStepPoolPageEnabledV3,selectedStepPoolWritesVerifiedV3}from'../../../../../../lib/finance/selected-step-pool-page-gates-v3';
import{requireTournamentAccess}from'../../../../../../lib/auth/require-tournament-access';
import{createClient}from'../../../../../../lib/supabase/server';
import{isUuid}from'../../../../../../lib/api/validation';
export const dynamic='force-dynamic';
export default async function PoolAwardsPage({params}:{params:Promise<{tournamentId:string;eventId:string}>}){
 if(!selectedStepPoolPageEnabledV3())notFound();const{tournamentId,eventId}=await params;if(!isUuid(tournamentId)||!isUuid(eventId))notFound();const access=await requireTournamentAccess(tournamentId);if(access.role!=='director')notFound();
 const c=await createClient(),r=await c.auth.getUser();if(r.error||r.data.user?.id!==access.user.id)notFound();
 return <>{selectedStepOwnershipPageEnabledV3()&&<Link href={`/tournament/${tournamentId}/finance/${eventId}/pool-ownership`}>Review Fund Ownership</Link>}<SelectedStepPoolJournalSectionV3 enabled scope={{actorId:access.user.id,tournamentId,eventId}} role={access.role} writesVerified={selectedStepPoolWritesVerifiedV3()}/></>;
}
