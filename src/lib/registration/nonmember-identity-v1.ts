import { isUuid } from '../api/validation.ts';
import { isAccNumber, normalizeAccNumberInput } from '../acc-number.ts';
export const noAccNonmemberLabelV1 = 'Nonmember — no ACC/ZZ number';
export type IdentityEntryV1 = {firstName:string;lastName:string;email:string;city:string;state:string;accNumber:string;nonmemberWithoutNumber:boolean;scorecardType:'paper'|'digital';joiningClaim:{status:'none'|'claimed_pending';evidenceReference:string}};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const text=(v:unknown,max:number,required=false):v is string=>typeof v==='string'&&v.length<=max&&(!required||!!v.trim())&&!/[\u0000-\u001f\u007f]/.test(v);
export function identityEntryIssueV1(v:unknown):string|null {
 if(!object(v)||!exact(v,['firstName','lastName','email','city','state','accNumber','nonmemberWithoutNumber','scorecardType','joiningClaim']))return 'invalid_identity_shape';
 if(!text(v.firstName,80,true)||!text(v.lastName,80,true)||`${v.firstName} ${v.lastName}`.length>160||!text(v.email,320)||v.email!==''&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)||!text(v.city,160)||!text(v.state,80))return 'invalid_contact';
 if(typeof v.nonmemberWithoutNumber!=='boolean'||!text(v.accNumber,64)||!['paper','digital'].includes(v.scorecardType as string))return 'invalid_identity';
 if(v.accNumber!==normalizeAccNumberInput(v.accNumber))return 'number_not_normalized';
 if(v.nonmemberWithoutNumber&&v.accNumber!=='')return 'nonmember_checkbox_number_conflict';
 if(v.accNumber.startsWith('ZZ')&&!/^ZZ[0-9]{4}$/.test(v.accNumber))return 'invalid_zz_reference';
 if(v.accNumber!==''&&!isAccNumber(v.accNumber))return 'invalid_acc_reference';
 if(!object(v.joiningClaim)||!exact(v.joiningClaim,['status','evidenceReference'])||!['none','claimed_pending'].includes(v.joiningClaim.status as string)||!text(v.joiningClaim.evidenceReference,500)||v.joiningClaim.status==='none'&&v.joiningClaim.evidenceReference!=='')return 'invalid_joining_claim';
 return null;
}
export const isIdentityEntryV1=(v:unknown):v is IdentityEntryV1=>identityEntryIssueV1(v)===null;
export function identityPresentationV1(v:IdentityEntryV1){
 if(!isIdentityEntryV1(v))return null;
 const nonmember=v.nonmemberWithoutNumber||v.accNumber.startsWith('ZZ');
 return {label:v.accNumber|| (v.nonmemberWithoutNumber?noAccNonmemberLabelV1:'ACC/ZZ number not provided — membership unknown'),membership:nonmember?'nonmember' as const:v.accNumber?'reference_unverified' as const:'unknown' as const,joiningStatus:v.joiningClaim.status,officialMembershipVerified:false as const,actualMrpAwarded:false as const,actualMrpAwardMaximum:nonmember?0:null,accAccepted:null};
}
export type IdentityRequestV1={kind:'manual-roster-identity-request-v1';idempotencyKey:string;entry:IdentityEntryV1};
export function isIdentityRequestV1(v:unknown):v is IdentityRequestV1{return object(v)&&exact(v,['kind','idempotencyKey','entry'])&&v.kind==='manual-roster-identity-request-v1'&&isUuid(v.idempotencyKey)&&isIdentityEntryV1(v.entry);}
export type IdentityReceiptV1={kind:'manual-roster-identity-result-v1';status:'recorded';tournamentId:string;actorId:string;idempotencyKey:string;rosterEntryId:string;playerIdentityId:string;identityVersion:number;entry:IdentityEntryV1;profileLinked:false;roleGranted:false;paymentRecorded:false;checkedIn:false;eventEnrolled:false};
const entryKey=(a:IdentityEntryV1)=>JSON.stringify([a.firstName,a.lastName,a.email,a.city,a.state,a.accNumber,a.nonmemberWithoutNumber,a.scorecardType,a.joiningClaim.status,a.joiningClaim.evidenceReference]);
const same=(a:IdentityEntryV1,b:IdentityEntryV1)=>entryKey(a)===entryKey(b);
export function readIdentityReceiptV1(v:unknown,scope:{tournamentId:string;actorId:string},request?:IdentityRequestV1):IdentityReceiptV1|null{
 if(!object(v)||!exact(v,['kind','status','tournamentId','actorId','idempotencyKey','rosterEntryId','playerIdentityId','identityVersion','entry','profileLinked','roleGranted','paymentRecorded','checkedIn','eventEnrolled'])||v.kind!=='manual-roster-identity-result-v1'||v.status!=='recorded'||v.tournamentId!==scope.tournamentId||v.actorId!==scope.actorId||![v.tournamentId,v.actorId,v.idempotencyKey,v.rosterEntryId,v.playerIdentityId].every(isUuid)||!Number.isSafeInteger(v.identityVersion)||(v.identityVersion as number)<1||!isIdentityEntryV1(v.entry)||['profileLinked','roleGranted','paymentRecorded','checkedIn','eventEnrolled'].some(k=>v[k]!==false))return null;
 if(request&&(v.idempotencyKey!==request.idempotencyKey||!same(v.entry,request.entry)))return null;
 return v as IdentityReceiptV1;
}
