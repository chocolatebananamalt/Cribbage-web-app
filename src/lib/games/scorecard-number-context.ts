import 'server-only';
import { createServerOnlyAdminClient } from '../supabase/private-admin';
import {isGameScorecardNumbers,type GameScorecardNumbers} from '../api/odd-field-makeup';
export type {GameScorecardNumbers} from '../api/odd-field-makeup';
export async function getGameScorecardNumbers(actorId:string,tournamentId:string,gameId:string):Promise<GameScorecardNumbers|null> {
  try{const{data,error}=await createServerOnlyAdminClient().rpc('get_game_scorecard_number_context_v1',{a:actorId,t:tournamentId,g:gameId});
    return !error&&isGameScorecardNumbers(data,gameId)?data:null;
  }catch{return null;}
}
