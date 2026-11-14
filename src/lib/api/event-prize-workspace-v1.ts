import {isEventPrizeResponseValueV1,isEventPrizeSettingsSnapshotV1,type EventPrizeSettingsSnapshotV1,type EventPrizePlanChoiceV1,isEventPrizeSettingsEnvelopeV1,type EventPrizeSettingsEnvelopeV1} from './event-prize-settings-v1.ts';
import {isEventSettingsSnapshotV3,type EventSettingsSnapshotV3} from './event-settings-snapshot-v3.ts';
import type {EventSettingsSetupEnvelopeV3} from './event-settings-setup-v3.ts';
import type {SetupCustomPayoutsBaseV2} from './custom-payout-setup-v2.ts';

export type EventPrizeWorkspaceV1={kind:'event-prize-workspace-v1';actorId:string;tournamentId:string;base:SetupCustomPayoutsBaseV2;
 events:Array<{eventClientRowId:string;eventKind:'main'|'consolation'}>;
 settings:{state:'absent';historyExists:false;snapshot:null;id:null;digest:null}|{state:'present';historyExists:true;snapshot:EventSettingsSnapshotV3;id:string;digest:string};
 prizes:{state:'absent';historyExists:false;snapshot:null}|{state:'present';historyExists:true;snapshot:EventPrizeSettingsSnapshotV1};
 activationAllowed:false;accountingAllowed:false;moneyMoved:false};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(v);
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
function freeze<T>(v:T):T{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}

/** Accept server-proved absence, including legacy revisions with no settings
 * history. A missing head alone never establishes absence. No defaults or
 * historical conversions are manufactured by this reader. */
export function readEventPrizeWorkspaceV1(v:unknown,actorId:string,tournamentId:string):EventPrizeWorkspaceV1|null{
 try{
  if(!uuid(actorId)||!uuid(tournamentId)||!isEventPrizeResponseValueV1(v)||!exact(v,['kind','actorId','tournamentId','base','events','settings','prizes','activationAllowed','accountingAllowed','moneyMoved'])||v.kind!=='event-prize-workspace-v1'||v.actorId!==actorId||v.tournamentId!==tournamentId||v.activationAllowed!==false||v.accountingAllowed!==false||v.moneyMoved!==false)return null;
  const b=v.base,s=v.settings,p=v.prizes;
  if(!exact(b,['tournamentId','setupRevisionId','setupVersion','sourceDigest'])||b.tournamentId!==tournamentId||!Number.isInteger(b.setupVersion)||Object.is(b.setupVersion,-0)||(b.setupVersion as number)<0||(b.setupVersion as number)>2147483646||!hash(b.sourceDigest)||!((b.setupVersion===0&&b.setupRevisionId===null)||((b.setupVersion as number)>0&&uuid(b.setupRevisionId))))return null;
  if(!Array.isArray(v.events)||v.events.length>32||v.events.some(e=>!exact(e,['eventClientRowId','eventKind'])||!uuid(e.eventClientRowId)||!['main','consolation'].includes(e.eventKind as string)))return null;
  const events=v.events as EventPrizeWorkspaceV1['events'];if(new Set(events.map(e=>e.eventClientRowId)).size!==events.length||(b.setupVersion===0&&events.length))return null;
  if(!exact(s,['state','historyExists','snapshot','id','digest'])||!exact(p,['state','historyExists','snapshot']))return null;
  if(s.state==='absent'){if(s.historyExists!==false||s.snapshot!==null||s.id!==null||s.digest!==null)return null;}
  else if(s.state!=='present'||s.historyExists!==true||!uuid(s.id)||!hash(s.digest)||!isEventSettingsSnapshotV3(s.snapshot)||s.snapshot.tournamentId!==tournamentId||s.snapshot.setupRevisionId!==b.setupRevisionId||s.snapshot.setupVersion!==b.setupVersion)return null;
  if(p.state==='absent'){if(p.historyExists!==false||p.snapshot!==null)return null;}
  else if(p.state!=='present'||p.historyExists!==true||!isEventPrizeSettingsSnapshotV1(p.snapshot)||s.state!=='present'||p.snapshot.tournamentId!==tournamentId||p.snapshot.setupRevisionId!==b.setupRevisionId||p.snapshot.setupVersion!==b.setupVersion||p.snapshot.settingsSnapshotId!==s.id||p.snapshot.settingsDigest!==s.digest)return null;
  if(s.state==='present'&&(s.snapshot as EventSettingsSnapshotV3).settings.length!==events.length)return null;
  if(s.state==='present'&&events.some(e=>!(s.snapshot as EventSettingsSnapshotV3).settings.some(x=>x.eventClientRowId===e.eventClientRowId)))return null;
  if(p.state==='present'&&((p.snapshot as EventPrizeSettingsSnapshotV1).plans.length!==events.length||events.some(e=>!(p.snapshot as EventPrizeSettingsSnapshotV1).plans.some(x=>x.eventClientRowId===e.eventClientRowId&&x.eventKind===e.eventKind))))return null;
  return freeze(structuredClone(v) as EventPrizeWorkspaceV1);
 }catch{return null;}
}

/** Uses the exact reviewed workspace and complete nested setup. Callers must
 * explicitly choose preservation or a proposal for every Main/Consolation. */
export function buildEventPrizeEnvelopeV1(workspace:EventPrizeWorkspaceV1,setup:EventSettingsSetupEnvelopeV3,prizePlans:EventPrizePlanChoiceV1[],operationId:string):EventPrizeSettingsEnvelopeV1|null{
 if(!isEventPrizeResponseValueV1(workspace)||!object(workspace))return null;
 const w=readEventPrizeWorkspaceV1(workspace,workspace.actorId,workspace.tournamentId);if(!w)return null;
 const prior=w.prizes.snapshot;
 const e={kind:'event-prize-settings-setup-v1' as const,operationId,setup,prizeBase:{settingsSnapshotId:w.settings.id,settingsDigest:w.settings.digest,prizeSnapshotId:prior?.prizeSnapshotId??null,prizeDigest:prior?.prizeDigest??null},prizePlans};
 return isEventPrizeSettingsEnvelopeV1(e,w.base)?freeze(structuredClone(e)):null;
}
