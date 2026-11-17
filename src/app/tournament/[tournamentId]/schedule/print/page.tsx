import Link from 'next/link';import {notFound} from 'next/navigation';import {isUuid} from '../../../../../lib/api/validation';import {requireTournamentAccess} from '../../../../../lib/auth/require-tournament-access';import {createClient} from '../../../../../lib/supabase/server';import {createServerOnlyAdminClient} from '../../../../../lib/supabase/private-admin';import {readPaperPairingPacketV28} from '../../../../../lib/events/paper-pairing-source-v28';import {PaperPairingPacketV28} from '../../../../../components/paper-pairing-packet-v28';
export const dynamic='force-dynamic';
export default async function PaperPairingPageV28({params,searchParams}:{params:Promise<{tournamentId:string}>;searchParams:Promise<{event?:string;player?:string;practice?:unknown}>}) {
 const {tournamentId}=await params,q=await searchParams;if(q.practice!==undefined||!isUuid(tournamentId)||!isUuid(q.event)||q.player!==undefined&&(typeof q.player!=='string'||q.player.length>8||!/^[A-Z]-[1-9][0-9]*$/.test(q.player)))notFound();
 const access=await requireTournamentAccess(tournamentId);if(!['director','co_director'].includes(access.role))notFound();
 const packet=await readPaperPairingPacketV28(await createClient(),{actorId:access.user.id,tournamentId,eventId:q.event,player:q.player},()=>createServerOnlyAdminClient().rpc('get_event_schedule_workspace_v1',{p_actor_id:access.user.id,p_tournament_id:tournamentId}));
 const backHref=`/tournament/${tournamentId}/schedule`,allHref=`${backHref}/print?event=${q.event}`;
 if(!packet)return <main className="auth-shell"><section className="auth-card"><h1>Pairing sheets unavailable</h1><p>The current saved schedule, enrolled identities and chair assignments could not be matched. Review the published schedule before printing. Printing supports up to 500 players per event.</p><Link className="guide-link" href={backHref}>Back to Game Schedule</Link></section></main>;
 return <PaperPairingPacketV28 packet={packet} backHref={backHref} allHref={allHref}/>;
}
