import {isUuid} from './validation.ts';
import {isEventSettingsSetupV3,serializeEventSettingsSetupV3,type EventSettingsSetupEnvelopeV3} from './event-settings-setup-v3.ts';
import {isLinkedSetupSaveResult,type LinkedSetupSaveResult} from './setup-event-links.ts';
import type {SetupCustomPayoutsBaseV2} from './custom-payout-setup-v2.ts';

const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const exact=(value:unknown,keys:readonly string[]):value is Record<string,unknown>=>object(value)&&Reflect.ownKeys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const uuid=(value:unknown):value is string=>isUuid(value)&&value===value.toLowerCase();
const hash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const clone=<T>(value:T):T=>structuredClone(value);
export const eventSettingsCustomPoolTransactionEnabledV4=()=>false;

export type EventSettingsCustomPoolDraftSavedV4={
 status:'event_settings_custom_pool_draft_saved_v4';fullRequestHash:string;envelope:EventSettingsSetupEnvelopeV3;
 linked:LinkedSetupSaveResult;settingsSnapshotId:string;activationAllowed:false;moneyMoved:false;
};
export type EventSettingsCustomPoolOutcomeV4=EventSettingsCustomPoolDraftSavedV4
 |{status:'rejected';code:string}|{status:'retry_exact';code:string};

export function isEventSettingsCustomPoolDraftSavedV4(value:unknown,envelope:unknown,base:unknown):value is EventSettingsCustomPoolDraftSavedV4{
 return isEventSettingsSetupV3(envelope,base)&&exact(value,['status','fullRequestHash','envelope','linked','settingsSnapshotId','activationAllowed','moneyMoved'])&&value.status==='event_settings_custom_pool_draft_saved_v4'&&hash(value.fullRequestHash)&&uuid(value.settingsSnapshotId)&&value.activationAllowed===false&&value.moneyMoved===false&&serializeEventSettingsSetupV3(value.envelope,base)===serializeEventSettingsSetupV3(envelope,base)&&isLinkedSetupSaveResult(value.linked,{kind:'setup-event-links-v1',request:envelope.setup.request,choices:envelope.setup.choices});
}

const rejectedCodes=new Set(['feature_unavailable','authentication_required','tournament_unavailable','not_director','idempotency_conflict','invalid_request','invalid_settings_coverage','invalid_settings','stale_version','core_unavailable','custom_side_source_mismatch','unsupported_scope','source_changed']);
const retryCodes=new Set(['isolation_not_supported','operation_busy','source_busy']);
function outcome(value:unknown,envelope:EventSettingsSetupEnvelopeV3,base:SetupCustomPayoutsBaseV2):value is EventSettingsCustomPoolOutcomeV4{
 if(isEventSettingsCustomPoolDraftSavedV4(value,envelope,base))return true;
 return exact(value,['status','code'])&&typeof value.code==='string'&&((value.status==='rejected'&&rejectedCodes.has(value.code))||(value.status==='retry_exact'&&retryCodes.has(value.code)));
}

export type EventSettingsCustomPoolProviderWriteV4={actorId:string;tid:string;operationId:string;envelope:EventSettingsSetupEnvelopeV3;outcome:EventSettingsCustomPoolOutcomeV4};
export function readEventSettingsCustomPoolProviderWriteV4(value:unknown,expected:{actorId:string;tournamentId:string;envelope:EventSettingsSetupEnvelopeV3;base:SetupCustomPayoutsBaseV2}):EventSettingsCustomPoolProviderWriteV4|null{
 if(!uuid(expected.actorId)||!uuid(expected.tournamentId)||!isEventSettingsSetupV3(expected.envelope,expected.base)||!exact(value,['actorId','tid','operationId','envelope','outcome'])||value.actorId!==expected.actorId||value.tid!==expected.tournamentId||value.operationId!==expected.envelope.setup.request.idempotencyKey||!uuid(value.operationId)||serializeEventSettingsSetupV3(value.envelope,expected.base)!==serializeEventSettingsSetupV3(expected.envelope,expected.base)||!outcome(value.outcome,expected.envelope,expected.base))return null;
 return clone(value) as EventSettingsCustomPoolProviderWriteV4;
}
