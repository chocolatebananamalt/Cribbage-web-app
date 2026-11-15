import {inspectPlayoffPrizePlanV2} from '../playoffs/playoff-prize-plan-v2.ts';
import {isEventPrizeWireValueV1} from '../api/event-prize-settings-v1.ts';

const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const whole=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&!Object.is(v,-0);
const gcd=(a:bigint,b:bigint):bigint=>{while(b){const r=a%b;a=b;b=r;}return a;};
/** A versioned comparison, not an allocation rule or final-award writer.
 * Extends the supplied MainCon model's geometric equal-finish-band weights and
 * positive nearest-increment rounding to the reviewed V2 controls. Differences
 * remain explicit; there is no invented redistribution or fee-floor solver.
 * Caller-supplied field/fund facts are not proof of ledger or sporting authority.
 */
export function calculatePlayoffPrizeComparisonV2(value:unknown){
 const authority={authoritative:false as const,recipientAssignmentAllowed:false as const,finalizationAllowed:false as const,payoutAuthorized:false as const,moneyMoved:false as const,qualificationChanged:false as const};
 const fail=(code:string)=>({status:'blocked' as const,code,...authority});
 if(!isEventPrizeWireValueV1(value)||!exact(value,['plan','field','fundMinor'])||!whole(value.fundMinor))return fail('invalid_input');
 const view=inspectPlayoffPrizePlanV2(value.plan,value.field);if(view.status==='blocked')return fail(view.code);
 if(!view.fieldKnown||view.qualifierCount===null||view.includedPaidPlaces===null)return fail('known_playoff_field_required');
 // The inspector validates the complete exact draft/field before use.
 const plan=value.plan as import('../playoffs/playoff-prize-plan-v2.ts').PlayoffPrizePlanDraftV2;
 const field=value.field as import('../playoffs/playoff-prize-plan-v2.ts').PlayoffPrizeFieldV2;
 const count=view.includedPaidPlaces,step=BigInt(view.roundingStepMinor),fund=BigInt(value.fundMinor);
 if(fund>BigInt(Number.MAX_SAFE_INTEGER)-step*BigInt(count))return fail('technical_resource_bound');
 const groups:Array<{firstPlace:number;lastPlace:number;people:number}>=[];
 for(let first=1;first<=count;first=first===1?2:first*2-1){const last=Math.min(count,first===1?1:(first-1)*2);groups.push({firstPlace:first,lastPlace:last,people:last-first+1});}
 const ratio=(text:string)=>{const [i,d='']=text.split('.'),den=BigInt(10)**BigInt(d.length);return{num:BigInt(i)*den+BigInt(d||'0'),den};};
 let weights:bigint[];
 if(plan.method==='graduated'){const {num,den}=ratio(plan.incrementFactorText);weights=groups.map((_,i)=>num**BigInt(groups.length-1-i)*den**BigInt(i));}
 else if(plan.method==='winner-multiplier'){const {num,den}=ratio(plan.winnerMultiplierText);weights=groups.map((_,i)=>i===0?num:den);}
 else weights=groups.map(()=>BigInt(1));
 const denominator=weights.reduce((sum,w,i)=>sum+w*BigInt(groups[i].people),BigInt(0));
 let total=BigInt(0);
 const bands=groups.map((group,i)=>{const raw=fund*weights[i],divisor=gcd(raw,denominator),rounded=((BigInt(2)*raw+denominator*step)/(BigInt(2)*denominator*step))*step,bandTotal=rounded*BigInt(group.people);total+=bandTotal;return{...group,perPersonMinor:Number(rounded),bandTotalMinor:Number(bandTotal),unroundedPerPerson:{numeratorMinor:String(raw/divisor),denominator:String(denominator/divisor)}};});
 const discrepancy=Number(total-fund);
 const firstRoundBands=view.includedFirstRoundPlaces===null?null:bands.filter(b=>view.includedFirstRoundPlaces!.some(p=>p>=b.firstPlace&&p<=b.lastPlace));
 let comparison:'not_applicable'|'pending_field_evidence'|'pending_entry_fee'|'choice_required'|'incompatible_increment'|'satisfied'|'not_satisfied'='not_applicable';
 if(view.comparisonPending)comparison='pending_field_evidence';
 else if(view.comparisonVisible){
  if(view.comparisonCompatibility==='pending_entry_fee')comparison='pending_entry_fee';
  else if(plan.firstRoundComparison==='unset')comparison='choice_required';
  else if(view.comparisonCompatibility==='incompatible_increment')comparison='incompatible_increment';
  else{const fee=field.entryFeeMinor!;comparison=firstRoundBands!.every(b=>plan.firstRoundComparison==='less'?b.perPersonMinor<fee:plan.firstRoundComparison==='more'?b.perPersonMinor>fee:b.perPersonMinor===fee)?'satisfied':'not_satisfied';}
 }
 return{status:'calculated_comparison' as const,version:'playoff-prize-comparison-v2' as const,method:plan.method,fundMinor:value.fundMinor,qualifierCount:view.qualifierCount,requestedPaidPlaces:view.requestedPaidPlaces,actualPaidPlaces:count,cutoffWarning:view.cutoffWarning,bands,roundedAwardsTotalMinor:Number(total),discrepancyMinor:discrepancy,balanced:discrepancy===0,zeroAwardBand:bands.some(b=>b.perPersonMinor===0),comparison,roundingStepMinor:Number(step),roundingModel:'source-model-nearest-positive-halves-up' as const,reviewRequired:discrepancy!==0||bands.some(b=>b.perPersonMinor===0)||!['not_applicable','satisfied'].includes(comparison),amountsAreEstimates:true as const,...authority};
}
