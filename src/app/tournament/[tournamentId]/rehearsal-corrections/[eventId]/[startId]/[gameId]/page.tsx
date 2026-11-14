import { integratedTestBackendOrigin } from '../../../../../../../lib/integrated-test-target.ts';
import Link from'next/link';import{notFound}from'next/navigation';
import{nativeMixedGameReopenRoutesEnabledV1}from'../../../../../../../lib/api/native-mixed-game-reopen-v1';
import{getPublicSupabaseEnv}from'../../../../../../../lib/env';import{isUuid}from'../../../../../../../lib/api/validation';import{requireTournamentAccess}from'../../../../../../../lib/auth/require-tournament-access';import{NativeMixedGameReopenProviderV1}from'../../../../../../../components/native-mixed-game-reopen-provider-v1';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{tournamentId:string;eventId:string;startId:string;gameId:string}>}){
 if(!nativeMixedGameReopenRoutesEnabledV1())notFound();if(getPublicSupabaseEnv().url!==integratedTestBackendOrigin())notFound();const p=await params;if(!Object.values(p).every(isUuid))notFound();const access=await requireTournamentAccess(p.tournamentId);if(!['director','co_director','cross_checker'].includes(access.role))notFound();
 return <main><NativeMixedGameReopenProviderV1 enabled {...p}/><Link href={`/tournament/${p.tournamentId}`}>Back to Tournament</Link></main>;
}
