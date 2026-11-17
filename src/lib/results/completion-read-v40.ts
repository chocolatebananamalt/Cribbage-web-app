import 'server-only';
import {requireVerifiedIdentity} from '../api/verified-subject.ts';
import {isModernPrizeScopeV2} from '../finance/modern-prize-journal-contract-v2.ts';
import {createModernEventCloseTransportV1} from '../finance/modern-event-close-transport-v1.ts';
import {readPoolProposalResultsV38} from './pool-proposal-read-v38.ts';
import {projectEventApprovalResultsV40} from './event-approval-results-v40.ts';
import {isUuid} from '../api/validation.ts';
type Existing=Parameters<typeof readPoolProposalResultsV38>[0];
type Normal=Awaited<ReturnType<Existing['normal']>>&Parameters<typeof createModernEventCloseTransportV1>[0];
/** One final actor/session fence covers both optional views; repeated equality is observation, not an atomic DB snapshot. */
export async function readResultsCompletionV40(o:Omit<Existing,'normal'>&{normal:()=>Promise<Normal>;poolEnabled:boolean}){
 if(!o.enabled()||!isModernPrizeScopeV2(o.scope)||!isUuid(o.qualificationId))return null;
 const scope=Object.freeze({...o.scope}),qid=o.qualificationId;
 try{
  const c=await o.normal(),before=await requireVerifiedIdentity(c),user=await c.auth.getUser();
  if(!before||before.subject!==scope.actorId||user.error||user.data?.user?.id!==scope.actorId||!o.enabled())return null;
  const role=await c.rpc('get_tournament_role',{p_tournament_id:scope.tournamentId});if(role.error||role.data!=='director')return null;
  const service=o.service();
  const poolProposal=o.poolEnabled?structuredClone(await readPoolProposalResultsV38({...o,scope,qualificationId:qid,normal:async()=>c,service:()=>service})):null;
  if(o.poolEnabled&&poolProposal===null)return null;
  const transport=createModernEventCloseTransportV1(c,service,scope,{read:o.enabled,write:()=>false});
  const first=structuredClone(await transport.read()),last=structuredClone(await transport.read());
  if(JSON.stringify(first)!==JSON.stringify(last))return null;
  const again=await c.auth.getUser(),lastRole=await c.rpc('get_tournament_role',{p_tournament_id:scope.tournamentId}),after=await requireVerifiedIdentity(c);
  if(!o.enabled()||again.error||again.data?.user?.id!==before.subject||lastRole.error||lastRole.data!=='director'||!after||after.subject!==before.subject||after.sessionId!==before.sessionId)return null;
  const approval=projectEventApprovalResultsV40(last,scope,qid);return approval?{poolProposal,approval}:null;
 }catch{return null;}
}
