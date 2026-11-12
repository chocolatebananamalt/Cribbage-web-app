import type {SetupEvent,SetupSaveRequest} from './api/setup.ts';
import {isRetainedSetupSaveRequest} from './api/setup.ts';
import type {SetupEventLinkChoice} from './api/setup-event-links.ts';
import type {EventSettingsChoiceV3,EventSettingsSetupEnvelopeV3} from './api/event-settings-setup-v3.ts';
import {readEventPrizeWorkspaceV1,buildEventPrizeEnvelopeV1,type EventPrizeWorkspaceV1} from './api/event-prize-workspace-v1.ts';
import {isEventPrizeResponseValueV1,serializeEventPrizeSettingsV1,isEventPrizeSettingsSavedV1,readEventPrizeAcceptedReplyV1,readEventPrizeRecordedRejectionV1,eventPrizeReplyBindingMatchesV1,type EventPrizePlanChoiceV1,type EventPrizeSettingsSavedV1} from './api/event-prize-settings-v1.ts';
import {newEventPlayoffParametersDraftV1} from './playoffs/event-playoff-parameters-v1.ts';
import {newPlayoffPrizePlanDraftV2} from './playoffs/playoff-prize-plan-v2.ts';
import {canonicalEventSettingsClientV3 as canonical} from './setup-event-settings-recovery-v3.ts';
import {serializeEventPrizeActivationV1,type EventPrizeActivationV1} from './api/event-prize-activation-v1.ts';
import type {SetupActivationRequest} from './api/setup-activation.ts';

