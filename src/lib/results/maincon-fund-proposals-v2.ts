import{calculateMainConFundComparisonV2,type MainConFundInputV2}from'./maincon-fund-comparison-v2.ts';
export type MainConFundProposalSourceV2={tournamentId:string;eventId:string;settingsSnapshotId:string;ledgerDigest:string;resultsDigest:string};
export type MainConWholeBandOverrideV2={recordId:string;firstPlace:number;lastPlace:number;priorRecordId:string|null;perPersonMinor:number;voided:boolean;reason:string};
export type MainConFundProposalV2={source:MainConFundProposalSourceV2;input:MainConFundInputV2;overrideHistory:MainConWholeBandOverrideV2[]};
export type MainConFundCurrentV2={source:MainConFundProposalSourceV2;input:MainConFundInputV2};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(v);
const whole=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&!Object.is(v,-0);
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
function source(v:unknown):v is MainConFundProposalSourceV2{return exact(v,['tournamentId','eventId','settingsSnapshotId','ledgerDigest','resultsDigest'])&&uuid(v.tournamentId)&&uuid(v.eventId)&&uuid(v.settingsSnapshotId)&&hash(v.ledgerDigest)&&hash(v.resultsDigest);}
const canonical=(v:unknown)=>JSON.stringify(v,(_key,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
function current(v:unknown):v is MainConFundCurrentV2{return exact(v,['source','input'])&&source(v.source)&&calculateMainConFundComparisonV2(v.input).status==='calculated_comparison';}
const noAuthority={authoritative:false as const,finalizationAllowed:false as const,paymentAuthorized:false as const,moneyMoved:false as const,writeAuthorized:false as const};
/** Pure comparison/proposal, never ledger or sporting authority. Full retained
 * source+fund+settings must match the separately supplied current snapshot.
 * A changed source is blocked; no history or user amount is silently rebased.
 */
export function calculateMainConFundProposalsV2(retained:unknown,expectedCurrent:unknown){
 const fail=(code:string)=>({status:'blocked' as const,code,...noAuthority});
 if(!exact(retained,['source','input','overrideHistory'])||!source(retained.source)||!Array.isArray(retained.overrideHistory)||Reflect.ownKeys(retained.overrideHistory).length!==retained.overrideHistory.length+1||!current(expectedCurrent))return fail('invalid_input');
 // Technical processing bound, not a business limit on correction history.
 if(retained.overrideHistory.length>10000)return fail('technical_history_bound');
 const calculated=calculateMainConFundComparisonV2(retained.input);if(calculated.status!=='calculated_comparison')return fail(calculated.code);
 if(canonical({source:retained.source,input:retained.input})!==canonical(expectedCurrent))return fail('stale_source_or_fund');
 const bands=new Map(calculated.bands.map(b=>[`${b.firstPlace}:${b.lastPlace}`,b])),latest=new Map<string,MainConWholeBandOverrideV2>(),ids=new Set<string>();
 for(const value of retained.overrideHistory){
  if(!exact(value,['recordId','firstPlace','lastPlace','priorRecordId','perPersonMinor','voided','reason'])||!uuid(value.recordId)||!whole(value.firstPlace)||!whole(value.lastPlace)||!whole(value.perPersonMinor)||value.perPersonMinor%500!==0||typeof value.voided!=='boolean'||typeof value.reason!=='string'||!value.reason.trim()||value.reason.length>2000||!(value.priorRecordId===null||uuid(value.priorRecordId)))return fail('invalid_override');
  const record=value as MainConWholeBandOverrideV2,key=`${record.firstPlace}:${record.lastPlace}`;
  if(!bands.has(key))return fail('override_must_cover_exact_finishing_band');
  const previous=latest.get(key);
  if(ids.has(record.recordId)||(!previous&&(record.priorRecordId!==null||record.voided))||(previous&&record.priorRecordId!==previous.recordId))return fail('invalid_override_lineage');
  ids.add(record.recordId);latest.set(key,{...record});
 }
 let total=BigInt(0);const proposedBands=calculated.bands.map(b=>{const override=latest.get(`${b.firstPlace}:${b.lastPlace}`),perPersonMinor=override&&!override.voided?override.perPersonMinor:b.perPersonMinor,bandTotal=BigInt(perPersonMinor)*BigInt(b.people);total+=bandTotal;return{firstPlace:b.firstPlace,lastPlace:b.lastPlace,people:b.people,sourcePerPersonMinor:b.perPersonMinor,perPersonMinor,bandTotalMinor:bandTotal,overrideRecordId:override?.recordId??null,overrideVoided:override?.voided??false};});
 if(total>BigInt(Number.MAX_SAFE_INTEGER)||proposedBands.some(b=>b.bandTotalMinor>BigInt(Number.MAX_SAFE_INTEGER)))return fail('unsafe_total');
 const difference=Number(total)-calculated.fundMinor,zeroAwardBand=proposedBands.some(b=>b.perPersonMinor===0),rankOrderViolation=proposedBands.some((b,i)=>i>0&&b.perPersonMinor>proposedBands[i-1].perPersonMinor);
 const issues:Array<{code:string;differenceMinor?:number}>=[];if(difference!==0)issues.push({code:'unbalanced',differenceMinor:difference});if(rankOrderViolation)issues.push({code:'rank_order_violation'});if(zeroAwardBand)issues.push({code:'zero_award_band'});
 return{status:'proposal_review' as const,version:'maincon-source-bound-whole-band-proposals-v2' as const,source:{...retained.source},sourceCalculation:calculated,
  requestedPaidPlaces:calculated.requestedPaidPlaces,actualPaidPlaces:calculated.actualPaidPlaces,positiveAwardPlaces:proposedBands.reduce((count,b)=>count+(b.perPersonMinor>0?b.people:0),0),cutoffWarning:calculated.cutoffWarning,
  proposedBands:proposedBands.map(b=>({...b,bandTotalMinor:Number(b.bandTotalMinor)})),proposedTotalMinor:Number(total),discrepancyMinor:difference,balanced:difference===0,rankOrderViolation,zeroAwardBand,issues,
  historyRecordCount:retained.overrideHistory.length,...noAuthority};
}
/** Future persistence must validate a complete unchanged prefix, not just a
 * newly submitted suffix. Same-band corrections/void/reopen append records.
 */
export function isMainConFundProposalExtensionV2(previous:unknown,next:unknown,expectedCurrent:unknown):boolean{
 if(calculateMainConFundProposalsV2(previous,expectedCurrent).status!=='proposal_review'||calculateMainConFundProposalsV2(next,expectedCurrent).status!=='proposal_review')return false;
 const a=previous as MainConFundProposalV2,b=next as MainConFundProposalV2;
 return b.overrideHistory.length>=a.overrideHistory.length&&a.overrideHistory.every((record,index)=>canonical(record)===canonical(b.overrideHistory[index]));
}
