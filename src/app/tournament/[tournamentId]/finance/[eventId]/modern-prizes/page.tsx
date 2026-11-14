import{notFound}from'next/navigation';
import{ModernPrizeJournalSectionV2}from'../../../../../../components/modern-prize-journal-section-v2';
import{modernPrizePageEnabledV2,modernPrizeWritesVerifiedV2}from'../../../../../../lib/finance/modern-prize-journal-gates-v2';
import{requireTournamentAccess}from'../../../../../../lib/auth/require-tournament-access';
import{isUuid}from'../../../../../../lib/api/validation';
export const dynamic='force-dynamic';
export default async function ModernPrizePage({params}:{params:Promise<{tournamentId:string;eventId:string}>}){
 if(!modernPrizePageEnabledV2())notFound();const{tournamentId,eventId}=await params;if(!isUuid(tournamentId)||!isUuid(eventId))notFound();const access=await requireTournamentAccess(tournamentId);if(!['director','co_director'].includes(access.role))notFound();
 return <ModernPrizeJournalSectionV2 enabled scope={{actorId:access.user.id,tournamentId,eventId}} role={access.role} writesVerified={modernPrizeWritesVerifiedV2()}/>;
}
