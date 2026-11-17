import { isUuid } from '../api/validation.ts';
import { isAccNumber } from '../acc-number.ts';
import { isIdentityEntryV1, identityPresentationV1, type IdentityEntryV1 } from './nonmember-identity-v1.ts';
import type { IdentityBindingV1, IdentityReadScopeV1 } from '../games/scorecard-identity-v1.ts';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:Record<string,unknown>,keys:readonly string[])=>Object.keys(v).sort().join()===[...keys].sort().join();
const text=(v:unknown,max:number,required=false):v is string=>typeof v==='string'&&v.length<=max&&(!required||!!v.trim())&&!/[\u0000-\u001f\u007f]/.test(v);
const stamp=(v:unknown):v is string=>typeof v==='string'&&v.endsWith('Z')&&Number.isFinite(Date.parse(v));
const reference=(v:unknown):v is string=>typeof v==='string'&&isAccNumber(v)&&(!v.startsWith('ZZ')||/^ZZ[0-9]{4}$/.test(v));
export type IdentityFactV2={kind:'player-identity-fact-v2';tournamentId:string;rosterEntryId:string;playerIdentityId:string;version:number;operationId:string;recordedBy:string;recordedAt:string;entry:IdentityEntryV1;displaySuffix:string};
export type TemporaryIdentityV1={kind:'tournament-temporary-id-v1';tournamentId:string;playerIdentityId:string;ordinal:number};
export type IssuedReferenceV1={kind:'acc-issued-reference-record-v1';playerIdentityId:string;number:string;evidenceReference:string;recordedBy:string;recordedAt:string;referenceState:'current';identityVersion:number;identityOperationId:string};
export type LocalIdentityReadbackV2={kind:'local-player-identity-v2';fact:IdentityFactV2;binding:IdentityBindingV1;temporary:TemporaryIdentityV1|null;issuedReference:IssuedReferenceV1|null};
export function temporaryIdentityLabelV1(ordinal:number){return Number.isInteger(ordinal)&&ordinal>=1&&ordinal<=2147483647?`Temporary ID# ${ordinal}`:null;}
export function readLocalIdentityV2(value:unknown,scope:IdentityReadScopeV1):LocalIdentityReadbackV2|null{
 if(!object(value)||!exact(value,['kind','fact','binding','temporary','issuedReference'])||value.kind!=='local-player-identity-v2'||!object(value.fact)||!object(value.binding))return null;
 const f=value.fact,b=value.binding;
 if(!exact(f,['kind','tournamentId','rosterEntryId','playerIdentityId','version','operationId','recordedBy','recordedAt','entry','displaySuffix'])||f.kind!=='player-identity-fact-v2'||![f.tournamentId,f.rosterEntryId,f.playerIdentityId,f.operationId,f.recordedBy].every(isUuid)||f.tournamentId!==scope.tournamentId||f.rosterEntryId!==scope.rosterEntryId||!Number.isSafeInteger(f.version)||(f.version as number)<1||(f.version as number)>2147483647||!stamp(f.recordedAt)||!isIdentityEntryV1(f.entry)||!text(f.displaySuffix,80))return null;
 if(!exact(b,['kind','tournamentId','eventId','participantId','rosterEntryId','playerIdentityId','identityVersion','identityOperationId','viewerActorId'])||b.kind!=='event-player-identity-binding-v1'||![scope.actorId,scope.tournamentId,scope.eventId,scope.participantId,scope.rosterEntryId].every(isUuid)||b.viewerActorId!==scope.actorId||b.tournamentId!==scope.tournamentId||b.eventId!==scope.eventId||b.participantId!==scope.participantId||b.rosterEntryId!==scope.rosterEntryId||b.playerIdentityId!==f.playerIdentityId||b.identityVersion!==f.version||b.identityOperationId!==f.operationId)return null;
 if(value.temporary!==null){const t=value.temporary;if(!object(t)||!exact(t,['kind','tournamentId','playerIdentityId','ordinal'])||t.kind!=='tournament-temporary-id-v1'||t.tournamentId!==f.tournamentId||t.playerIdentityId!==f.playerIdentityId||typeof t.ordinal!=='number'||!temporaryIdentityLabelV1(t.ordinal))return null;}
 if(value.issuedReference!==null){const r=value.issuedReference;if(!object(r)||!exact(r,['kind','playerIdentityId','number','evidenceReference','recordedBy','recordedAt','referenceState','identityVersion','identityOperationId'])||r.kind!=='acc-issued-reference-record-v1'||r.playerIdentityId!==f.playerIdentityId||!reference(r.number)||r.number!==f.entry.accNumber||!text(r.evidenceReference,500,true)||!isUuid(r.recordedBy)||!stamp(r.recordedAt)||r.referenceState!=='current'||r.identityVersion!==f.version||r.identityOperationId!==f.operationId)return null;}
 const nonmember=f.entry.nonmemberWithoutNumber||f.entry.accNumber.startsWith('ZZ');
 if(nonmember&&value.issuedReference===null&&value.temporary===null)return null;
 return value as LocalIdentityReadbackV2;
}
export function localIdentityDisplayV2(value:unknown,scope:IdentityReadScopeV1){
 const v=readLocalIdentityV2(value,scope);if(!v)return null;
 const p=identityPresentationV1(v.fact.entry)!;
 const localNumber=v.issuedReference?.number??(v.temporary?temporaryIdentityLabelV1(v.temporary.ordinal):null);
 const displayName=`${v.fact.entry.firstName} ${v.fact.entry.lastName}${v.fact.displaySuffix?` ${v.fact.displaySuffix}`:''}`;
 if(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(displayName))return null;
 return{displayName,localNumber:localNumber??'ACC/ZZ reference pending',membership:p.membership,joiningStatus:p.joiningStatus,actualMrpAwarded:false as const,accAccepted:null};
}
export type AccPreparationValuesV2={gameCount:number;gamesWon:number;gamePoints:number;plusPoints:number;minusPoints:number;prizeAmountMinor:number;proposedMrp:number};
const resultKeys=['gameCount','gamesWon','gamePoints','plusPoints','minusPoints','prizeAmountMinor','proposedMrp'] as const;
/** ACC PREPARATION ONLY: never an approved format, transmission, membership or award. */
export function projectAccPreparationV2(value:unknown,scope:IdentityReadScopeV1,results:AccPreparationValuesV2){
 const v=readLocalIdentityV2(value,scope);
 if(!v||!object(results)||!exact(results,resultKeys)||resultKeys.some(k=>!Number.isSafeInteger(results[k])||(results[k] as number)<0)||results.gameCount<1||results.gamesWon>results.gameCount)return{status:'blocked' as const,code:'invalid_preparation_sources'};
 const e=v.fact.entry,issued=v.issuedReference;
 const row={firstName:e.firstName,lastName:e.lastName,city:e.city,state:e.state,accNumber:issued?.number??'',gameCount:results.gameCount,gamesWon:results.gamesWon,gamePoints:results.gamePoints,plusPoints:results.plusPoints,minusPoints:results.minusPoints,prizeAmountMinor:results.prizeAmountMinor,proposedMrp:results.proposedMrp,actualMrpAwarded:false as const,joinedAtTournamentClaim:e.joiningClaim.status==='claimed_pending'?'joined_pending' as const:'not_recorded' as const,needsAccHandling:!issued||!e.city.trim()||!e.state.trim()||e.joiningClaim.status==='claimed_pending'};
 const serialized=JSON.stringify(row);
 const contact=[row.firstName,row.lastName,row.city,row.state,row.firstName+' '+row.lastName].join(' ').normalize('NFKC');
 if(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(contact)||/temporary\s*id\s*#\s*[0-9]+/i.test(contact))return{status:'blocked' as const,code:'local_identifier_embedded_in_export'};
 const forbidden=[v.fact.playerIdentityId,v.fact.rosterEntryId,v.fact.tournamentId,v.fact.operationId,v.fact.recordedBy,v.binding.participantId,v.binding.eventId,v.binding.viewerActorId,v.temporary?temporaryIdentityLabelV1(v.temporary.ordinal):null].filter((x):x is string=>!!x);
 if(forbidden.some(x=>serialized.includes(x)))return{status:'blocked' as const,code:'local_identifier_embedded_in_export'};
 return{status:'prepared' as const,formatStatus:'unverified_acc_preparation_only' as const,accSubmissionPerformed:false as const,accAcceptance:'not_determined' as const,row};
}
export function accPreparationCsvV2(value:unknown,scope:IdentityReadScopeV1,results:AccPreparationValuesV2){
 const prepared=projectAccPreparationV2(value,scope,results);
 if(prepared.status!=='prepared')return null;
 const keys=['firstName','lastName','city','state','accNumber','gameCount','gamesWon','gamePoints','plusPoints','minusPoints','prizeAmountMinor','proposedMrp','actualMrpAwarded','needsAccHandling'] as const;
 const cell=(v:unknown)=>{const raw=String(v??''),safe=typeof v==='string'&&/^\s*[=+@-]/.test(raw)?"'"+raw:raw;return '"'+safe.replaceAll('"','""')+'"';};
 return keys.map(cell).join(',')+'\r\n'+keys.map(k=>cell(prepared.row[k])).join(',')+'\r\n';
}
/** No birthdate/local-number input. Suffix is local display only, never ACC export; private desk notes never enter player readback/export. */
export type IdentityDeskRequestV2={kind:'manual-roster-identity-request-v2';idempotencyKey:string;entry:IdentityEntryV1;displaySuffix:string;privateDeskNote:string};
export function isIdentityDeskRequestV2(v:unknown):v is IdentityDeskRequestV2{return object(v)&&exact(v,['kind','idempotencyKey','entry','displaySuffix','privateDeskNote'])&&v.kind==='manual-roster-identity-request-v2'&&isUuid(v.idempotencyKey)&&isIdentityEntryV1(v.entry)&&text(v.displaySuffix,80)&&text(v.privateDeskNote,500);}
