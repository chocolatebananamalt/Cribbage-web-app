/** Comparison-only model of the observed Main/Con source sheet.
 * It does not calculate qualification, authorize awards or move money.
 * Nearest-$5 source rounding is deliberately not balanced automatically.
 */
export const mainConSourceModelVersionV1='maincon-geometric-source-comparison-v1' as const;
export type MainConSourceSettingsV1={method:'graduated_all_qualifiers';factor:string}|{method:'custom_paid_ratio';ratio:number;factor:string}|{method:'custom_top_paid';paidPlaces:number;factor:string};
export type MainConSourceInputV1={entryCount:number;entryFeeMinor:number;benefitsMinor:number;expensesMinor:number;additionalIncomeMinor:number;qualifierCount:number;settings:MainConSourceSettingsV1};
export type MainConSourceResultV1={status:'calculated';version:typeof mainConSourceModelVersionV1;comparisonOnly:true;authoritative:false;moneyMoved:false;currency:'USD';fundMinor:number;qualifierCount:number;factor:string;rounding:'nearest-5usd-positive-halves-up';roundedAwardsTotalMinor:number;discrepancyMinor:number;balanced:boolean;bands:Array<{firstPlace:number;lastPlace:number;people:number;perPersonMinor:number;bandTotalMinor:number;unroundedPerPerson:{numeratorMinor:string;denominator:string}}>}
 |{status:'blocked';code:'invalid_input'|'technical_resource_bound'|'factor_below_one_unsupported'|'custom_paid_places_policy_unresolved'|'negative_fund'};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const integer=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&!Object.is(v,-0);
function gcd(a:bigint,b:bigint):bigint{while(b){const r=a%b;a=b;b=r;}return a;}
/** 10,000 people, factor at most1,000 and six factor decimals are computation bounds, not ACC
 * limits. The source sheet's lookup coverage of128 is not an app limit.
 */
export function calculateMainConSourceModelV1(value:unknown):MainConSourceResultV1{
 if(!exact(value,['entryCount','entryFeeMinor','benefitsMinor','expensesMinor','additionalIncomeMinor','qualifierCount','settings'])||![value.entryCount,value.entryFeeMinor,value.benefitsMinor,value.expensesMinor,value.additionalIncomeMinor,value.qualifierCount].every(integer))return{status:'blocked',code:'invalid_input'};
 const input=value as MainConSourceInputV1;
 if(input.entryCount<1||input.qualifierCount<1||input.qualifierCount>input.entryCount)return{status:'blocked',code:'invalid_input'};
 if(input.entryCount>10000)return{status:'blocked',code:'technical_resource_bound'};
 const settings=input.settings;
 const factorSyntax=object(settings)&&typeof settings.factor==='string'&&/^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$/.test(settings.factor)&&settings.factor.length<=16;
 if(exact(settings,['method','ratio','factor'])&&settings.method==='custom_paid_ratio'&&integer(settings.ratio)&&settings.ratio>0&&factorSyntax)return{status:'blocked',code:'custom_paid_places_policy_unresolved'};
 if(exact(settings,['method','paidPlaces','factor'])&&settings.method==='custom_top_paid'&&integer(settings.paidPlaces)&&settings.paidPlaces>0&&factorSyntax)return{status:'blocked',code:'custom_paid_places_policy_unresolved'};
 if(!exact(settings,['method','factor'])||settings.method!=='graduated_all_qualifiers'||typeof settings.factor!=='string'||! /^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$/.test(settings.factor)||settings.factor.length>16)return{status:'blocked',code:'invalid_input'};
 const [whole,decimal='']=settings.factor.split('.'),den=BigInt(10)**BigInt(decimal.length),num=BigInt(whole)*den+BigInt(decimal||'0');
 if(num<den)return{status:'blocked',code:'factor_below_one_unsupported'};
 if(num>BigInt(1000)*den)return{status:'blocked',code:'technical_resource_bound'};
 const fund=BigInt(input.entryCount)*BigInt(input.entryFeeMinor)-BigInt(input.benefitsMinor)-BigInt(input.expensesMinor)+BigInt(input.additionalIncomeMinor);
 if(fund<BigInt(0))return{status:'blocked',code:'negative_fund'};
 if(fund>BigInt(Number.MAX_SAFE_INTEGER)-BigInt(500)*BigInt(input.qualifierCount))return{status:'blocked',code:'technical_resource_bound'};
 const bands:Array<{firstPlace:number;lastPlace:number;people:number}>=[];
 for(let first=1;first<=input.qualifierCount;first=first===1?2:first*2-1){const last=Math.min(input.qualifierCount,first===1?1:(first-1)*2);bands.push({firstPlace:first,lastPlace:last,people:last-first+1});}
 // Integer common-denominator weights: factor^(B-1-i); no floating money.
 const weights=bands.map((_,i)=>num**BigInt(bands.length-1-i)*den**BigInt(i));
 const totalWeight=weights.reduce((s,w,i)=>s+w*BigInt(bands[i].people),BigInt(0));
 let total=BigInt(0);
 const awards=bands.map((band,i)=>{const raw=fund*weights[i],rounded=((raw*BigInt(2)+totalWeight*BigInt(500))/(totalWeight*BigInt(1000)))*BigInt(500),bandTotal=rounded*BigInt(band.people),divisor=gcd(raw,totalWeight);total+=bandTotal;return{...band,perPersonMinor:Number(rounded),bandTotalMinor:Number(bandTotal),unroundedPerPerson:{numeratorMinor:String(raw/divisor),denominator:String(totalWeight/divisor)}};});
 return{status:'calculated',version:mainConSourceModelVersionV1,comparisonOnly:true,authoritative:false,moneyMoved:false,currency:'USD',fundMinor:Number(fund),qualifierCount:input.qualifierCount,factor:settings.factor,rounding:'nearest-5usd-positive-halves-up',roundedAwardsTotalMinor:Number(total),discrepancyMinor:Number(total-fund),balanced:total===fund,bands:awards};
}
