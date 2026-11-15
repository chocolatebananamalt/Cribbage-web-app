import { integratedTestBackendRef, integratedTestBackendOrigin } from '../../../../../../../../lib/integrated-test-target.ts';
import Link from'next/link';import{notFound}from'next/navigation';
import{getPublicSupabaseEnv}from'../../../../../../../../lib/env';
import{createClient}from'../../../../../../../../lib/supabase/server';
import{requireTournamentAccess}from'../../../../../../../../lib/auth/require-tournament-access';
import{playoffCorrectionUuidV1 as uuid,playoffCorrectionIntegerV1 as int,isPlayoffReopenTargetV1}from'../../../../../../../../lib/playoffs/native-mixed-playoff-reopen-v1';
import{playoffPaperRoutesEnabledV1}from'../../../../../../../../lib/playoffs/native-mixed-playoff-paper-v1';
import{NativeMixedPlayoffPaperProviderV1}from'../../../../../../../../components/native-mixed-playoff-paper-provider-v1';
export const dynamic='force-dynamic';
const sessionNotExpired=(exp:unknown)=>typeof exp==='number'&&Number.isSafeInteger(exp)&&exp*1000>Date.now();
/** Closed private candidate, with no environment or caller-controlled switch.
 * Existing administrative visibility is unchanged. SQL independently enforces
 * live nonself official identity, capture/review roles, consent and lease. */
export default async function Page({params}:{params:Promise<{tournamentId:string;eventId:string;contextId:string;slot:string;gameNumber:string}>}){
 if(!playoffPaperRoutesEnabledV1())notFound();
 const projectRef=integratedTestBackendRef(),projectUrl=integratedTestBackendOrigin();
 if(getPublicSupabaseEnv().url!==projectUrl)notFound();
 const p=await params;if(![p.tournamentId,p.eventId,p.contextId].every(uuid)||!/^\d+$/.test(p.slot)||!/^\d+$/.test(p.gameNumber))notFound();
 const slot=Number(p.slot),gameNumber=Number(p.gameNumber);if(!int(slot,1,4)||!int(gameNumber,1,2500))notFound();
 const access=await requireTournamentAccess(p.tournamentId);if(!access.roles.some(r=>['director','co_director','cross_checker'].includes(r)))notFound();
 const client=await createClient(),u=await client.auth.getUser(),j=await client.auth.getClaims(),v=j.data?.claims;
 const target={actorId:u.data.user?.id??'',sessionId:typeof v?.session_id==='string'?v.session_id:'',projectUrl,projectRef,tournamentId:p.tournamentId,eventId:p.eventId,contextId:p.contextId,slot,gameNumber};
 if(u.error||j.error||target.actorId!==access.user.id||!isPlayoffReopenTargetV1(target)||v?.sub!==target.actorId||v.iss!==projectUrl+'/auth/v1'||!sessionNotExpired(v.exp))notFound();
 return <main><NativeMixedPlayoffPaperProviderV1 enabled target={target}/><Link href={`/tournament/${p.tournamentId}`}>Back to Tournament</Link></main>;
}
