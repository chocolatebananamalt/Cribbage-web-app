import Link from 'next/link';
import {notFound} from 'next/navigation';
import {isUuid} from '../../../../../../lib/api/validation';
import {requireTournamentAccess} from '../../../../../../lib/auth/require-tournament-access';
import {createClient} from '../../../../../../lib/supabase/server';
import {createServerOnlyAdminClient} from '../../../../../../lib/supabase/private-admin';
import {integratedTestBackendOrigin,integratedTestBackendRef} from '../../../../../../lib/integrated-test-target';
import {nativePaperPairingEnabledV29,readNativePaperPairingV29} from '../../../../../../lib/events/native-paper-pairing-read-v29';
import {PaperPairingPacketV28} from '../../../../../../components/paper-pairing-packet-v28';
export const dynamic='force-dynamic';
export default async function NativePairingPageV29({params,searchParams}:{params:Promise<{tournamentId:string;eventId:string}>;searchParams:Promise<{player?:string}>}){
 if(!nativePaperPairingEnabledV29())notFound();
 const {tournamentId,eventId}=await params,q=await searchParams;
 if(!isUuid(tournamentId)||!isUuid(eventId)||q.player!==undefined&&(typeof q.player!=='string'||!/^A-(?:[1-9]|1[0-8])$/.test(q.player)))notFound();
 const access=await requireTournamentAccess(tournamentId);if(access.role!=='director')notFound();
 const backHref=`/tournament/${tournamentId}/rehearsal-prepare/${eventId}`,allHref=backHref+'/print?';
 const packet=await readNativePaperPairingV29({client:await createClient(),privileged:async()=>createServerOnlyAdminClient(),scope:{actorId:access.user.id,tournamentId,eventId},projectUrl:integratedTestBackendOrigin(),projectRef:integratedTestBackendRef(),player:q.player});
 if(!packet)return <main><h1>Rehearsal pairing sheets unavailable</h1><p>The current native schedule, roster and read permission could not be matched. Nothing was changed. No ordinary schedule was substituted.</p><Link prefetch={false} href={backHref}>Back to Rehearsal</Link></main>;
 return <PaperPairingPacketV28 rehearsal packet={packet} backHref={backHref} allHref={allHref}/>;
}
