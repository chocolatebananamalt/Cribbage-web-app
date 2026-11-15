import { isUuid } from './validation.ts';
import { isDirectorPrizeScheduleV3, type DirectorPrizeScheduleV3 } from '../results/prize-schedule.ts';
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const digest=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const version=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>=0&&Number(v)<=256;
export type EventPrizeDeclarationRequest={expectedVersion:number;expectedSettingsFingerprint:string;schedule:DirectorPrizeScheduleV3;reason:string;reviewed:true};
export function isEventPrizeDeclarationRequest(v:unknown):v is EventPrizeDeclarationRequest {
 return record(v)&&exact(v,['expectedVersion','expectedSettingsFingerprint','schedule','reason','reviewed'])&&version(v.expectedVersion)&&digest(v.expectedSettingsFingerprint)&&isDirectorPrizeScheduleV3(v.schedule)&&v.reviewed===true&&typeof v.reason==='string'&&v.reason===v.reason.trim()&&v.reason.length>0&&v.reason.length<=500&&!/[\u0000-\u001f\u007f]/.test(v.reason);
}
export type EventPrizeDeclarationWorkspace={tournamentId:string;clientRowId:string;currentVersion:number;supported:boolean;settingsCurrent:boolean;settings:Record<string,unknown>;settingsFingerprint:string;schedule:DirectorPrizeScheduleV3|null;scheduleId:string|null;accountingReady:false;limitation:string};
export function isEventPrizeDeclarationWorkspace(v:unknown,tid:string,row:string):v is EventPrizeDeclarationWorkspace {
 return record(v)&&exact(v,['tournamentId','clientRowId','currentVersion','supported','settingsCurrent','settings','settingsFingerprint','schedule','scheduleId','accountingReady','limitation'])&&v.tournamentId===tid&&v.clientRowId===row&&isUuid(tid)&&isUuid(row)&&version(v.currentVersion)&&typeof v.supported==='boolean'&&typeof v.settingsCurrent==='boolean'&&record(v.settings)&&digest(v.settingsFingerprint)&&v.accountingReady===false&&typeof v.limitation==='string'&&v.limitation.length>0&&(v.currentVersion===0?v.schedule===null&&v.scheduleId===null&&v.settingsCurrent===false:isDirectorPrizeScheduleV3(v.schedule)&&isUuid(v.scheduleId));
}
export function isEventPrizeDeclarationSaved(v:unknown,tid:string,row:string,request:EventPrizeDeclarationRequest):v is {status:'event_prize_declaration_saved_v2';tournamentId:string;clientRowId:string;scheduleId:string;version:number;accountingReady:false} {
 return record(v)&&exact(v,['status','tournamentId','clientRowId','scheduleId','version','accountingReady'])&&v.status==='event_prize_declaration_saved_v2'&&v.tournamentId===tid&&v.clientRowId===row&&isUuid(v.scheduleId)&&v.version===request.expectedVersion+1&&v.accountingReady===false;
}
const rejectionCodes=new Set(['invalid_request','tournament_unavailable','not_director','idempotency_conflict','unsupported_event','stale_settings','stale_version','declaration_locked']);
export function isEventPrizeDeclarationRejected(v:unknown):v is {status:'rejected';code:string}{return record(v)&&exact(v,['status','code'])&&v.status==='rejected'&&typeof v.code==='string'&&rejectionCodes.has(v.code);}
