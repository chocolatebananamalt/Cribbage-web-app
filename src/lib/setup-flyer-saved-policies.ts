import { integratedTestUiEnabled as integratedTestFeatureEnabled } from './integrated-test-target.ts';
import{isSetupWorkspace}from'./api/setup.ts';
import{readEventPrizeWorkspaceV1}from'./api/event-prize-workspace-v1.ts';
import{resolveEventSeriesDraftV1}from'./playoffs/event-playoff-parameters-v1.ts';
import{inspectPlayoffPrizePlanV2}from'./playoffs/playoff-prize-plan-v2.ts';
import{buildSetupFlyer,type SetupFlyer}from'./setup-flyer.ts';
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const slotOf=(p:unknown)=>p&&typeof p==='object'&&'slot'in p&&typeof p.slot==='number'?p.slot:null;
const ratio=(n:unknown):n is number=>Number.isInteger(n)&&Number(n)>0&&Number(n)<=2147483647;
export const setupFlyerCustomPoolsEnabledV1=()=>integratedTestFeatureEnabled();
export function buildSetupFlyerWithSavedPolicies(o:{workspace:unknown;prizeWorkspace?:unknown;customPools?:unknown;actorId:string;tournamentId:string}):SetupFlyer|null{
 const f=buildSetupFlyer(o.workspace);if(!f||!isSetupWorkspace(o.workspace)||!o.workspace.current)return null;const c=o.workspace.current;
 f.warnings=f.warnings.filter(w=>!w.startsWith('Playoff series/prize settings'));
 const rows=c.events,map=new Map(rows.map((e,i)=>[e.clientRowId,{e,out:f.events[i]}])),mainCon=rows.filter(e=>e.eventKind==='main'||e.eventKind==='consolation');
 const w=readEventPrizeWorkspaceV1(o.prizeWorkspace,o.actorId,o.tournamentId);
 const pinned=w&&w.base.setupRevisionId===c.revisionId&&w.base.setupVersion===c.version&&w.events.length===mainCon.length&&w.events.every(e=>mainCon.some(x=>x.clientRowId===e.eventClientRowId&&x.eventKind===e.eventKind));
 if(!pinned&&mainCon.length)f.warnings.push('Saved Playoff/prize settings are unavailable or belong to another setup revision. They are not included.');
 if(pinned){for(const e of mainCon){const out=map.get(e.clientRowId)!.out,details=out.savedPolicyDetails??=[];const settings=w.settings.snapshot?.settings.find(s=>s.eventClientRowId===e.clientRowId),series=settings?.mode==='configured'?resolveEventSeriesDraftV1(settings.draft):null;
  if(series){details.push(`Regular Rounds: ${series.regular.winsRequired} Wins out of ${series.regular.maximumGames} Games`,`Final: ${series.final.winsRequired} Wins out of ${series.final.maximumGames} Games`);}else f.warnings.push(`${e.displayName}: saved Playoff series require review and are not included.`);
  const plan=w.prizes.snapshot?.plans.find(p=>p.eventClientRowId===e.clientRowId);
  if(plan?.mode!=='proposed_v2'||inspectPlayoffPrizePlanV2(plan.draft,{status:'unknown',qualifierCount:null,firstRoundLoserPlaces:null,entryFeeMinor:null}).status==='blocked'){f.warnings.push(`${e.displayName}: regular-prize proposal is unavailable or requires review.`);continue;}
  const d=plan.draft;details.push(`Requested Paid Places: ${d.method==='winner-takes-all'?'Winner Only':d.recipients==='all'?'All Playoff Qualifiers':`Top ${d.recipients.slice(4)} Playoff Finishes`}`);
  details.push(`Saved Prize Method: ${d.method==='graduated'?`Graduated; Increment Factor ${d.incrementFactorText}`:d.method==='equal'?'Equal':d.method==='winner-multiplier'?`Equal with Winner Multiplier ${d.winnerMultiplierText}`:'Winner Takes All'}`);
  details.push(`Rounding: Regular Prizes $${d.rounding.regular}; Q-Pools $${d.rounding.qPool}; Side Pools $${d.rounding.sidePool}`);
  if((d.method==='graduated'||d.method==='winner-multiplier')&&d.firstRoundComparison!=='unset')details.push(`Saved Conditional Preference: if first-round losers are paid, compare their amount ${d.firstRoundComparison==='equal'?'equal to':d.firstRoundComparison==='less'?'below':'above'} the entry fee. Final field and fee-reference review are required.`);
  details.push('Recipient counts and amounts remain provisional until the Playoff field and finishes are confirmed.');
 }}
 const v=o.customPools;let customValid=exact(v,['kind','actorId','tournamentId','setupRevisionId','setupVersion','sourceDigest','payouts','sideMethods','savedIntentOnly','calculationAuthorized','moneyMoved'])&&v.kind==='setup-flyer-custom-pools-v1'&&v.actorId===o.actorId&&v.tournamentId===o.tournamentId&&v.setupRevisionId===c.revisionId&&v.setupVersion===c.version&&typeof v.sourceDigest==='string'&&/^[a-f0-9]{64}$/.test(v.sourceDigest)&&(!pinned||v.sourceDigest===w.base.sourceDigest)&&v.savedIntentOnly===true&&v.calculationAuthorized===false&&v.moneyMoved===false&&Array.isArray(v.payouts)&&v.payouts.length<=288&&Array.isArray(v.sideMethods)&&v.sideMethods.length<=192;
 const seen=new Set<string>();
 if(customValid&&exact(v,['kind','actorId','tournamentId','setupRevisionId','setupVersion','sourceDigest','payouts','sideMethods','savedIntentOnly','calculationAuthorized','moneyMoved'])){
  for(const p of v.payouts as unknown[]){if(!exact(p,['eventClientRowId','scope','poolSlot','ratioDenominator'])||typeof p.eventClientRowId!=='string'||!ratio(p.ratioDenominator)||!['q','side','satellite'].includes(String(p.scope))){customValid=false;break;}const row=map.get(p.eventClientRowId),key=`${p.eventClientRowId}:${p.scope}:${p.poolSlot}`;
   if(!row||seen.has(key)||p.scope==='satellite'&&(row.e.eventKind!=='satellite'||p.poolSlot!==null)||p.scope!=='satellite'&&(!Number.isInteger(p.poolSlot)||(p.scope==='q'?row.e.qPools:row.e.sidePools).filter(s=>slotOf(s)===p.poolSlot).length!==1)){customValid=false;break;}if(p.scope==='q'&&row.e.qPools.find(s=>slotOf(s)===p.poolSlot)?.poolTypeCode!==`Graduated (1-in-${p.ratioDenominator})`||p.scope==='satellite'&&row.e.payoutNote!==`1 in ${p.ratioDenominator}`||p.scope==='side'&&!(v.sideMethods as unknown[]).some(m=>exact(m,['eventClientRowId','poolSlot','payoutType','customRatio'])&&m.eventClientRowId===p.eventClientRowId&&m.poolSlot===p.poolSlot&&m.customRatio===p.ratioDenominator&&m.payoutType===null)){customValid=false;break;}seen.add(key);
  }
  const sides=new Set<string>();for(const p of v.sideMethods as unknown[]){if(!exact(p,['eventClientRowId','poolSlot','payoutType','customRatio'])||typeof p.eventClientRowId!=='string'||!map.get(p.eventClientRowId)?.e.sidePools.some(s=>slotOf(s)===p.poolSlot)||!(p.payoutType===null||typeof p.payoutType==='string'&&/^graduated-1-in-(4|6|8|10)$/.test(p.payoutType))||!(p.customRatio===null||ratio(p.customRatio))||p.customRatio!==null&&p.payoutType!==null){customValid=false;break;}const sourcePool=map.get(p.eventClientRowId)!.e.sidePools.find(s=>slotOf(s)===p.poolSlot);if(sourcePool&&'payoutType'in sourcePool&&sourcePool.payoutType!==undefined&&(sourcePool.payoutType!==p.payoutType||p.customRatio!==null)){customValid=false;break;}const key=`${p.eventClientRowId}:${p.poolSlot}`;if(sides.has(key)){customValid=false;break;}sides.add(key);
   if(p.customRatio!==null&&!(v.payouts as Record<string,unknown>[]).some(x=>x.eventClientRowId===p.eventClientRowId&&x.scope==='side'&&x.poolSlot===p.poolSlot&&x.ratioDenominator===p.customRatio)){customValid=false;break;}
  }
  for(const e of rows){for(const p of e.qPools){if(/^Graduated \(1-in-[0-9]+\)$/.test(p.poolTypeCode)&&!['Graduated (1-in-4)','Graduated (1-in-6)','Graduated (1-in-8)','Graduated (1-in-10)'].includes(p.poolTypeCode)&&!seen.has(`${e.clientRowId}:q:${slotOf(p)}`))customValid=false;}if(e.eventKind==='satellite'&&/^1 in [0-9]+$/.test(e.payoutNote)&&!['1 in 4','1 in 5','1 in 6'].includes(e.payoutNote)&&!seen.has(`${e.clientRowId}:satellite:null`))customValid=false;}
  if(sides.size!==rows.reduce((n,e)=>n+e.sidePools.length,0))customValid=false;
 }
 if(!customValid)f.warnings.push('Verified Custom pool settings are unavailable, stale or inconsistent. Only the saved setup wording is shown; review it before distribution.');
 else if(exact(v,['kind','actorId','tournamentId','setupRevisionId','setupVersion','sourceDigest','payouts','sideMethods','savedIntentOnly','calculationAuthorized','moneyMoved'])){
  for(const p of v.payouts as {eventClientRowId:string;scope:string;poolSlot:number|null;ratioDenominator:number}[]){const out=map.get(p.eventClientRowId)!.out;if(p.scope==='satellite'){(out.savedPolicyDetails??=[]).push(`Saved Satellite Ratio Intent: 1-in-${p.ratioDenominator} (Custom). Distribution method requires separate review.`);}else{const source=p.scope==='q'?map.get(p.eventClientRowId)!.e.qPools:map.get(p.eventClientRowId)!.e.sidePools,index=source.findIndex(s=>slotOf(s)===p.poolSlot),pool=(p.scope==='q'?out.qPools:out.sidePools)[index];pool.savedMethod=`Graduated 1-in-${p.ratioDenominator} (Custom)`;}}
  for(const p of v.sideMethods as {eventClientRowId:string;poolSlot:number;payoutType:string|null;customRatio:number|null}[]){if(p.payoutType!==null){const row=map.get(p.eventClientRowId)!;row.out.sidePools[row.e.sidePools.findIndex(s=>slotOf(s)===p.poolSlot)].savedMethod=`Graduated 1-in-${p.payoutType.split('-').at(-1)}`;}else if(p.customRatio===null)f.warnings.push(`${map.get(p.eventClientRowId)!.e.displayName}: Side Pool ${p.poolSlot} has no saved payout method in this source.`);}
 }
 if(pinned)f.warnings.push('Saved Playoff/prize configuration is a proposal, not funded final awards or proof of required event-rule approvals.');
 return f;
}
