import {PlayoffPrizeFinanceSectionV2} from '../../../../../components/playoff-prize-finance-section-v2';
import {notFound} from 'next/navigation';
import {recordedCostAdoptionPageEnabledV1} from '../../../../../lib/finance/recorded-cost-adoption-page-v1';
import {RecordedCostAdoptionPageV1} from '../../../../../components/recorded-cost-adoption-page-v1';
import {requireTournamentAccess} from '../../../../../lib/auth/require-tournament-access';
import {createClient} from '../../../../../lib/supabase/server';
import {isUuid} from '../../../../../lib/api/validation';
export const dynamic='force-dynamic';
/** No existing setup/payment page or draft is replaced. Disabled before even
 * opening an auth client; enabling requires separate provider/release review. */
export default async function RecordedCostFinancePage({params}:{params:Promise<{tournamentId:string;eventId:string}>}){
 if(!recordedCostAdoptionPageEnabledV1())notFound();
 const {tournamentId,eventId}=await params;if(!isUuid(tournamentId)||!isUuid(eventId))notFound();
 const access=await requireTournamentAccess(tournamentId);if(!['director','co_director'].includes(access.role))notFound();
 const client=await createClient(),verified=await client.auth.getUser();if(verified.error||verified.data.user?.id!==access.user.id)notFound();
 return <><RecordedCostAdoptionPageV1 enabled={false} scope={{actorId:access.user.id,tournamentId,eventId}} role={access.role}/><PlayoffPrizeFinanceSectionV2 enabled={false} scope={{actorId:access.user.id,tournamentId,eventId}} role={access.role}/></>;
}
