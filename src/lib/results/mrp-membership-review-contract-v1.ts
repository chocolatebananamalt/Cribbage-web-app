export type Row=Record<string,unknown>;
export const mrpReviewUuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const object=(v:unknown):v is Row=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[])=>object(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const text=(v:unknown)=>typeof v==='string'&&v.length>0&&v.length<=500&&v===v.trim()&&!/[\u0000-\u001f\u007f]/.test(v);
function wire(v:unknown,depth=0,seen=new Set<object>()):boolean{
 if(depth>8)return false;if(v===null||typeof v==='string'||typeof v==='boolean')return true;if(typeof v==='number')return Number.isFinite(v);
 if(!v||typeof v!=='object'||seen.has(v)||(!Array.isArray(v)&&!object(v)))return false;seen.add(v);
 const descriptors=Object.getOwnPropertyDescriptors(v);if(Reflect.ownKeys(descriptors).length>1000)return false;
 for(const key of Reflect.ownKeys(descriptors)){if(Array.isArray(v)&&key==='length')continue;const d=Object.getOwnPropertyDescriptor(v,key);if(typeof key!=='string'||!d||!('value'in d)||!d.enumerable||!wire(d.value,depth+1,seen))return false;}
 return true;
}
const date=(v:unknown)=>v===null||(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00.000Z'))&&new Date(v+'T00:00:00.000Z').toISOString().slice(0,10)===v);
const timestamp=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
export function isMrpMembershipManualReviewRequestV1(v:unknown):v is Row{
 try{
  if(!wire(v)||!object(v)||!exact(v,['version','action','rosterEntryId','expectedHeadId','expectedHeadDigest','observationId','supersedesCorrectionId','data'])||v.version!=='mrp-membership-manual-review-v1'||!mrpReviewUuid(v.rosterEntryId)
   ||!['observation','correction','withdrawal','provisional'].includes(v.action as string)||![v.expectedHeadId,v.observationId,v.supersedesCorrectionId].every(x=>x===null||mrpReviewUuid(x))
   ||(v.expectedHeadId===null?v.expectedHeadDigest!==null:!hash(v.expectedHeadDigest))||!object(v.data))return false;
  const d=v.data;if(!date(d.sourceAsOf)||!date(d.evidenceDate)||!text(d.evidenceReference))return false;
  if(v.action==='observation')return (d.status!=='assumed_active'&&exact(d,['status','observedAt','sourceReference','sourceAsOf','evidenceDate','evidenceReference','observedAccNumber'])||d.status==='assumed_active'&&exact(d,['status','observedAt','sourceReference','sourceAsOf','evidenceDate','evidenceReference','observedAccNumber','listingIdentityMatched','expiredMarker','deceasedMarker'])&&[d.listingIdentityMatched,d.expiredMarker,d.deceasedMarker].every(x=>typeof x==='boolean'))
   &&v.observationId===null&&v.supersedesCorrectionId===null&&['active','inactive','nonmember','unknown','not_found','unavailable','assumed_active'].includes(d.status as string)
   &&timestamp(d.observedAt)&&text(d.sourceReference)&&(d.observedAccNumber===null?['unknown','not_found','unavailable','nonmember'].includes(d.status as string):typeof d.observedAccNumber==='string'&&d.observedAccNumber.length<=64&&/^[A-Z]{2}\d+Y?$/.test(d.observedAccNumber));
  if(v.action==='provisional')return mrpReviewUuid(v.observationId)&&exact(d,['reason','sourceReference','evidenceReference','evidenceDate','sourceAsOf','status','reportingFlag','resolutionRequired','requestedAt'])&&text(d.reason)&&text(d.sourceReference)&&d.status==='approved_for_reporting_pending_acc_resolution'&&d.reportingFlag==='acc_resolution_pending'&&d.resolutionRequired===true&&timestamp(d.requestedAt);
  return mrpReviewUuid(v.observationId)&&text(d.reason)&&(v.action==='correction'
   ?exact(d,['reason','evidenceReference','evidenceDate','sourceAsOf','status','reasonCode'])&&d.status==='verified_active'&&d.reasonCode==='website_reporting_error'
   :exact(d,['reason','evidenceReference','evidenceDate','sourceAsOf']));
 }catch{return false;}
}
export type MrpReviewScopeV1={tournamentId:string;eventId:string;rosterEntryId:string};
export type MrpReviewRecordV1={id:string;version:number;priorId:string|null;recordDigest:string;action:'observation'|'correction'|'withdrawal'|'provisional';observationId:string|null;supersedesCorrectionId:string|null;data:Row;actorId:string;recordedAt:string};
export type MrpReviewWorkspaceV1=MrpReviewScopeV1&{kind:'mrp-membership-manual-review-workspace-v1';currentHeadId:string|null;currentHeadDigest:string|null;currentVersion:number;records:MrpReviewRecordV1[];eligibility:'review_pending';awarded:null;officialEligibilityDetermined:false;registrationChanged:false;mrpWritten:false};
export function readMrpMembershipReviewWorkspaceV1(v:unknown,scope:MrpReviewScopeV1):MrpReviewWorkspaceV1|null{
 try{
  if(!wire(v)||!object(v)||!exact(v,['kind','tournamentId','eventId','rosterEntryId','currentHeadId','currentHeadDigest','currentVersion','records','eligibility','awarded','officialEligibilityDetermined','registrationChanged','mrpWritten'])||v.kind!=='mrp-membership-manual-review-workspace-v1'||Object.values(scope).some(x=>!mrpReviewUuid(x))||v.tournamentId!==scope.tournamentId||v.eventId!==scope.eventId||v.rosterEntryId!==scope.rosterEntryId||v.eligibility!=='review_pending'||v.awarded!==null||v.officialEligibilityDetermined!==false||v.registrationChanged!==false||v.mrpWritten!==false||!Array.isArray(v.records)||v.records.length>1000||v.currentVersion!==v.records.length)return null;
  let prior:MrpReviewRecordV1|null=null,observation:MrpReviewRecordV1|null=null,correction:MrpReviewRecordV1|null=null;const ids=new Set();
  for(const raw of v.records){
   if(!object(raw)||!exact(raw,['id','version','priorId','recordDigest','action','observationId','supersedesCorrectionId','data','actorId','recordedAt'])||!mrpReviewUuid(raw.id)||ids.has(raw.id)||!mrpReviewUuid(raw.actorId)||!hash(raw.recordDigest)||raw.version!==(prior?.version??0)+1||raw.priorId!==(prior?.id??null)||typeof raw.recordedAt!=='string'||!Number.isFinite(Date.parse(raw.recordedAt)))return null;
   const r=raw as MrpReviewRecordV1;
   if(!isMrpMembershipManualReviewRequestV1({version:'mrp-membership-manual-review-v1',action:r.action,rosterEntryId:scope.rosterEntryId,expectedHeadId:prior?.id??null,expectedHeadDigest:prior?.recordDigest??null,observationId:r.observationId,supersedesCorrectionId:r.supersedesCorrectionId,data:r.data}))return null;
   if(r.action==='observation'){observation=r;correction=null;}
   else{if(!observation||r.observationId!==observation.id||r.supersedesCorrectionId!==(correction?.id??null)||r.action==='correction'&&!['inactive','nonmember'].includes(observation.data.status as string)||r.action==='withdrawal'&&!['correction','provisional'].includes(correction?.action??''))return null;correction=r;}
   ids.add(r.id);prior=r;
  }
  if(v.currentHeadId!==(prior?.id??null)||v.currentHeadDigest!==(prior?.recordDigest??null))return null;
  return structuredClone(v) as MrpReviewWorkspaceV1;
 }catch{return null;}
}
const held=(v:Row)=>v.eligibility==='review_pending'&&v.awarded===null&&v.officialEligibilityDetermined===false&&v.registrationChanged===false&&v.mrpWritten===false;
const rejectedCodes=new Set(['invalid_request','idempotency_conflict','entry_unavailable','stale_head','future_observation','identity_mismatch','stale_observation','stale_correction','definitive_website_error_required','current_correction_required','provisional_requires_uncertain_membership']);
export function isMrpMembershipReviewCommandReplyV1(v:unknown,scope:{id:string;eventId:string},request:Row,recovery:boolean):boolean{
 if(!wire(v)||!object(v))return false;
 if(exact(v,['status','code']))return(v.status==='rejected'&&rejectedCodes.has(v.code as string))||(v.status==='retry_exact'&&v.code==='source_busy')||(v.status==='blocked'&&['feature_disabled','permission_required'].includes(v.code as string));
 if(recovery&&exact(v,['status','writeAuthorized','currentHeadVerified'])&&v.status==='not_found')return v.writeAuthorized===false&&v.currentHeadVerified===false;
 return exact(v,['status','recordId','version','recordDigest','recordedAt','tournamentId','eventId','rosterEntryId','action','eligibility','awarded','currentHeadVerified','officialEligibilityDetermined','registrationChanged','mrpWritten'])
  &&v.status==='manual_review_recorded'&&mrpReviewUuid(v.recordId)&&Number.isSafeInteger(v.version)&&(v.version as number)>0&&hash(v.recordDigest)&&typeof v.recordedAt==='string'&&Number.isFinite(Date.parse(v.recordedAt))
  &&v.tournamentId===scope.id&&v.eventId===scope.eventId&&v.rosterEntryId===request.rosterEntryId&&v.action===request.action&&held(v)&&v.currentHeadVerified===false;
}

