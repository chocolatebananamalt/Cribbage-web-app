import {JointExpenseSplitSectionV3} from '../../../../../../components/joint-expense-split-section-v3';
import {jointExpenseAuthoringPageEnabledV3,jointExpenseAuthoringWritesVerifiedV3} from '../../../../../../lib/finance/joint-expense-authoring-transport-v3';
import{notFound}from'next/navigation';
import Link from'next/link';
import{selectedStepPoolPageEnabledV3}from'../../../../../../lib/finance/selected-step-pool-page-gates-v3';
import{SelectedStepOwnershipSectionV3}from'../../../../../../components/selected-step-ownership-section-v3';
import{selectedStepOwnershipPageEnabledV3,selectedStepOwnershipWritesVerifiedV3}from'../../../../../../lib/finance/selected-step-ownership-gates-v3';
import{requireTournamentAccess}from'../../../../../../lib/auth/require-tournament-access';
import{createClient}from'../../../../../../lib/supabase/server';
import{isUuid}from'../../../../../../lib/api/validation';
export const dynamic='force-dynamic';
export default async function PoolOwnershipPage({params}:{params:Promise<{tournamentId:string;eventId:string}>}){
 if(!selectedStepOwnershipPageEnabledV3())notFound();const{tournamentId,eventId}=await params;if(!isUuid(tournamentId)||!isUuid(eventId))notFound();const access=await requireTournamentAccess(tournamentId);if(access.role!=='director')notFound();
 const c=await createClient(),r=await c.auth.getUser();if(r.error||r.data.user?.id!==access.user.id)notFound();
 const expenseEnabled=jointExpenseAuthoringPageEnabledV3();
 return <>{expenseEnabled&&<JointExpenseSplitSectionV3 enabled writesVerified={jointExpenseAuthoringWritesVerifiedV3()} scope={{actorId:access.user.id,tournamentId,eventId}}/>}<SelectedStepOwnershipSectionV3 enabled scope={{actorId:access.user.id,tournamentId,eventId}} role={access.role} writesVerified={selectedStepOwnershipWritesVerifiedV3()}/>{selectedStepPoolPageEnabledV3()&&<Link href={`/tournament/${tournamentId}/finance/${eventId}/pool-awards`}>Continue to Pool Award Review</Link>}</>;
}
