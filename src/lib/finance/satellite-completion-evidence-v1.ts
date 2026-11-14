import { integratedTestUiEnabled as integratedTestFeatureEnabled } from '../integrated-test-target.ts';
import 'server-only';
import {reconcileSatelliteRecordedAwardsV1} from './satellite-recorded-reconciliation-v1.ts';
import {isPreliminaryEventStandings} from '../results/preliminary-standings-contract.ts';
import {readSatelliteFundReviewV1} from './satellite-fund-review-v1.ts';
type Scope={actorId:string;tournamentId:string;eventId:string};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Object.keys(v).sort().join()===keys.sort().join();
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const hold=(code:string)=>({status:'held' as const,code});
/** Trusted locked database read only. The preliminary contract checks ranking
 * arithmetic; database authoritative score resolution establishes score lineage.
 * Neither arbitrary evidence refs nor a finalized manual package proves order. */
export function projectSatelliteCompletionEvidenceV1(value:unknown,scope:Scope){try{
 const keys=['kind','actorId','tournamentId','eventId','sourceDigest','snapshotConsistency','recordedSource','standings'];if(object(value)&&Object.hasOwn(value,'fundReview'))keys.push('fundReview');
 if(!exact(scope,['actorId','tournamentId','eventId'])||!Object.values(scope).every(uuid)||!exact(value,keys)
 ||value.kind!=='satellite-completion-evidence-v1'||!Object.entries(scope).every(([k,v])=>value[k]===v)||typeof value.sourceDigest!=='string'||!/^[a-f0-9]{64}$/.test(value.sourceDigest)||value.snapshotConsistency!=='locked_source_snapshot')return null;
 const recorded=reconcileSatelliteRecordedAwardsV1(value.recordedSource,scope);if(recorded.status!=='reconciled_entered_awards')return null;
 const s=value.standings;
 const order=(()=>{
  if(!isPreliminaryEventStandings(s)||s.tournamentId!==scope.tournamentId||s.eventId!==scope.eventId)return hold('completed_score_source_unavailable');
  if(s.rows.length>10000||!s.scheduledScorecardsComplete)return hold('score_verification_incomplete');
  if(![s.scheduledMatchCount,s.persistedMatchCount,s.resolvedMatchCount,...s.rows.flatMap(r=>[r.verifiedGames,r.gamePoints,r.gamesWon,r.plusPoints,r.minusPoints,r.netSpreadPoints,r.numericRank])].every(Number.isSafeInteger))return hold('unsafe_score_totals');
  const sum=(k:'verifiedGames'|'gamesWon'|'plusPoints'|'minusPoints')=>s.rows.reduce((n,r)=>n+BigInt(r[k]),BigInt(0));
  if(sum('verifiedGames')!==BigInt(s.resolvedMatchCount)*BigInt(2)||sum('gamesWon')!==BigInt(s.resolvedMatchCount)||sum('plusPoints')!==sum('minusPoints'))return hold('score_totals_inconsistent');
  if(s.rows.some(r=>r.participantStatus!=='registered'&&r.participantStatus!=='checked_in'))return hold('participant_status_review_required');
  if(s.rows.some(r=>r.tied))return hold('finishing_ties_unresolved');
  const roster=new Set(((value.recordedSource as {capture:{participants:{participantId:string}[]}}).capture.participants).map(p=>p.participantId));
  if(s.rows.length!==roster.size||s.rows.some(r=>!roster.has(r.participantId)))return hold('complete_score_roster_required');
  const placements=new Map(recorded.recipients.map(p=>[p.participantId,p.placement]));
  const scorePlaces=new Map(s.rows.map(r=>[r.participantId,r.numericRank]));
  if(recorded.recipients.some(p=>scorePlaces.get(p.participantId)!==p.placement))return hold('recorded_order_differs_from_verified_scores');
  return{status:'matches_authoritative_score_order' as const,resultVersionId:recorded.resultVersionId,
   checkedRecordedPlaces:placements.size,
   rows:s.rows.map(r=>({participantId:r.participantId,placement:r.numericRank,displayName:r.displayName,verifiedGames:r.verifiedGames,gamePoints:r.gamePoints,gamesWon:r.gamesWon,netSpreadPoints:r.netSpreadPoints,plusPoints:r.plusPoints})),
   independentHumanPlayEstablished:false as const};
 })();
 const fundReview=readSatelliteFundReviewV1(value.fundReview,scope);
 const canonical=(v:unknown)=>JSON.stringify(v,(_k,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
 const matchedFund=!!fundReview&&fundReview.reviewCurrent&&canonical(fundReview.sourceCapture.allocation)===canonical((value.recordedSource as {capture:{allocation:unknown}}).capture.allocation);
 const fundMinor=matchedFund?fundReview.fundMinor:recorded.recordedRegularFundMinor;
 const difference=BigInt(fundMinor)-BigInt(recorded.enteredRegularAwardsMinor);
 return{status:'completion_evidence' as const,...scope,sourceDigest:value.sourceDigest,resultVersionId:recorded.resultVersionId,
  allocationRevisionId:recorded.allocationRevisionId,order,
  fund:{status:matchedFund&&difference>=BigInt(0)?'director_reviewed_recorded_fund' as const:'held' as const,code:difference<BigInt(0)?'recorded_awards_exceed_recorded_fund':matchedFund?'current_recorded_coverage_review':'additional_income_and_fund_review_required',recordedRegularFundMinor:fundMinor,enteredRegularAwardsMinor:recorded.enteredRegularAwardsMinor,differenceMinor:Number(difference),
   recordedLedgerReviewed:true as const,additionalIncomeMinor:matchedFund?fundReview.additionalIncomeMinor:null,incomeCoverage:matchedFund?'director_reviewed_recorded_income' as const:'not_reviewed' as const,directorDeclaredFundReviewCurrent:matchedFund,fundCompletenessReviewed:matchedFund,independentFundCoverageVerified:false as const},
  snapshotConsistency:'locked_source_snapshot' as const,awardCalculationPerformed:false as const,payoutAuthorized:false as const,moneyMoved:false as const};
 }catch{return null;}}

export const satelliteCompletionEvidenceEnabledV1=()=>integratedTestFeatureEnabled();
type Client={auth:{getClaims:()=>Promise<{data:{claims?:{sub?:unknown;session_id?:unknown}}|null;error:unknown}>;getUser:()=>Promise<{data:{user:{id:string}|null}|null;error:unknown}>};rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>};
export async function loadSatelliteCompletionEvidenceV1(o:{scope:Scope;client:()=>Promise<Client>;enabled?:()=>boolean}){
 const on=()=>{try{return(o.enabled??satelliteCompletionEvidenceEnabledV1)()===true;}catch{return false;}};
 if(!on()||!exact(o.scope,['actorId','tournamentId','eventId'])||!Object.values(o.scope).every(uuid))return null;
 const s=structuredClone(o.scope);try{const c=await o.client();
  async function identity(){if(!on())return null;const claims=await c.auth.getClaims(),u=await c.auth.getUser(),r=await c.rpc('get_tournament_role',{p_tournament_id:s.tournamentId});return!claims.error&&!u.error&&!r.error&&claims.data?.claims?.sub===s.actorId&&u.data?.user?.id===s.actorId&&uuid(claims.data.claims.session_id)&&['director','co_director'].includes(r.data as string)&&on()?claims.data.claims.session_id:null;}
  const sid=await identity();if(!sid)return null;
  const reply=await c.rpc('get_satellite_completion_evidence_v1',{p_tournament_id:s.tournamentId,p_event_id:s.eventId});
  const captured=structuredClone(reply.data);
  if(reply.error||await identity()!==sid||!on())return null;
  return projectSatelliteCompletionEvidenceV1(captured,s);
 }catch{return null;}
}
