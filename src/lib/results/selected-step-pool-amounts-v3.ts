/** Versioned amount-only implementation of the reviewed selected-step models.
 * No recipient selection, policy adoption, receipts, journal or payment access. */
export type SelectedStepPoolPolicyV3={kind:'q'|'side';method:'q-equal'|'q-graduated'|'side-sheet';feeMinor:number;ratio:number|null;roundingUnitMinor:100|500|1000};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype;
const integer=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&!Object.is(v,-0);
export function calculateSelectedStepPoolAmountsV3(value:unknown){
 const hold=(code:string)=>({status:'blocked' as const,code,moneyMoved:false as const});
 if(!object(value)||Reflect.ownKeys(value).length!==3||!object(value.policy)||!['policy','paidCount','recipientCount'].every(k=>Object.hasOwn(value,k)))return hold('invalid_input');
 const p=value.policy;
 if(Reflect.ownKeys(p).length!==5||!['kind','method','feeMinor','ratio','roundingUnitMinor'].every(k=>Object.hasOwn(p,k))||!['q','side'].includes(p.kind as string)||!integer(p.feeMinor)||p.feeMinor<100||p.feeMinor>100000000||![100,500,1000].includes(p.roundingUnitMinor as number)||!integer(value.paidCount)||value.paidCount<1||value.paidCount>10000||!integer(value.recipientCount)||value.recipientCount<1||value.recipientCount>value.paidCount)return hold('invalid_policy_or_counts');
 const fee=BigInt(p.feeMinor),unit=BigInt(p.roundingUnitMinor as number),fund=BigInt(value.paidCount)*fee,k=BigInt(value.recipientCount),raw:Array<{num:bigint;den:bigint}>=[];
 let branch:string;
 if(p.method==='q-equal'){
  if(p.kind!=='q'||p.ratio!==null||p.feeMinor%100!==0)return hold('invalid_equal_policy');
  if(fund%(k*unit)!==BigInt(0))return hold('equal_split_not_exact');
  branch='equal';for(let i=0;i<value.recipientCount;i++)raw.push({num:fund/k,den:BigInt(1)});
 }else{
  if(!integer(p.ratio)||p.ratio<1||p.ratio>2147483647||Math.ceil(value.paidCount/p.ratio)!==value.recipientCount)return hold('unsupported_ratio_or_recipient_count');
  const triangle=k*(k+BigInt(1))/BigInt(2);let floor:bigint;
  if(p.kind==='q'&&p.method==='q-graduated'){
   if(p.feeMinor<500||p.feeMinor%500!==0)return hold('unsupported_q_fee_lattice');
   floor=fee;branch=k===BigInt(1)?'single_recipient':fund>triangle*fee?'descending_linear':'entry_fee_floor';
  }else if(p.kind==='side'&&p.method==='side-sheet'){
   if(![1000,2000,5000,10000].includes(p.feeMinor))return hold('unverified_side_fee_tab');
   if(value.recipientCount>(p.feeMinor===1000?56:128))return hold('verified_weight_row_capacity_exceeded');
   floor=BigInt(2000);branch=fund>BigInt(4000)*triangle?'descending_linear':'fixed_20_dollar_baseline';
   if(branch==='fixed_20_dollar_baseline'&&fund<floor*k)return hold('fund_below_sheet_baseline');
   if(branch==='fixed_20_dollar_baseline'&&k===BigInt(1))return hold('one_recipient_baseline_formula_unverified');
  }else return hold('unsupported_method');
  if(fund%unit!==BigInt(0))return hold('fund_not_divisible_by_increment');
  for(let i=1;i<=value.recipientCount;i++){const rank=BigInt(i);if(branch==='single_recipient')raw.push({num:fund,den:BigInt(1)});else if(branch==='descending_linear')raw.push({num:fund*(k-rank+BigInt(1)),den:triangle});else{const den=triangle-k;raw.push({num:floor*den+(fund-floor*k)*(k-rank),den});}}
 }
 const rounded=raw.map((r,index)=>({index,amount:r.num/(r.den*unit)*unit,remainder:r.num%(r.den*unit),den:r.den}));
 const floorTotal=rounded.reduce((s,r)=>s+r.amount,BigInt(0)),remaining=fund-floorTotal;
 if(remaining<BigInt(0)||remaining%unit!==BigInt(0)||remaining/unit>=k)return hold('unsupported_conservation');
 const priority=[...rounded].sort((a,b)=>{const d=a.remainder*b.den-b.remainder*a.den;return d>BigInt(0)?-1:d<BigInt(0)?1:a.index-b.index;});
 for(let i=0;i<Number(remaining/unit);i++)rounded[priority[i].index].amount+=unit;
 const floor=p.method==='q-equal'?BigInt(0):p.kind==='q'?fee:BigInt(2000);
 if(rounded.some((r,i)=>r.amount<=BigInt(0)||r.amount<floor||r.amount%unit!==BigInt(0)||(i>0&&r.amount>rounded[i-1].amount))||rounded.reduce((s,r)=>s+r.amount,BigInt(0))!==fund)return hold('selected_increment_violates_baseline_or_order');
 return{status:'calculated' as const,version:'selected-step-pool-amounts-v3' as const,policy:structuredClone(p)as SelectedStepPoolPolicyV3,paidCount:value.paidCount,recipientCount:value.recipientCount,fundMinor:Number(fund),roundingUnitMinor:Number(unit)as 100|500|1000,branch,awardsMinor:rounded.map(r=>Number(r.amount)),moneyMoved:false as const,recipientSelectionPerformed:false as const,financialFinalizationAllowed:false as const};
}
