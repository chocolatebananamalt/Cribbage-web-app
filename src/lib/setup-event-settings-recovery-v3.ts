import type { SetupSaveRequest, SetupEvent } from './api/setup.ts';
import { isSetupEventLinksWorkspace, type SetupEventLinkChoice } from './api/setup-event-links.ts';
import { linkedSnapshotMatches } from './setup-linked-recovery.ts';
import type { EventSettingsWorkspaceV3 } from './api/event-settings-handlers-v3.ts';
import { isEventSettingsWorkspaceV3 } from './api/event-settings-handlers-v3.ts';
import { isEventSettingsSetupV3, isEventSettingsDraftSavedV3, serializeEventSettingsSetupV3, type EventSettingsChoiceV3, type EventSettingsDraftSavedV3, type EventSettingsSetupEnvelopeV3 } from './api/event-settings-setup-v3.ts';
import { newEventPlayoffParametersDraftV1, resolveEventPlayoffParametersDraftV1 } from './playoffs/event-playoff-parameters-v1.ts';
export type PendingEventSettingsSetupV3 = { kind: 'tournament-event-settings-v3'; actorId: string; request: SetupSaveRequest; envelope: EventSettingsSetupEnvelopeV3; stage: 'details' | 'all' };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
export const canonicalEventSettingsClientV3 = (v: unknown): string => JSON.stringify(v, (_k,x) => object(x) ? Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])) : x);
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
export function serializePendingEventSettingsSetupV3(p: unknown): string | null {
 try { if (!object(p) || Object.keys(p).sort().join(',') !== 'actorId,envelope,kind,request,stage' || p.kind !== 'tournament-event-settings-v3' || !uuid(p.actorId) || !['details','all'].includes(p.stage as string) || !object(p.envelope) || !object(p.envelope.setup) || !isEventSettingsSetupV3(p.envelope,p.envelope.setup.base) || canonicalEventSettingsClientV3(p.request)!==canonicalEventSettingsClientV3(p.envelope.setup.request))return null;
 const raw=canonicalEventSettingsClientV3(p);return new TextEncoder().encode(raw).byteLength<=1000000?raw:null; }catch{return null;}
}
export function parsePendingEventSettingsSetupV3(raw: unknown, actorId: string, tournamentId: string): PendingEventSettingsSetupV3 | null {
 try { if(typeof raw!=='string'||new TextEncoder().encode(raw).byteLength>1000000||!uuid(actorId)||!uuid(tournamentId))return null;const p=JSON.parse(raw);return serializePendingEventSettingsSetupV3(p)===raw&&p.actorId===actorId&&p.envelope.setup.base.tournamentId===tournamentId?p:null;}catch{return null;}
}
export function eventSettingsChoicesForPayloadV3(events:SetupEvent[], retained:Record<string,EventSettingsChoiceV3>):EventSettingsChoiceV3[]{
 return events.filter(e=>e.eventKind==='main'||e.eventKind==='consolation').map(e=>structuredClone(retained[e.clientRowId]??{eventClientRowId:e.clientRowId,mode:'configured',draft:newEventPlayoffParametersDraftV1(e.eventKind as 'main'|'consolation')}));
}
export function eventSettingsWorkspaceCoversSetupV3(v:unknown,actorId:string,tid:string,revisionId:string|null,version:number,events:SetupEvent[]):v is EventSettingsWorkspaceV3{
 if(!isEventSettingsWorkspaceV3(v,actorId,tid)||v.base.setupRevisionId!==revisionId||v.base.setupVersion!==version)return false;
 const rows=events.filter(e=>e.eventKind==='main'||e.eventKind==='consolation'),settings=v.currentSnapshot?.settings??[];
 return settings.length===rows.length&&settings.every(s=>rows.some(e=>e.clientRowId===s.eventClientRowId));
}
export function choicesFromEventSettingsWorkspaceV3(w:EventSettingsWorkspaceV3):Record<string,EventSettingsChoiceV3>{return Object.fromEntries((w.currentSnapshot?.settings??[]).map(s=>[s.eventClientRowId,s.mode==='configured'?structuredClone(s):{eventClientRowId:s.eventClientRowId,mode:'preserve_historical'}]));}
export function buildPendingEventSettingsSetupV3(actorId:string,workspace:EventSettingsWorkspaceV3,request:SetupSaveRequest,choices:SetupEventLinkChoice[],settings:Record<string,EventSettingsChoiceV3>,stage:'details'|'all'):PendingEventSettingsSetupV3|null{
 if(!isEventSettingsWorkspaceV3(workspace,actorId,workspace.base.tournamentId))return null;
 // Defaults are for genuinely new rows only, never a missing saved configuration.
 if((workspace.currentSnapshot?.settings??[]).some(s=>request.payload.events.some(e=>e.clientRowId===s.eventClientRowId)&&!Object.hasOwn(settings,s.eventClientRowId)))return null;
 const envelope:EventSettingsSetupEnvelopeV3={kind:'event-settings-setup-v3',setup:{kind:'setup-custom-payouts-v2',base:structuredClone(workspace.base),request,choices,customPayouts:[]},eventSettings:eventSettingsChoicesForPayloadV3(request.payload.events,settings)};
 // A structural draft codec permits incomplete typing, but the Save action must
 // not advertise unsupported paid-ratio semantics or an incomplete series.
 if(envelope.eventSettings.some(s=>s.mode==='configured'&&(!resolveEventPlayoffParametersDraftV1(s.draft)||s.draft.payoutMode==='one-in')))return null;
 const pending:PendingEventSettingsSetupV3={kind:'tournament-event-settings-v3',actorId,request,envelope,stage};return serializePendingEventSettingsSetupV3(pending)?pending:null;
}
/** Cleanup proof requires a full ACK and current settings at that exact accepted
 * setup version; a newer or merely successful HTTP response is insufficient. */
export function eventSettingsReadbackMatchesV3(w:unknown,p:PendingEventSettingsSetupV3,ack:unknown,linkedWorkspace:unknown):ack is EventSettingsDraftSavedV3{
 if(!isEventSettingsDraftSavedV3(ack,p.envelope,p.envelope.setup.base)||!isSetupEventLinksWorkspace(linkedWorkspace)||!linkedSnapshotMatches(linkedWorkspace.current,ack.linked.links)||!eventSettingsWorkspaceCoversSetupV3(w,p.actorId,p.envelope.setup.base.tournamentId,ack.linked.result.revisionId,ack.linked.result.version,p.request.payload.events)||!w.currentSnapshot)return false;
 return w.currentSnapshot.settings.every(s=>{const choice=p.envelope.eventSettings.find(c=>c.eventClientRowId===s.eventClientRowId);return choice?.mode==='configured'?s.mode==='configured'&&canonicalEventSettingsClientV3(s.draft)===canonicalEventSettingsClientV3(choice.draft):choice?.mode==='preserve_historical'&&s.mode==='legacy_checks_required';});
}
export const exactEventSettingsRequestV3=(a:EventSettingsSetupEnvelopeV3,b:EventSettingsSetupEnvelopeV3)=>serializeEventSettingsSetupV3(a,a.setup.base)===serializeEventSettingsSetupV3(b,b.setup.base);

/** The configured path has no reviewed operational activation adapter yet. */
export function eventSettingsActivationBlockedV3(v3Enabled:boolean,legacyApplies:boolean,legacyBlocked:boolean):boolean{return v3Enabled||(legacyApplies&&legacyBlocked);}
