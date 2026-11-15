import { calculateGraduatedPoolAmountsV2, graduatedPoolAmountsVersionV2 } from './graduated-pool-amounts-v2.ts';

export const payoutReferenceVersion = 'workbook-reference-comparison-2026-11-04-v1' as const;
export type PayoutReference = {
  id: string; method: 'elimination-cohorts' | 'graduated' | 'stairstep' | 'equal' | 'top-double' | 'satellite-total-only';
  fundMinor: number; bands?: readonly { label: string; amountsMinor: readonly number[] }[]; declaredTotalMinor?: number;
  context: string; provenance: typeof payoutReferenceVersion;
};
function freeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
export const payoutReferenceMetadata = freeze({ version: payoutReferenceVersion,
  source: 'Parent-verified native Google Sheet examples; this module did not recalculate the live Sheet',
  sheetUrl: 'https://docs.google.com/spreadsheets/d/1HlDFQxNEWjm_oG62ocq4XYCvwa6xgy0U0OsE515vXrc/edit',
  operationalPolicyAdopted: false, moneyMoved: false,
});
const band = (label: string, ...amountsMinor: number[]) => ({ label, amountsMinor });
export const payoutReferenceCases: readonly PayoutReference[] = freeze([
  { id: 'main-40', method: 'elimination-cohorts', fundMinor: 28000, bands: [band('Champion',7000),band('Runner-up',4500),band('Semifinal',3000,3000),band('Quarterfinal',2000,2000,2000,2000),band('Next round',1500,1500)], context: '40 entries × $10 less $3 sanctioning per entry; ten recipients; equal within each elimination cohort', provenance:payoutReferenceVersion },
  { id: 'side-17-ratio-6',method:'graduated',fundMinor:17000,bands:[band('Ranked awards',9500,5500,2000)],context:'17 contributors × $10, 1-in-6. Workbook distribution differs materially from the approved app kernel, even though both conserve the fund.',provenance:payoutReferenceVersion },
  { id:'q-six-graduated',method:'graduated',fundMinor:20000,bands:[band('Six eligible qualifiers',5500,4500,4000,3000,2000,1000)],context:'$200 fund and six eligible qualifiers; not a 20-paid-at-1-in-4 recipient rule',provenance:payoutReferenceVersion },
  { id:'q-six-stairstep',method:'stairstep',fundMinor:20000,bands:[band('Six eligible qualifiers',6000,5000,4000,2000,2000,1000)],context:'$200 fund, six eligible qualifiers',provenance:payoutReferenceVersion },
  { id:'q-six-equal',method:'equal',fundMinor:20000,bands:[band('Equal',3500,3500,3500,3500,3500,3500)],context:'$200 fund, six equal awards; workbook overallocates $10',provenance:payoutReferenceVersion },
  { id:'q-six-top-double',method:'top-double',fundMinor:20000,bands:[band('Top qualifier',6000),band('Other eligible qualifiers',3000,3000,3000,3000,3000)],context:'$200 fund, top qualifier double; workbook overallocates $10',provenance:payoutReferenceVersion },
  { id:'q-nine-equal',method:'equal',fundMinor:20000,bands:[band('Equal',2000,2000,2000,2000,2000,2000,2000,2000,2000)],context:'$200 fund, nine equal awards; workbook leaves $20 unallocated',provenance:payoutReferenceVersion },
  { id:'satellite-total',method:'satellite-total-only',fundMinor:100300,declaredTotalMinor:100500,context:'Only verified total supplied; no tier amounts or Top 4 split inferred',provenance:payoutReferenceVersion },
] satisfies PayoutReference[]);
const cents = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
export function reconcilePayoutReference(reference: PayoutReference) {
  const bands=reference.bands, amounts=bands?.flatMap(b=>[...b.amountsMinor]);
  if (!cents(reference.fundMinor) || (amounts ? amounts.length===0 || amounts.some(n=>!cents(n)) : !cents(reference.declaredTotalMinor))) throw new Error('Invalid reference monetary data');
  const total=amounts ? amounts.reduce((sum,n)=>sum+n,0) : reference.declaredTotalMinor!;
  if (!Number.isSafeInteger(total)) throw new Error('Reference sum exceeds safe integer cents');
  const differenceMinor=total-reference.fundMinor;
  const cohortEqual=bands ? bands.every(b=>b.amountsMinor.length>0&&b.amountsMinor.every(n=>n===b.amountsMinor[0])) : null;
  let methodCompliance: boolean|null=null;
  if(amounts){
    if(reference.method==='equal')methodCompliance=amounts.every(n=>n===amounts[0]);
    if(reference.method==='top-double')methodCompliance=amounts.length>=2&&amounts.slice(1).every(n=>n===amounts[1])&&amounts[0]===2*amounts[1];
    if(reference.method==='elimination-cohorts')methodCompliance=cohortEqual;
  }
  return freeze({ referenceId:reference.id,referenceVersion:reference.provenance,fundMinor:reference.fundMinor,awardsTotalMinor:total,differenceMinor,
    balance:differenceMinor===0?'balanced' as const:differenceMinor>0?'over' as const:'under' as const,
    fiveDollarCompliance:amounts?amounts.every(n=>n%500===0):null,
    equalCohortCompliance:reference.method==='elimination-cohorts'?cohortEqual:null,methodCompliance,
    operationalPolicyAdopted:false as const,moneyMoved:false as const });
}
/** Read-only what-if, preserving the existing app policy and recipient rule. */
export function calculateApprovedPoolWhatIf(input: unknown) { return calculateGraduatedPoolAmountsV2(input); }
export const approvedPoolPreviewVersion = graduatedPoolAmountsVersionV2;
export function compareSideReference() {
  const calculation=calculateApprovedPoolWhatIf({paidCount:17,feeMinor:1000,ratio:6});
  if(calculation.status!=='calculated')throw new Error('Approved reference domain unexpectedly unsupported');
  return freeze({referenceId:'side-17-ratio-6',workbookAwardsMinor:[9500,5500,2000],approvedAwardsMinor:[...calculation.awardsMinor],
    fundMinor:17000,conflict:'distribution-policy-difference' as const,roundingOnly:false as const,operationalPolicyAdopted:false as const,moneyMoved:false as const});
}

