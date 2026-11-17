import 'server-only';
import {requireVerifiedIdentity} from '../api/verified-subject.ts';
import {isModernPrizeScopeV2,type ModernPrizeScopeV2} from '../finance/modern-prize-journal-contract-v2.ts';
import {readSelectedStepPoolWorkspaceServerV3} from '../finance/selected-step-pool-workspace-v3.ts';
import {projectPoolProposalResultsV38} from './pool-proposal-results-v38.ts';
import {isUuid} from '../api/validation.ts';
type Existing=Parameters<typeof readSelectedStepPoolWorkspaceServerV3>[0];
type Normal=Existing['authenticated']&Parameters<typeof requireVerifiedIdentity>[0];
/** Observed equality detects drift; it is not an atomic database snapshot. */
export async function readPoolProposalResultsV38(o:{enabled:()=>boolean;normal:()=>Promise<Normal>;service:()=>Existing['serviceRpc'];scope:ModernPrizeScopeV2;qualificationId:string}){
 if(!o.enabled()||!isModernPrizeScopeV2(o.scope)||!isUuid(o.qualificationId))return null;
 const scope=Object.freeze({...o.scope}),qid=o.qualificationId;
 try{
  const c=await o.normal(),before=await requireVerifiedIdentity(c),user=await c.auth.getUser();
  if(!before||before.subject!==scope.actorId||user.error||user.data?.user?.id!==scope.actorId||!o.enabled())return null;
  const role=await c.rpc('get_tournament_role',{p_tournament_id:scope.tournamentId});if(role.error||role.data!=='director')return null;
  const options={authenticated:c,serviceRpc:o.service(),scope,enabled:o.enabled};
  const first=structuredClone(await readSelectedStepPoolWorkspaceServerV3(options));
  const latest=structuredClone(await readSelectedStepPoolWorkspaceServerV3(options));
  if(JSON.stringify(first)!==JSON.stringify(latest))return null;
  const again=await c.auth.getUser(),lastRole=await c.rpc('get_tournament_role',{p_tournament_id:scope.tournamentId}),after=await requireVerifiedIdentity(c);
  if(!o.enabled()||again.error||again.data?.user?.id!==before.subject||lastRole.error||lastRole.data!=='director'||!after||after.subject!==before.subject||after.sessionId!==before.sessionId)return null;
  return projectPoolProposalResultsV38(latest,qid);
 }catch{return null;}
}