export type PendingEventPrizeSetupV1={kind:'tournament-event-prize-v1';actorId:string;request:SetupSaveRequest;envelope:NonNullable<ReturnType<typeof buildEventPrizeEnvelopeV1>>;stage:'details'|'all'};
export type PendingPrizeActivationV1={kind:'tournament-prize-activation-v1';actorId:string;tournamentId:string;envelope:EventPrizeActivationV1;request:SetupActivationRequest};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
export function serializePendingPrizeActivationV1(v:unknown):string|null{
 try{if(!isEventPrizeResponseValueV1(v)||!object(v)||Object.keys(v).sort().join(',')!=='actorId,envelope,kind,request,tournamentId'||v.kind!=='tournament-prize-activation-v1'||!uuid(v.actorId)||!uuid(v.tournamentId)||!serializeEventPrizeActivationV1(v.envelope)||!object(v.envelope)||!object(v.envelope.activation)||canonical(v.request)!==canonical(v.envelope.activation.request))return null;return canonical(v);}catch{return null;}
}
export function parsePendingPrizeActivationV1(raw:unknown,actorId:string,tournamentId:string):PendingPrizeActivationV1|null{
 try{if(typeof raw!=='string'||new TextEncoder().encode(raw).length>1_100_000||!uuid(actorId)||!uuid(tournamentId))return null;const v=JSON.parse(raw);return serializePendingPrizeActivationV1(v)===raw&&v.actorId===actorId&&v.tournamentId===tournamentId?v:null;}catch{return null;}
}
export function serializePendingEventPrizeSetupV1(v:unknown):string|null{
 try{
  if(!isEventPrizeResponseValueV1(v)||!object(v)||Object.keys(v).sort().join(',')!=='actorId,envelope,kind,request,stage'||v.kind!=='tournament-event-prize-v1'||!uuid(v.actorId)||!['details','all'].includes(v.stage as string)||!object(v.envelope)||!object(v.envelope.setup)||!object(v.envelope.setup.setup))return null;
  if(serializeEventPrizeSettingsV1(v.envelope,v.envelope.setup.setup.base)===null||canonical(v.request)!==canonical(v.envelope.setup.setup.request))return null;
  return canonical(v);
 }catch{return null;}
}
export function parsePendingEventPrizeSetupV1(raw:unknown,actorId:string,tournamentId:string):PendingEventPrizeSetupV1|null{
 try{if(typeof raw!=='string'||new TextEncoder().encode(raw).byteLength>8_000_000||!uuid(actorId)||!uuid(tournamentId))return null;const v=JSON.parse(raw);return serializePendingEventPrizeSetupV1(v)===raw&&v.actorId===actorId&&v.envelope.setup.setup.base.tournamentId===tournamentId?v:null;}catch{return null;}
}
export function prizeWorkspaceCoversSetupV1(value:unknown,actorId:string,tournamentId:string,revisionId:string|null,version:number,events:SetupEvent[]):value is EventPrizeWorkspaceV1{
 const w=readEventPrizeWorkspaceV1(value,actorId,tournamentId);if(!w||w.base.setupRevisionId!==revisionId||w.base.setupVersion!==version)return false;
 const rows=events.filter(e=>e.eventKind==='main'||e.eventKind==='consolation');return w.events.length===rows.length&&rows.every(e=>w.events.some(r=>r.eventClientRowId===e.clientRowId&&r.eventKind===e.eventKind));
}
export function choicesFromPrizeWorkspaceV1(w:EventPrizeWorkspaceV1){
 const settings:Record<string,EventSettingsChoiceV3>={},prizes:Record<string,EventPrizePlanChoiceV1>={};
 for(const e of w.events){const s=w.settings.snapshot?.settings.find(s=>s.eventClientRowId===e.eventClientRowId),p=w.prizes.snapshot?.plans.find(p=>p.eventClientRowId===e.eventClientRowId);
  settings[e.eventClientRowId]=s?.mode==='configured'?structuredClone(s):{eventClientRowId:e.eventClientRowId,mode:'preserve_historical'};
  prizes[e.eventClientRowId]=p?.mode==='proposed_v2'?{eventClientRowId:e.eventClientRowId,mode:'proposed_v2',draft:structuredClone(p.draft)}:{eventClientRowId:e.eventClientRowId,mode:'preserve_historical'};
 }return{settings,prizes};
}
export function prizeChoicesForPayloadV1(events:SetupEvent[],retained:Record<string,EventPrizePlanChoiceV1>):EventPrizePlanChoiceV1[]{return events.filter(e=>e.eventKind==='main'||e.eventKind==='consolation').map(e=>structuredClone(retained[e.clientRowId]??{eventClientRowId:e.clientRowId,mode:'proposed_v2',draft:newPlayoffPrizePlanDraftV2()}));}
export function buildPendingEventPrizeSetupV1(actorId:string,w:EventPrizeWorkspaceV1,request:SetupSaveRequest,links:SetupEventLinkChoice[],settings:Record<string,EventSettingsChoiceV3>,prizes:Record<string,EventPrizePlanChoiceV1>,stage:'details'|'all',operationId:string):PendingEventPrizeSetupV1|null{
 if(!isEventPrizeResponseValueV1({w,request,links,settings,prizes})||!object(w)||!isRetainedSetupSaveRequest(request))return null;
 const workspace=readEventPrizeWorkspaceV1(w,actorId,w.tournamentId);if(!workspace)return null;
 const rows=request.payload.events.filter(e=>e.eventKind==='main'||e.eventKind==='consolation');
 if(workspace.events.some(old=>rows.some(e=>e.clientRowId===old.eventClientRowId&&(e.eventKind!==old.eventKind||!Object.hasOwn(settings,e.clientRowId)||!Object.hasOwn(prizes,e.clientRowId)))))return null;
 const setup:EventSettingsSetupEnvelopeV3={kind:'event-settings-setup-v3',setup:{kind:'setup-custom-payouts-v2',base:structuredClone(w.base),request,choices:links,customPayouts:[]},eventSettings:rows.map(e=>structuredClone(settings[e.clientRowId]??{eventClientRowId:e.clientRowId,mode:'configured',draft:newEventPlayoffParametersDraftV1(e.eventKind as 'main'|'consolation')}))};
 const envelope=buildEventPrizeEnvelopeV1(workspace,setup,prizeChoicesForPayloadV1(rows,prizes),operationId);if(!envelope)return null;
 const pending:PendingEventPrizeSetupV1={kind:'tournament-event-prize-v1',actorId,request,envelope,stage};return serializePendingEventPrizeSetupV1(pending)?pending:null;
}
export type EventPrizePendingResolutionV1={kind:'event-prize-pending-resolution-v1';actorId:string;tournamentId:string;operationId:string;requestHash:string;currentRevisionId:string|null;currentVersion:number;currentSourceDigest:string;outcome:'unapplied_stale'|'confirmed_superseded'|'confirmed_rejected';automaticCleanupAllowed:false};
/** Explicit resolution needs owned history and a fresh source. No-record or
 * accepted history additionally needs a newer version; a complete journaled
 * rejection proves rollback even at the original version. Unknown/foreign
 * responses and attempt-only rejections always stay retained. */
