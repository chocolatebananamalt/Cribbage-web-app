import{isEventPlayoffParametersDraftV1,resolveEventPlayoffParametersDraftV1,type EventPlayoffParametersDraftV1}from'./event-playoff-parameters-v1.ts';
import{assessEventSeriesSettingsV1,type SeriesRuleContextV1}from'./series-settings-v1.ts';
type EventIdentity={tournamentId:string;eventId:string};
export type EventRulePlayoffPointersV1=EventIdentity&{activationId:string;settingsBindingId:string;reviewId:string;playStartId:string;schedulePublicationId:string;qualificationId:string};
export type EventRulePlayoffFactsV1=EventIdentity&{
 activation:EventIdentity&{id:string;settingsBindingId:string;reviewId:string};
 settings:EventIdentity&{id:string;activationId:string;reviewId:string;eventKind:'main'|'consolation';draft:EventPlayoffParametersDraftV1;context:SeriesRuleContextV1};
 playStart:EventIdentity&{id:string;schedulePublicationId:string;participantCount:number;startSource:'official'};
 schedule:EventIdentity&{id:string;participantCount:number};
 qualification:EventIdentity&{id:string;schedulePublicationId:string;participantCount:number;qualifierCount:number;status:'finalized'};
};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(v);
// Native PostgreSQL integer DTO bound, not an ACC maximum field size.
const count=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=1&&v<=2147483647;
const pinKeys=['tournamentId','eventId','activationId','settingsBindingId','reviewId','playStartId','schedulePublicationId','qualificationId'];
const noAuthority={activationAllowed:false as const,playStartAllowed:false as const,playoffStartAllowed:false as const,paymentAuthorized:false as const,moneyMoved:false as const,officialApprovalClaimed:false as const,reviewPersisted:false as const};
function freeze<T>(v:T):T{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
const copy=<T>(v:T):T=>freeze(JSON.parse(JSON.stringify(v))as T);
/** Pure review over separately loaded authoritative native facts/pointers.
 * Expected pointers must come from the same locked reader, not posted claims.
 * Source rows being called "official" here is not provider/SQL verification.
 * This cannot start play, decide recipients or waive approval requirements.
 */
export function planEventRulePlayoffGateV1(current:unknown,expected:unknown){
 const fail=(code:string)=>({status:'blocked' as const,code,...noAuthority});
 if(!exact(expected,pinKeys)||!pinKeys.every(k=>uuid(expected[k]))||!exact(current,['tournamentId','eventId','activation','settings','playStart','schedule','qualification'])||!uuid(current.tournamentId)||!uuid(current.eventId))return fail('invalid_source');
 if(current.tournamentId!==expected.tournamentId||current.eventId!==expected.eventId)return fail('stale_source_pointer');
 const a=current.activation,s=current.settings,start=current.playStart,schedule=current.schedule,q=current.qualification;
 if(!exact(a,['id','tournamentId','eventId','settingsBindingId','reviewId'])||!exact(s,['id','tournamentId','eventId','activationId','reviewId','eventKind','draft','context'])||!exact(start,['id','tournamentId','eventId','schedulePublicationId','participantCount','startSource'])||!exact(schedule,['id','tournamentId','eventId','participantCount'])||!exact(q,['id','tournamentId','eventId','schedulePublicationId','participantCount','qualifierCount','status']))return fail('invalid_source');
 for(const row of[a,s,start,schedule,q])if(!uuid(row.id)||row.tournamentId!==current.tournamentId||row.eventId!==current.eventId)return fail('foreign_source');
 if(a.id!==expected.activationId||a.settingsBindingId!==expected.settingsBindingId||a.reviewId!==expected.reviewId||s.id!==expected.settingsBindingId||s.activationId!==expected.activationId||s.reviewId!==expected.reviewId
  ||start.id!==expected.playStartId||start.schedulePublicationId!==expected.schedulePublicationId||schedule.id!==expected.schedulePublicationId||q.id!==expected.qualificationId||q.schedulePublicationId!==expected.schedulePublicationId)return fail('stale_source_pointer');
 if(start.startSource!=='official'||q.status!=='finalized')return fail('official_finalized_source_required');
 if(!count(start.participantCount)||!count(schedule.participantCount)||!count(q.participantCount)||!count(q.qualifierCount))return fail('invalid_native_count');
 if(start.participantCount!==schedule.participantCount||start.participantCount!==q.participantCount)return fail('native_count_disagreement');
 const expectedQualifiers=Math.floor((start.participantCount+3)/4);
 if(q.qualifierCount!==expectedQualifiers)return fail('qualification_count_disagreement');
 if((s.eventKind!=='main'&&s.eventKind!=='consolation')||!exact(s.context,['sanctioned','eventKind','durationDays','originalEntrants'])||typeof s.context.sanctioned!=='boolean'||!count(s.context.durationDays)||s.context.eventKind!==s.eventKind||s.context.originalEntrants!==null||!isEventPlayoffParametersDraftV1(s.draft))return fail('invalid_bound_context');
 const resolved=resolveEventPlayoffParametersDraftV1(s.draft);if(!resolved)return fail('incomplete_settings');
 if(resolved.payout.method==='custom_paid_ratio')return fail('ratio_paid_places_policy_unresolved');
 const context:SeriesRuleContextV1={sanctioned:s.context.sanctioned,eventKind:s.eventKind,durationDays:s.context.durationDays,originalEntrants:start.participantCount};
 const assessment=assessEventSeriesSettingsV1(resolved.series,context);
 if(!['known_rules_satisfied','informal_settings'].includes(assessment.status))return{status:'blocked' as const,code:'strict_series_review_required',assessment,derivedOriginalEntrants:start.participantCount,...noAuthority};
 return{status:'pre_playoff_review_plan' as const,version:'event-rule-native-count-playoff-gate-v1' as const,sourcePointers:copy(expected as EventRulePlayoffPointersV1),derivedOriginalEntrants:start.participantCount,verifiedQualifierCount:q.qualifierCount,
  context:copy(context),assessment,nativeEvidenceStillRequiresServerVerification:true as const,...noAuthority};
}
