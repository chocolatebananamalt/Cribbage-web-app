import 'server-only';
import {createManualPreparationTransportV1} from '../api/modern-manual-preparation-transport-v1.ts';
import {requireVerifiedIdentity} from '../api/verified-subject.ts';
import {getModernManualResultsV1} from '../results/modern-manual-playoff-results-v1.ts';
import {projectPlayoffProgressV37} from './progress-v37.ts';
import type {PrepScopeV1} from './modern-manual-preparation-contract-v1.ts';
type Normal=Parameters<typeof createManualPreparationTransportV1>[0];
type Service=Parameters<typeof createManualPreparationTransportV1>[1];
/** Existing readers retain authority. Repeated observations detect observed drift;
 * they are not an atomic database snapshot or protection against unseen ABA. */
export async function readPlayoffProgressV37({enabled,normal,service,scope}:{enabled:()=>boolean;normal:()=>Promise<Normal>;service:()=>Service;scope:PrepScopeV1}){
 if(!enabled())return null;
 try{
  const client=await normal(),before=await requireVerifiedIdentity(client),user=await client.auth.getUser();
  if(!enabled()||!before||before.subject!==scope.actorId||user.error||user.data.user?.id!==scope.actorId)return null;
  const role=await client.rpc('get_tournament_role',{p_tournament_id:scope.tournamentId});
  if(role.error||role.data!=='director')return null;
  const port=createManualPreparationTransportV1(client,service(),scope,{read:enabled,write:()=>false});
  const first=structuredClone(await port.read());
  const firstResults='status'in first?null:structuredClone(await getModernManualResultsV1(client,scope,first.qualificationId));
  const latest=structuredClone(await port.read());
  if(JSON.stringify(first)!==JSON.stringify(latest))return null;
  const latestResults='status'in latest?null:structuredClone(await getModernManualResultsV1(client,scope,latest.qualificationId));
  if(JSON.stringify(firstResults)!==JSON.stringify(latestResults))return null;
  const again=await client.auth.getUser(),finalRole=await client.rpc('get_tournament_role',{p_tournament_id:scope.tournamentId}),after=await requireVerifiedIdentity(client);
  if(!enabled()||!after||after.subject!==before.subject||after.sessionId!==before.sessionId||again.error||again.data.user?.id!==before.subject||finalRole.error||finalRole.data!=='director')return null;
  return projectPlayoffProgressV37(latest,latestResults,scope);
 }catch{return null;}
}
