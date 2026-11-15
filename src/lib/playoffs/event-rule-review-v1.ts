import{isEventPlayoffParametersDraftV1,resolveEventPlayoffParametersDraftV1,type EventPlayoffParametersDraftV1}from'./event-playoff-parameters-v1.ts';
import{assessSeriesForSetupReviewV2}from'./series-activation-review-v2.ts';
export type EventRuleSourceV1={tournamentId:string;setupRevisionId:string;settingsSnapshotId:string;eventClientRowId:string;setupEventVersionId:string;draftDigest:string};
export type EventRuleCurrentV1={source:EventRuleSourceV1;eventKind:'main'|'consolation';draft:EventPlayoffParametersDraftV1};
export type EventRuleReviewV1={reviewId:string;priorReviewId:string|null;version:number;actorId:string;source:EventRuleSourceV1;context:{sanctioned:boolean;durationDays:number;eventKind:'main'|'consolation';originalEntrants:null};reason:string;approvalReference:string};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(v);
const version=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=1&&v<=2147483647;
const canonical=(v:unknown)=>JSON.stringify(v,(_k,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
function freeze<T>(v:T):T{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
const copy=<T>(v:T):T=>freeze(JSON.parse(canonical(v))as T);
function source(v:unknown):v is EventRuleSourceV1{return exact(v,['tournamentId','setupRevisionId','settingsSnapshotId','eventClientRowId','setupEventVersionId','draftDigest'])&&[v.tournamentId,v.setupRevisionId,v.settingsSnapshotId,v.eventClientRowId,v.setupEventVersionId].every(uuid)&&typeof v.draftDigest==='string'&&/^[a-f0-9]{64}$/.test(v.draftDigest);}
function current(v:unknown):v is EventRuleCurrentV1{return exact(v,['source','eventKind','draft'])&&source(v.source)&&(v.eventKind==='main'||v.eventKind==='consolation')&&isEventPlayoffParametersDraftV1(v.draft);}
function validHistory(v:unknown,binding:EventRuleCurrentV1):v is EventRuleReviewV1[]{
 if(!Array.isArray(v)||v.length<1||v.length>10000||Reflect.ownKeys(v).length!==v.length+1)return false;
 const seen=new Set<string>();let previous:EventRuleReviewV1|undefined;
 for(const raw of v){
  if(!exact(raw,['reviewId','priorReviewId','version','actorId','source','context','reason','approvalReference'])||!uuid(raw.reviewId)||!uuid(raw.actorId)||!version(raw.version)||!source(raw.source)||raw.source.tournamentId!==binding.source.tournamentId||raw.source.eventClientRowId!==binding.source.eventClientRowId
   ||!exact(raw.context,['sanctioned','durationDays','eventKind','originalEntrants'])||typeof raw.context.sanctioned!=='boolean'||!version(raw.context.durationDays)||(raw.context.eventKind!=='main'&&raw.context.eventKind!=='consolation')||raw.context.originalEntrants!==null
   ||typeof raw.reason!=='string'||raw.reason!==raw.reason.trim()||raw.reason.length<1||raw.reason.length>500||/[\u0000-\u001f\u007f]/.test(raw.reason)||typeof raw.approvalReference!=='string'||raw.approvalReference.length>1000)return false;
  const row=raw as EventRuleReviewV1;
  if(seen.has(row.reviewId)||(previous?(row.priorReviewId!==previous.reviewId||row.version!==previous.version+1):(row.priorReviewId!==null||row.version!==1)))return false;
  seen.add(row.reviewId);previous=row;
 }
 return true;
}
const noAuthority={activationAllowed:false as const,playStartAllowed:false as const,playoffStartAllowed:false as const,officialApprovalClaimed:false as const,externalApprovalVerified:false as const,durableReviewPersisted:false as const,moneyMoved:false as const};
/** Pure plan over a separately loaded authoritative settings/event binding.
 * The source digest is an opaque server pin, not client proof of a true source.
 * Actor UUIDs and pasted reference text never establish roles or RC approval.
 * Historical rows remain untouched; only a new explicit review may bind a new
 * settings source. Actual original entrants must come from future native data.
 */
export function planEventRuleReviewV1(history:unknown,loadedCurrent:unknown){
 const fail=(code:string)=>({status:'blocked' as const,code,...noAuthority});
 if(!current(loadedCurrent))return fail('invalid_current_binding');
 if(!validHistory(history,loadedCurrent))return fail('invalid_review_history');
 const latest=history.at(-1)!;
 if(canonical(latest.source)!==canonical(loadedCurrent.source))return fail('stale_review_source');
 if(latest.context.eventKind!==loadedCurrent.eventKind)return fail('event_kind_binding_changed');
 const resolved=resolveEventPlayoffParametersDraftV1(loadedCurrent.draft);if(!resolved)return fail('incomplete_settings');
 const assessment=assessSeriesForSetupReviewV2(resolved.series,{...latest.context,eventKind:loadedCurrent.eventKind,originalEntrants:null});
 return{status:'setup_review_plan' as const,version:'event-rule-review-context-v1' as const,latestReview:copy(latest),historyRecordCount:history.length,
  setupReviewEligible:assessment.setupReviewEligible,assessment:assessment.assessment,playoffFormatReviewReady:assessment.playoffFormatReviewReady,
  deferredRequirements:assessment.deferredRequirements.map(requirement=>({...requirement,reviewId:latest.reviewId,reviewVersion:latest.version,source:copy(latest.source),fulfilled:false as const,requiresNativeOriginalEntrants:true as const,officialApprovalClaimed:false as const})),
  approvalReferenceIsEvidenceOnly:true as const,...noAuthority};
}
/** Full-prefix immutability across both same-source corrections and explicit
 * new-source review revisions. This check is not a persistence/role grant.
 */
export function isEventRuleReviewExtensionV1(previous:unknown,next:unknown,loadedCurrent:unknown):boolean{
 if(!current(loadedCurrent)||!validHistory(previous,loadedCurrent)||!validHistory(next,loadedCurrent)||next.length<previous.length||planEventRuleReviewV1(next,loadedCurrent).status!=='setup_review_plan')return false;
 return previous.every((row,index)=>canonical(row)===canonical(next[index]));
}
