import{templatePoolConfigurationValidV1,type TemplatePoolIntentV1,type TemplateSavedPoolsV1}from'./tournament-template-pools-v1.ts';
import {isRetainedSetupSaveRequest,type SetupPayload} from './api/setup.ts';
import {validateSetupEventLinks,type SetupEventLinkChoice} from './api/setup-event-links.ts';
import {isEventPrizeWireValueV1,type EventPrizePlanChoiceV1} from './api/event-prize-settings-v1.ts';
import type {EventSettingsChoiceV3} from './api/event-settings-setup-v3.ts';
import {isEventPlayoffParametersDraftV1} from './playoffs/event-playoff-parameters-v1.ts';
import {isPlayoffPrizePlanDraftV2} from './playoffs/playoff-prize-plan-v2.ts';
import {isUuid} from './api/validation.ts';
import {integratedTestUiEnabled} from './integrated-test-target.ts';
const placeholder='a0000000-0000-4000-8000-000000000001';
export const tournamentTemplatesEnabledV1=()=>integratedTestUiEnabled();
export type TournamentTemplateV1={kind:'tournament-template-v1';name:string;payload:Omit<SetupPayload,'officials'>;links:SetupEventLinkChoice[];settings:EventSettingsChoiceV3[];prizes:EventPrizePlanChoiceV1[];poolIntents?:TemplatePoolIntentV1[]};
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join()===keys.sort().join();
export function readTournamentTemplateV1(value:unknown):TournamentTemplateV1|null{try{
 if(!isEventPrizeWireValueV1(value)||!(exact(value,['kind','name','payload','links','settings','prizes'])||exact(value,['kind','name','payload','links','settings','prizes','poolIntents']))||value.kind!=='tournament-template-v1'||typeof value.name!=='string'||!value.name.trim()||value.name.length>200||!value.payload||typeof value.payload!=='object'||Object.hasOwn(value.payload,'officials'))return null;
 const payload={...value.payload,officials:[{profileId:placeholder,role:'director'}]};
 if(!isRetainedSetupSaveRequest({expectedVersion:0,idempotencyKey:placeholder,payload}))return null;
 const events=(payload as SetupPayload).events,links=validateSetupEventLinks(events,value.links);if(!links.valid||!links.complete||events.length===0||events[0].eventKind!=='main'||events.filter(e=>e.eventKind==='main').length!==1||events.some(e=>e.eventKind==='custom'))return null;
 // Pool policy intents have an independent source not carried by SetupPayload. Hold
 // those templates rather than silently copying a legacy placeholder or losing Custom N.
 if(value.poolIntents!==undefined){if(!templatePoolConfigurationValidV1(payload as SetupPayload,value.links as SetupEventLinkChoice[],value.poolIntents))return null;}else if(events.some(e=>e.qPools.length||e.sidePools.length||e.eventKind==='satellite'&&e.payoutNote!==''&&e.payoutNote!=='Top 4'))return null;
 const choices=value.links as SetupEventLinkChoice[];if(choices.length!==1||choices[0].consolationClientRowIds.length>1)return null;
 const child=choices[0].consolationClientRowIds[0];if(child&&events[1]?.clientRowId.toLowerCase()!==child.toLowerCase())return null;if(events.slice(child?2:1).some(e=>e.eventKind!=='satellite'))return null;
 const rows=events.filter(e=>e.eventKind==='main'||e.eventKind==='consolation');
 for(const [key,mode,valid]of [['settings','configured',isEventPlayoffParametersDraftV1],['prizes','proposed_v2',isPlayoffPrizePlanDraftV2]]as const){const a=value[key];if(!Array.isArray(a)||a.length!==rows.length||rows.some(e=>a.filter(x=>exact(x,['eventClientRowId','mode','draft'])&&x.eventClientRowId===e.clientRowId&&x.mode===mode&&valid(x.draft)).length!==1))return null;}
 return structuredClone(value)as TournamentTemplateV1;
 }catch{return null;}}
export function makeTournamentTemplateV1(name:string,payload:SetupPayload,links:SetupEventLinkChoice[],settings:EventSettingsChoiceV3[],prizes:EventPrizePlanChoiceV1[],saved?:TemplateSavedPoolsV1){if(saved&&JSON.stringify(saved.sourcePayload)!==JSON.stringify(payload))return null;const copy=structuredClone(saved?.payload??payload);const{officials:ignored,...portable}=copy;void ignored;return readTournamentTemplateV1({kind:'tournament-template-v1',name,payload:portable,links,settings,prizes,...(saved?{poolIntents:saved.intents}:{})});}
/** A template contains settings only, never identities, review authority or results. */
export function instantiateTournamentTemplateV1(template:unknown,target:SetupPayload,makeId:()=>string){try{
 const t=readTournamentTemplateV1(template);if(!t||target.events.length!==0||!target.tournamentName.trim()||!target.startsAt)return null;
 const ids=new Map<string,string>(),used=new Set(t.payload.events.map(e=>e.clientRowId.toLowerCase()));for(const e of t.payload.events){const id=makeId();if(!isUuid(id)||used.has(id.toLowerCase()))return null;used.add(id.toLowerCase());ids.set(e.clientRowId.toLowerCase(),id);}
 const day=(s:string)=>{const n=Date.parse(s.slice(0,10)+'T00:00:00Z');return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===s.slice(0,10)?n:NaN;},delta=day(target.startsAt)-day(t.payload.startsAt);if(!Number.isFinite(delta))return null;
 const shift=(s:string)=>new Date(day(s)+delta).toISOString().slice(0,10)+s.slice(10);
 const payload:SetupPayload={...structuredClone(t.payload),tournamentName:target.tournamentName,officials:structuredClone(target.officials),startsAt:shift(t.payload.startsAt),endsAt:shift(t.payload.endsAt),events:t.payload.events.map(e=>({...structuredClone(e),clientRowId:ids.get(e.clientRowId.toLowerCase())!,startsAt:shift(e.startsAt)}))};
 const remap=<T extends{eventClientRowId:string}>(a:T[])=>a.map(x=>({...structuredClone(x),eventClientRowId:ids.get(x.eventClientRowId.toLowerCase())!}));
 if(!isRetainedSetupSaveRequest({expectedVersion:0,idempotencyKey:placeholder,payload}))return null;
 return{payload,poolIntents:t.poolIntents?.map(p=>({...p,eventClientRowId:ids.get(p.eventClientRowId.toLowerCase())!}))??[],links:t.links.map(x=>({mainClientRowId:ids.get(x.mainClientRowId.toLowerCase())!,consolationClientRowIds:x.consolationClientRowIds.map(id=>ids.get(id.toLowerCase())!)})),settings:remap(t.settings),prizes:remap(t.prizes)};
 }catch{return null;}}
