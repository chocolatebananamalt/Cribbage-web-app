import{isIdentityEntryV1,type IdentityEntryV1}from'./nonmember-identity-v1.ts';
import{isUuid}from'../api/validation.ts';
export type VisibleDistinctionV3={prefix:string;middleName:string;suffix:string;localLabel:string};
export type IdentityDraftV3={kind:'manual-roster-identity-request-v3';idempotencyKey:string;entry:IdentityEntryV1;address:{street:string;postalCode:string;country:string};distinction:VisibleDistinctionV3;privateDeskNote:string};
export type DuplicateScopeV3={actorId:string;sessionId:string;tournamentId:string};
export type DuplicateSnapshotV3={kind:'identity-duplicate-snapshot-v3';actorId:string;sessionId:string;tournamentId:string;reviewId:string;sourceRevision:number;sourceDigest:string;matchFingerprint:string;coverage:'complete'|'incomplete_input'|'incomplete_candidates';matches:Array<{rosterEntryId:string;playerIdentityId:string;displayName:string;identityVersion:number}>};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:Record<string,unknown>,keys:readonly string[])=>Object.keys(v).sort().join() === [...keys].sort().join();
const text=(v:unknown,max:number):v is string=>typeof v==='string'&&v.length<=max&&!/[\u0000-\u001f\u007f]/.test(v);
const norm=(v:string)=>v.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
const unsafeLocal=(v:string)=>/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(v)||/temporary\s*id\s*#\s*[0-9]+/i.test(v);
export function isVisibleDistinctionV3(v:unknown):v is VisibleDistinctionV3{return object(v)&&exact(v,['prefix','middleName','suffix','localLabel'])&&['prefix','middleName','suffix','localLabel'].every(k=>text(v[k],80)&&!unsafeLocal(v[k] as string));}
export function isIdentityDraftV3(v:unknown):v is IdentityDraftV3{return object(v)&&exact(v,['kind','idempotencyKey','entry','address','distinction','privateDeskNote'])&&v.kind==='manual-roster-identity-request-v3'&&isUuid(v.idempotencyKey)&&isIdentityEntryV1(v.entry)&&object(v.address)&&exact(v.address,['street','postalCode','country'])&&text(v.address.street,300)&&text(v.address.postalCode,40)&&text(v.address.country,80)&&isVisibleDistinctionV3(v.distinction)&&text(v.privateDeskNote,500);}
export function completeIdentityAddressV3(d:IdentityDraftV3){return isIdentityDraftV3(d)&&[d.address.street,d.entry.city,d.entry.state,d.address.postalCode,d.address.country].every(x=>!!x.trim()&&!['unknown','n/a','na','not provided','none','-'].includes(norm(x)));}
export function identityMatchKeyV3(d:IdentityDraftV3){if(!completeIdentityAddressV3(d))return null;return JSON.stringify([d.entry.firstName,d.entry.lastName,d.address.street,d.entry.city,d.entry.state,d.address.postalCode,d.address.country].map(norm));}
export async function identityMatchFingerprintV3(d:IdentityDraftV3){const key=identityMatchKeyV3(d);if(key===null)return null;return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key))),b=>b.toString(16).padStart(2,'0')).join('');}
export function visibleIdentityNameV3(entry:IdentityEntryV1,x:VisibleDistinctionV3){if(!isIdentityEntryV1(entry)||!isVisibleDistinctionV3(x))return null;const name=[x.prefix,entry.firstName,x.middleName,entry.lastName,x.suffix].filter(x=>!!x.trim()).map(x=>x.trim()).join(' ')+(x.localLabel.trim()?` (${x.localLabel.trim()})`:'');return unsafeLocal(name)?null:name;}
export function distinguishedDisplayNameV3(d:IdentityDraftV3){return isIdentityDraftV3(d)?visibleIdentityNameV3(d.entry,d.distinction):null;}
export function readDuplicateSnapshotV3(v:unknown,scope:DuplicateScopeV3,fingerprint:string):DuplicateSnapshotV3|null{
 if(!object(v)||!exact(v,['kind','actorId','sessionId','tournamentId','reviewId','sourceRevision','sourceDigest','matchFingerprint','coverage','matches'])||v.kind!=='identity-duplicate-snapshot-v3'||![v.actorId,v.sessionId,v.tournamentId,v.reviewId].every(isUuid)||v.actorId!==scope.actorId||v.sessionId!==scope.sessionId||v.tournamentId!==scope.tournamentId||!Number.isSafeInteger(v.sourceRevision)||(v.sourceRevision as number)<0||typeof v.sourceDigest!=='string'||!/^[0-9a-f]{64}$/.test(v.sourceDigest)||v.matchFingerprint!==fingerprint||!['complete','incomplete_input','incomplete_candidates'].includes(v.coverage as string)||!Array.isArray(v.matches)||v.matches.length>500)return null;
 const seen=new Set<string>();for(const row of v.matches){if(!object(row)||!exact(row,['rosterEntryId','playerIdentityId','displayName','identityVersion'])||!isUuid(row.rosterEntryId)||!isUuid(row.playerIdentityId)||!text(row.displayName,400)||!row.displayName.trim()||unsafeLocal(row.displayName)||!Number.isSafeInteger(row.identityVersion)||(row.identityVersion as number)<1||(row.identityVersion as number)>2147483647||seen.has(row.rosterEntryId))return null;seen.add(row.rosterEntryId);}
 return v as DuplicateSnapshotV3;
}
export type DuplicateDecisionV3={action:'duplicate';rosterEntryId:string}|{action:'distinct'};
/** PRE-SAVE decision only; server must recompute under the same transaction as allocation/creation. */
export async function identityPreSaveStateV3(inputDraft:unknown,inputSnapshot:unknown,inputScope:DuplicateScopeV3,inputDecision?:DuplicateDecisionV3){
 let draft:unknown,snapshot:unknown,scope:DuplicateScopeV3,decision:DuplicateDecisionV3|undefined;
 try{draft=structuredClone(inputDraft);snapshot=structuredClone(inputSnapshot);scope=structuredClone(inputScope);decision=structuredClone(inputDecision)}catch{return{status:'blocked' as const,reason:'unreadable_inputs'}}
 if(!isIdentityDraftV3(draft))return{status:'blocked' as const,reason:'invalid_draft'};
 if(!completeIdentityAddressV3(draft))return{status:'blocked' as const,reason:'incomplete_address'};
 const fingerprint=await identityMatchFingerprintV3(draft),s=readDuplicateSnapshotV3(snapshot,scope,fingerprint!);
 if(!s)return{status:'blocked' as const,reason:'review_unavailable_or_stale'};
 if(s.coverage!=='complete')return{status:'blocked' as const,reason:'address_coverage_incomplete'};
 const displayName=distinguishedDisplayNameV3(draft);if(!displayName)return{status:'blocked' as const,reason:'invalid_display_name'};
 if(decision?.action==='duplicate'){const row=s.matches.find(x=>x.rosterEntryId===decision.rosterEntryId);return row?{status:'open_existing' as const,tournamentId:scope.tournamentId,rosterEntryId:row.rosterEntryId}:{status:'blocked' as const,reason:'existing_registration_not_in_review'};}
 if(s.matches.length===0)return{status:'ready_new' as const,displayName,reviewId:s.reviewId,sourceRevision:s.sourceRevision,sourceDigest:s.sourceDigest,matchFingerprint:s.matchFingerprint};
 if(decision?.action!=='distinct')return{status:'needs_choice' as const,matches:s.matches};
 if(!Object.values(draft.distinction).some(x=>!!x.trim()))return{status:'blocked' as const,reason:'visible_distinction_required'};
 if(s.matches.some(x=>norm(x.displayName)===norm(displayName)))return{status:'blocked' as const,reason:'display_names_still_indistinguishable'};
 return{status:'ready_distinct' as const,displayName,reviewId:s.reviewId,sourceRevision:s.sourceRevision,sourceDigest:s.sourceDigest,matchFingerprint:s.matchFingerprint};
}