export type PoolSummaryEntry = {entryId:string;eventId:string;poolId:string;currency:'USD';electionVersion:number;status:'entered'|'withdrawn'|'superseded';feeWaived:boolean;current:boolean;allocationState:'verified-current'|'unknown'|'stale';allocationId:string|null;allocatedMinor:number|null};
export type PoolSummaryInput = {eventId:string;poolId:string;policyVersion:string;asOf:string;currency:'USD';feeMinor:number;sourceCurrent:boolean;entries:readonly PoolSummaryEntry[]};
export type PoolSummaryKnown = {status:'available'|'partial';eventId:string;poolId:string;policyVersion:string;asOf:string;currency:'USD';enteredCount:number;fullyPaidCount:number|null;waivedCount:number;eligibleFullyPaidFundMinor:number|null;projectedBillableFundMinor:number;excludedAllocationReviewRequired:boolean;issues:string[];estimate:true;moneyMoved:false};
export type PoolSummaryResult = PoolSummaryKnown | {status:'unavailable';code:'invalid_input'|'stale_source'|'conflicting_duplicate'|'stale_election'|'cross_scope'|'reused_allocation';asOf:string|null};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const stable=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
const timestamp=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,19)===v.slice(0,19);
export function projectPoolSummary(value:unknown):PoolSummaryResult {
  const unavailable=(code:Extract<PoolSummaryResult,{status:'unavailable'}>['code']):PoolSummaryResult=>({status:'unavailable',code,asOf:object(value)&&timestamp(value.asOf)?value.asOf:null});
  if(!object(value)||!exact(value,['eventId','poolId','policyVersion','asOf','currency','feeMinor','sourceCurrent','entries'])||![value.eventId,value.poolId,value.policyVersion].every(stable)||!timestamp(value.asOf)||value.currency!=='USD'||!cents(value.feeMinor)||value.feeMinor===0||typeof value.sourceCurrent!=='boolean'||!Array.isArray(value.entries)||value.entries.length>10000)return unavailable('invalid_input');
  if(!value.sourceCurrent)return unavailable('stale_source');
  const versions=new Map<string,Map<number,PoolSummaryEntry>>(),allocationOwners=new Map<string,string>();
  for(const row of value.entries){
    if(!object(row)||!exact(row,['entryId','eventId','poolId','currency','electionVersion','status','feeWaived','current','allocationState','allocationId','allocatedMinor'])||!stable(row.entryId)||!Number.isSafeInteger(row.electionVersion)||Number(row.electionVersion)<1||!['entered','withdrawn','superseded'].includes(row.status as string)||typeof row.feeWaived!=='boolean'||typeof row.current!=='boolean'||!['verified-current','unknown','stale'].includes(row.allocationState as string)||!(row.allocatedMinor===null||cents(row.allocatedMinor))||!(row.allocationId===null||stable(row.allocationId)))return unavailable('invalid_input');
    if(row.eventId!==value.eventId||row.poolId!==value.poolId||row.currency!==value.currency)return unavailable('cross_scope');
    if(row.allocationId!==null){const owner=allocationOwners.get(row.allocationId);if(owner&&owner!==row.entryId)return unavailable('reused_allocation');allocationOwners.set(row.allocationId,row.entryId);}
    const entry=row as PoolSummaryEntry, byVersion=versions.get(entry.entryId)??new Map<number,PoolSummaryEntry>(),prior=byVersion.get(entry.electionVersion);
    if(prior&&Object.keys(entry).some(k=>entry[k as keyof PoolSummaryEntry]!==prior[k as keyof PoolSummaryEntry]))return unavailable('conflicting_duplicate');
    byVersion.set(entry.electionVersion,entry);versions.set(entry.entryId,byVersion);
  }
  let enteredCount=0,fullyPaidCount=0,waivedCount=0,eligibleFullyPaidFundMinor=0,projectedBillableFundMinor=0,excludedAllocationReviewRequired=false;
  const issues=new Set<string>();
  for(const byVersion of versions.values()){
    const entry=byVersion.get(Math.max(...byVersion.keys()))!;
    if(!entry.current)return unavailable('stale_election');
    if(entry.status!=='entered'){
      if(entry.allocationState!=='verified-current'||entry.allocatedMinor===null||entry.allocatedMinor>0){excludedAllocationReviewRequired=true;issues.add('excluded_allocation_requires_review');}
      continue;
    }
    enteredCount++;
    if(entry.feeWaived)waivedCount++;else projectedBillableFundMinor+=value.feeMinor;
    if(entry.allocationState!=='verified-current'||entry.allocatedMinor===null){issues.add('allocation_unavailable');continue;}
    if((entry.allocatedMinor>0&&entry.allocationId===null)||entry.allocatedMinor>value.feeMinor||(entry.feeWaived&&entry.allocatedMinor!==0)){issues.add('inconsistent_allocation');continue;}
    if(!entry.feeWaived&&entry.allocatedMinor===value.feeMinor){fullyPaidCount++;eligibleFullyPaidFundMinor+=entry.allocatedMinor;}
  }
  if(!cents(projectedBillableFundMinor)||!cents(eligibleFullyPaidFundMinor))return unavailable('invalid_input');
  const partial=issues.size>0;
  return {status:partial?'partial':'available',eventId:value.eventId as string,poolId:value.poolId as string,policyVersion:value.policyVersion as string,asOf:value.asOf,currency:'USD',enteredCount,fullyPaidCount:partial?null:fullyPaidCount,waivedCount,eligibleFullyPaidFundMinor:partial?null:eligibleFullyPaidFundMinor,projectedBillableFundMinor,excludedAllocationReviewRequired,issues:[...issues].sort(),estimate:true,moneyMoved:false};
}
