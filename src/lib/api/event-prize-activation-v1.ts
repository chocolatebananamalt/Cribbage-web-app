import {isEventPrizeResponseValueV1,isEventPrizeWireValueV1} from './event-prize-settings-v1.ts';
import {readEventPrizeWorkspaceV1,type EventPrizeWorkspaceV1} from './event-prize-workspace-v1.ts';
import {isEventSettingsActivationRequestV4,type EventSettingsActivationRequestV4} from './event-settings-activation-v4.ts';
import {isLinkedSetupActivationResult} from './setup-event-links.ts';
import {resolveEventSeriesDraftV1,validIncrementFactorDraftV1} from '../playoffs/event-playoff-parameters-v1.ts';
import {assessSeriesForSetupReviewV2} from '../playoffs/series-activation-review-v2.ts';
import type {SeriesRuleContextV1} from '../playoffs/series-settings-v1.ts';

export type EventPrizeActivationV1={kind:'event-prize-activation-v1';activation:EventSettingsActivationRequestV4;prizeSnapshotId:string;prizeDigest:string;confirmedContext:true};
type Review={eventClientRowId:string;reviewId:string;draftDigest:string;reviewedDraft:unknown;current:true;context:SeriesRuleContextV1};
export type EventPrizeActivationSourceV1={kind:'event-prize-activation-source-v1';actorId:string;tournamentId:string;workspace:EventPrizeWorkspaceV1;activationSource:Record<string,unknown>;reviews:Review[];registrationOnly:true;accountingAllowed:false;playoffStartAllowed:false;moneyMoved:false};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(v);
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
const canonical=(v:unknown)=>JSON.stringify(v,(_k,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
function freeze<T>(v:T):T{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
export const eventPrizeActivationEnabledV1=()=>false;
export function isEventPrizeActivationV1(v:unknown):v is EventPrizeActivationV1{
 try{return isEventPrizeWireValueV1(v)&&exact(v,['kind','activation','prizeSnapshotId','prizeDigest','confirmedContext'])&&v.kind==='event-prize-activation-v1'&&v.confirmedContext===true&&uuid(v.prizeSnapshotId)&&hash(v.prizeDigest)&&isEventSettingsActivationRequestV4(v.activation)&&v.activation.request.declarationPins===undefined;}catch{return false;}
}
export function serializeEventPrizeActivationV1(v:unknown):string|null{return isEventPrizeActivationV1(v)?canonical(v):null;}
export function parseEventPrizeActivationV1(raw:unknown):EventPrizeActivationV1|null{try{if(typeof raw!=='string'||new TextEncoder().encode(raw).length>1_000_000)return null;const v:unknown=JSON.parse(raw);return serializeEventPrizeActivationV1(v)===raw?freeze(v as EventPrizeActivationV1):null;}catch{return null;}}
export async function eventPrizeActivationRequestHashV1(v:unknown):Promise<string|null>{const raw=serializeEventPrizeActivationV1(v);if(raw===null)return null;try{const bytes=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}catch{return null;}}
/** Server source projection only. Neither supplied context nor these pins grants
 * registration, sporting approval, calculation or financial authority. */
export function readEventPrizeActivationSourceV1(v:unknown,actorId:string,tournamentId:string):EventPrizeActivationSourceV1|null{
 try{
  if(!isEventPrizeResponseValueV1(v)||!exact(v,['kind','actorId','tournamentId','workspace','activationSource','reviews','registrationOnly','accountingAllowed','playoffStartAllowed','moneyMoved'])||v.kind!=='event-prize-activation-source-v1'||v.actorId!==actorId||v.tournamentId!==tournamentId||v.registrationOnly!==true||v.accountingAllowed!==false||v.playoffStartAllowed!==false||v.moneyMoved!==false)return null;
  const w=readEventPrizeWorkspaceV1(v.workspace,actorId,tournamentId),s=v.activationSource;
  if(!w||w.settings.state!=='present'||w.prizes.state!=='present'||w.events.length<1||!object(s)||s.status!=='source_available'||s.kind!=='event-settings-activation-source-v4'||s.actorId!==actorId||s.tournamentId!==tournamentId||s.setupRevisionId!==w.base.setupRevisionId||s.setupVersion!==w.base.setupVersion||s.settingsSnapshotId!==w.settings.id||!hash(s.settingsDigest)||!hash(s.associationHash)||canonical(s.snapshot)!==canonical(w.settings.snapshot)||!Array.isArray(s.configuredRows)||s.configuredRows.length!==w.events.length||!Array.isArray(s.legacyDeclarationRequiredRows)||s.legacyDeclarationRequiredRows.length!==0||!Array.isArray(s.legacyDeclarationPins)||s.legacyDeclarationPins.length!==0||s.legacyDeclarationsCurrent!==true||s.activationAllowed!==false||s.moneyMoved!==false||!Array.isArray(v.reviews)||v.reviews.length!==w.events.length)return null;
  const seen=new Set<string>();
  for(const e of w.events){
   const setting=w.settings.snapshot.settings.find(x=>x.eventClientRowId===e.eventClientRowId),plan=w.prizes.snapshot.plans.find(x=>x.eventClientRowId===e.eventClientRowId);
   const rows=s.configuredRows.filter(x=>object(x)&&x.eventClientRowId===e.eventClientRowId);
   const reviews=v.reviews.filter(x=>object(x)&&x.eventClientRowId===e.eventClientRowId);
   if(setting?.mode!=='configured'||plan?.mode!=='proposed_v2'||rows.length!==1||reviews.length!==1)return null;
   const row=rows[0],r=reviews[0];
   if(!exact(row,['eventClientRowId','setupEventVersionId','eventKind','draft'])||!uuid(row.setupEventVersionId)||row.eventKind!==e.eventKind||canonical(row.draft)!==canonical(setting.draft)||!exact(r,['eventClientRowId','reviewId','draftDigest','reviewedDraft','current','context'])||!uuid(r.reviewId)||!hash(r.draftDigest)||r.current!==true||seen.has(r.eventClientRowId as string)||canonical(r.reviewedDraft)!==canonical(setting.draft)||!object(r.context)||r.context.eventKind!==e.eventKind||r.context.originalEntrants!==null)return null;
   seen.add(r.eventClientRowId as string);
   const series=resolveEventSeriesDraftV1(setting.draft);if(!series||!assessSeriesForSetupReviewV2(series,r.context).setupReviewEligible)return null;
   if((plan.draft.method==='graduated'&&!validIncrementFactorDraftV1(plan.draft.incrementFactorText))||(plan.draft.method==='winner-multiplier'&&!validIncrementFactorDraftV1(plan.draft.winnerMultiplierText)))return null;
  }
  return freeze(structuredClone(v) as EventPrizeActivationSourceV1);
 }catch{return null;}
}
export function buildEventPrizeActivationV1(source:EventPrizeActivationSourceV1,operationId:string):EventPrizeActivationV1|null{
 if(!isEventPrizeResponseValueV1(source)||!object(source))return null;
 const s=readEventPrizeActivationSourceV1(source,source.actorId,source.tournamentId);if(!s||s.workspace.prizes.state!=='present'||s.workspace.settings.state!=='present')return null;
 const v={kind:'event-prize-activation-v1',activation:{kind:'event-settings-activation-v4',request:{setupRevisionId:s.workspace.base.setupRevisionId,expectedVersion:s.workspace.base.setupVersion,confirmed:true,idempotencyKey:operationId},associationHash:s.activationSource.associationHash,settingsSnapshotId:s.workspace.settings.id,settingsDigest:s.activationSource.settingsDigest,settingsPins:s.reviews.map(r=>({eventClientRowId:r.eventClientRowId,reviewId:r.reviewId,draftDigest:r.draftDigest}))},prizeSnapshotId:s.workspace.prizes.snapshot.prizeSnapshotId,prizeDigest:s.workspace.prizes.snapshot.prizeDigest,confirmedContext:true};
 return isEventPrizeActivationV1(v)?freeze(v):null;
}
export type EventPrizeActivationRecordV1={kind:'event-prize-activation-record-v1';actorId:string;tournamentId:string;operationId:string;requestText:string;requestHash:string;envelope:EventPrizeActivationV1;preparation:Record<string,unknown>;activation:Record<string,unknown>|null;registrationOnly:true;accountingAllowed:false;playoffStartAllowed:false;moneyMoved:false};
/** Full retained outer request and nested receipts are required for recovery.
 * The caller compares this result before changing its own pending state. */
export function readEventPrizeActivationRecordV1(v:unknown,actorId:string,tournamentId:string,requestText:string,expectedRequestHash:string):EventPrizeActivationRecordV1|null{
 try{
  const e=parseEventPrizeActivationV1(requestText);
  if(!e||!uuid(actorId)||!uuid(tournamentId)||!hash(expectedRequestHash)||!isEventPrizeResponseValueV1(v)||!exact(v,['kind','actorId','tournamentId','operationId','requestText','requestHash','envelope','preparation','activation','registrationOnly','accountingAllowed','playoffStartAllowed','moneyMoved'])||v.kind!=='event-prize-activation-record-v1'||v.actorId!==actorId||v.tournamentId!==tournamentId||v.operationId!==e.activation.request.idempotencyKey||v.requestText!==requestText||v.requestHash!==expectedRequestHash||serializeEventPrizeActivationV1(v.envelope)!==requestText||v.registrationOnly!==true||v.accountingAllowed!==false||v.playoffStartAllowed!==false||v.moneyMoved!==false||!object(v.preparation))return null;
  const inner={kind:'event-settings-activation-intent-v1',request:e.activation.request,associationHash:e.activation.associationHash,settingsSnapshotId:e.activation.settingsSnapshotId,settingsDigest:e.activation.settingsDigest,settingsPins:e.activation.settingsPins,confirmedContext:true};
  const p=v.preparation;if(p.actorId!==actorId||p.tournamentId!==tournamentId||p.operationId!==v.operationId||canonical(p.request)!==canonical(inner)||!['activation_intent_prepared','rejected'].includes(p.status as string)||p.activationAllowed!==false||p.operationalActivationPerformed!==false||p.officialApprovalClaimed!==false||p.moneyMoved!==false)return null;
  if(v.activation!==null){const a=v.activation;if(!object(a)||a.actorId!==actorId||a.tournamentId!==tournamentId||a.operationId!==v.operationId||canonical(a.request)!==canonical(inner)||!['event_settings_operationally_activated','rejected','unavailable'].includes(a.status as string)||a.moneyMoved!==false||a.officialApprovalClaimed!==false)return null;if(a.status==='event_settings_operationally_activated'&&(p.status!=='activation_intent_prepared'||a.operationalActivationPerformed!==true||!isLinkedSetupActivationResult(a.result,e.activation.request,e.activation.associationHash)||a.settingsSnapshotId!==e.activation.settingsSnapshotId||a.setupRevisionId!==e.activation.request.setupRevisionId||a.setupVersion!==e.activation.request.expectedVersion||!Number.isSafeInteger(a.activationCount)||a.activationCount!==a.result.result.eventCount||a.bindingCount!==e.activation.settingsPins.length))return null;}
  return freeze(structuredClone(v) as EventPrizeActivationRecordV1);
 }catch{return null;}
}