export function assessEventPrizePendingResolutionV1(p:PendingEventPrizeSetupV1,reply:unknown,fresh:unknown,hash:string):EventPrizePendingResolutionV1|null{
 try{
  if(!serializePendingEventPrizeSetupV1(p))return null;const w=readEventPrizeWorkspaceV1(fresh,p.actorId,p.envelope.setup.setup.base.tournamentId);if(!w)return null;
  const accepted=readEventPrizeAcceptedReplyV1(reply,p.envelope,hash,p.actorId);
  const rejected=readEventPrizeRecordedRejectionV1(reply,p.envelope,hash,p.actorId);
  const absent=isEventPrizeResponseValueV1(reply)&&object(reply)&&Object.keys(reply).sort().join(',')==='binding,pendingCleared,status,writeAuthorized'&&reply.status==='not_found'&&reply.pendingCleared===false&&reply.writeAuthorized===false&&eventPrizeReplyBindingMatchesV1(reply.binding,p.envelope,hash,p.actorId);
  if(!(rejected?w.base.setupVersion>=p.request.expectedVersion&&(w.base.setupVersion!==p.request.expectedVersion||w.base.setupRevisionId===p.envelope.setup.setup.base.setupRevisionId):w.base.setupRevisionId&&(accepted?w.base.setupVersion>accepted.ack.snapshot.setupVersion:absent&&w.base.setupVersion>p.request.expectedVersion)))return null;
  return{kind:'event-prize-pending-resolution-v1',actorId:p.actorId,tournamentId:w.tournamentId,operationId:p.envelope.operationId,requestHash:hash,currentRevisionId:w.base.setupRevisionId,currentVersion:w.base.setupVersion,currentSourceDigest:w.base.sourceDigest,outcome:rejected?'confirmed_rejected':accepted?'confirmed_superseded':'unapplied_stale',automaticCleanupAllowed:false};
 }catch{return null;}
}
/** An accepted response alone cannot clear a pending request. The current
 * authoritative workspace must still be the exact accepted settings/prize head. */
export function eventPrizeReadbackMatchesV1(value:unknown,pending:PendingEventPrizeSetupV1,ack:unknown,prior:unknown,hash:string):ack is EventPrizeSettingsSavedV1{
 const e=pending.envelope;if(!isEventPrizeSettingsSavedV1(ack,e,e.setup.setup.base,prior,hash))return false;
 const w=readEventPrizeWorkspaceV1(value,pending.actorId,e.setup.setup.base.tournamentId);
 return !!w&&w.base.setupRevisionId===ack.snapshot.setupRevisionId&&w.base.setupVersion===ack.snapshot.setupVersion&&w.settings.id===ack.snapshot.settingsSnapshotId&&w.settings.digest===ack.snapshot.settingsDigest&&w.prizes.state==='present'&&canonical(w.prizes.snapshot)===canonical(ack.snapshot);
}
