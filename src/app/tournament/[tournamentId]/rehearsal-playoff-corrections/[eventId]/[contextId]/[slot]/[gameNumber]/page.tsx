import { integratedTestBackendOrigin } from '../../../../../../../../lib/integrated-test-target.ts';
import Link from'next/link';import{notFound}from'next/navigation';
import{getPublicSupabaseEnv}from'../../../../../../../../lib/env';
import{requireTournamentAccess}from'../../../../../../../../lib/auth/require-tournament-access';
import{playoffReopenRoutesEnabledV1,playoffCorrectionUuidV1 as uuid,playoffCorrectionIntegerV1 as int}from'../../../../../../../../lib/playoffs/native-mixed-playoff-reopen-v1';
import{NativeMixedPlayoffReopenProviderV1}from'../../../../../../../../components/native-mixed-playoff-reopen-provider-v1';
export const dynamic='force-dynamic';
/** Private candidate: no environment flag or client input can enable this. */
export default async function Page({params}:{params:Promise<{tournamentId:string;eventId:string;contextId:string;slot:string;gameNumber:string}>}){
 if(!playoffReopenRoutesEnabledV1())notFound();if(getPublicSupabaseEnv().url!==integratedTestBackendOrigin())notFound();
 const p=await params;if(![p.tournamentId,p.eventId,p.contextId].every(uuid)||!/^\d+$/.test(p.slot)||!/^\d+$/.test(p.gameNumber))notFound();const slot=Number(p.slot),gameNumber=Number(p.gameNumber);if(!int(slot,1,4)||!int(gameNumber,1,2500))notFound();
 const access=await requireTournamentAccess(p.tournamentId);if(access.role!=='director')notFound();
 return <main><NativeMixedPlayoffReopenProviderV1 enabled tournamentId={p.tournamentId} eventId={p.eventId} contextId={p.contextId} slot={slot} gameNumber={gameNumber}/><Link href={`/tournament/${p.tournamentId}`}>Back to Tournament</Link></main>;
}
