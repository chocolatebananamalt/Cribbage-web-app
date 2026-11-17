import Link from 'next/link';import {notFound} from 'next/navigation';
import {isUuid} from '../../../../lib/api/validation';
import {requireTournamentAccess} from '../../../../lib/auth/require-tournament-access';
import {createClient} from '../../../../lib/supabase/server';import {createServerOnlyAdminClient} from '../../../../lib/supabase/private-admin';
import {directorUnresolvedGamesEnabledV31} from '../../../../lib/operations/director-unresolved-games-v31';
import {readDirectorUnresolvedQueueV31} from '../../../../lib/operations/director-unresolved-read-v31';
import {DirectorUnresolvedGamesV31View} from '../../../../components/director-unresolved-games-v31';
export const dynamic='force-dynamic';
export default async function UnresolvedGamesPageV31({params,searchParams}:{params:Promise<{tournamentId:string}>;searchParams:Promise<{after?:string}>}){
 if(!directorUnresolvedGamesEnabledV31())notFound();
 const {tournamentId}=await params,q=await searchParams;if(!isUuid(tournamentId)||q.after!==undefined&&!isUuid(q.after))notFound();
 const access=await requireTournamentAccess(tournamentId);if(!['director','co_director'].includes(access.role))notFound();
 const scope={actorId:access.user.id,tournamentId,afterGameId:q.after??null};
 const data=await readDirectorUnresolvedQueueV31({client:await createClient(),scope,read:()=>createServerOnlyAdminClient().rpc('get_director_unresolved_games_v31',{p_actor_id:scope.actorId,p_tournament_id:tournamentId,p_after_game_id:scope.afterGameId})});
 return data?<DirectorUnresolvedGamesV31View data={data}/>:<main><h1>Unresolved games unavailable</h1><p>No current authorized queue was returned. Missing data is not zero unresolved games. Nothing was changed.</p><Link prefetch={false} href={'/tournament/'+tournamentId+'/cross-check-finalization'}>Back to Final Cross-Checking</Link></main>;
}
