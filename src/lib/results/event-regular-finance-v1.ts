/** Pure source-bound accounting proposal. No ledger writes, payments or
 * finalization authority. Gross entry income is explicit evidence, not count×fee.
 */
export const eventRegularFinanceVersionV1='event-regular-finance-proposal-v1' as const;
export type RegularFinanceModeV1='estimate'|'documented_actual'|'simulation';
export type RegularFinanceSourceV1={tournamentId:string;eventId:string;sourceVersion:number;sourceDigest:string};
export type RegularFinanceCategoryV1='player_benefit'|'operating_expense'|'unrestricted_income'|'restricted_income'|'unclassified_income'|'q_pool_fund'|'side_pool_fund';
export type RegularFinanceLineV1={recordId:string;lineId:string;priorRecordId:string|null;source:RegularFinanceSourceV1;mode:RegularFinanceModeV1;category:RegularFinanceCategoryV1;amountMinor:number;voided:boolean;reason:string};
export type EventRegularFinanceInputV1={source:RegularFinanceSourceV1;mode:RegularFinanceModeV1;grossEntry:{source:RegularFinanceSourceV1;mode:RegularFinanceModeV1;amountMinor:number};history:RegularFinanceLineV1[]};
export type EventRegularFinanceResultV1={status:'calculated';version:typeof eventRegularFinanceVersionV1;proposalOnly:true;moneyMoved:false;finalizationAuthorized:false;currency:'USD';source:RegularFinanceSourceV1;mode:RegularFinanceModeV1;grossEntryMinor:number;benefitsMinor:number;expensesMinor:number;additionalIncomeMinor:number;regularFundMinor:number;excludedQMinor:number;excludedSideMinor:number;activeLineCount:number;historyRecordCount:number;lines:Array<{lineId:string;recordId:string;category:RegularFinanceCategoryV1;amountMinor:number;voided:boolean}>}
 |{status:'blocked';code:'invalid_input'|'technical_batch_bound'|'source_mismatch'|'mixed_modes'|'invalid_lineage'|'income_requires_review'|'unsafe_total'|'negative_regular_fund'};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(v);
const money=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&!Object.is(v,-0);
const mode=(v:unknown):v is RegularFinanceModeV1=>v==='estimate'||v==='documented_actual'||v==='simulation';
const categories:RegularFinanceCategoryV1[]=['player_benefit','operating_expense','unrestricted_income','restricted_income','unclassified_income','q_pool_fund','side_pool_fund'];
const bucket=(category:RegularFinanceCategoryV1)=>category==='q_pool_fund'?'q':category==='side_pool_fund'?'side':'regular';
function source(v:unknown):v is RegularFinanceSourceV1{return exact(v,['tournamentId','eventId','sourceVersion','sourceDigest'])&&uuid(v.tournamentId)&&uuid(v.eventId)&&money(v.sourceVersion)&&typeof v.sourceDigest==='string'&&/^[a-f0-9]{64}$/.test(v.sourceDigest);}
function same(a:RegularFinanceSourceV1,b:RegularFinanceSourceV1){return a.tournamentId===b.tournamentId&&a.eventId===b.eventId&&a.sourceVersion===b.sourceVersion&&a.sourceDigest===b.sourceDigest;}
/** Limit is a processing batch bound, never a business limit on expense lines.
 * Callers must retain complete history; truncation/compaction is not inferred.
 * Every input is a single immutable source snapshot: a changed source requires
 * explicit review/rebinding outside this model, never silent historical edits.
 */
export function calculateEventRegularFinanceV1(value:unknown):EventRegularFinanceResultV1{
 if(!exact(value,['source','mode','grossEntry','history'])||!source(value.source)||!mode(value.mode)||!exact(value.grossEntry,['source','mode','amountMinor'])||!source(value.grossEntry.source)||!mode(value.grossEntry.mode)||!money(value.grossEntry.amountMinor)||!Array.isArray(value.history))return{status:'blocked',code:'invalid_input'};
 if(value.history.length>10000)return{status:'blocked',code:'technical_batch_bound'};
 if(!same(value.source,value.grossEntry.source))return{status:'blocked',code:'source_mismatch'};
 if(value.mode!==value.grossEntry.mode)return{status:'blocked',code:'mixed_modes'};
 const latest=new Map<string,RegularFinanceLineV1>(),records=new Set<string>();
 for(const raw of value.history){
  if(!exact(raw,['recordId','lineId','priorRecordId','source','mode','category','amountMinor','voided','reason'])||!uuid(raw.recordId)||!uuid(raw.lineId)||!(raw.priorRecordId===null||uuid(raw.priorRecordId))||!source(raw.source)||!mode(raw.mode)||!categories.includes(raw.category as RegularFinanceCategoryV1)||!money(raw.amountMinor)||typeof raw.voided!=='boolean'||typeof raw.reason!=='string'||raw.reason.length>2000)return{status:'blocked',code:'invalid_input'};
  const line=raw as RegularFinanceLineV1;
  if(!same(value.source,line.source))return{status:'blocked',code:'source_mismatch'};
  if(value.mode!==line.mode)return{status:'blocked',code:'mixed_modes'};
  const previous=latest.get(line.lineId);
  if(previous&&bucket(previous.category)!==bucket(line.category))return{status:'blocked',code:'invalid_lineage'};
  if(records.has(line.recordId)||(!previous&&line.priorRecordId!==null)||(previous&&line.priorRecordId!==previous.recordId)||((previous||line.voided)&&!line.reason.trim())||(line.voided&&line.amountMinor!==0))return{status:'blocked',code:'invalid_lineage'};
  records.add(line.recordId);latest.set(line.lineId,{...line,source:{...line.source}});
 }
 const totals=new Map(categories.map(c=>[c,BigInt(0)]));
 for(const line of latest.values())if(!line.voided){if(line.category==='restricted_income'||line.category==='unclassified_income')return{status:'blocked',code:'income_requires_review'};totals.set(line.category,totals.get(line.category)!+BigInt(line.amountMinor));}
 const benefits=totals.get('player_benefit')!,expenses=totals.get('operating_expense')!,income=totals.get('unrestricted_income')!,q=totals.get('q_pool_fund')!,side=totals.get('side_pool_fund')!,gross=BigInt(value.grossEntry.amountMinor),fund=gross-benefits-expenses+income,max=BigInt(Number.MAX_SAFE_INTEGER);
 if([...totals.values(),fund].some(n=>n>max))return{status:'blocked',code:'unsafe_total'};
 if(fund<BigInt(0))return{status:'blocked',code:'negative_regular_fund'};
 return{status:'calculated',version:eventRegularFinanceVersionV1,proposalOnly:true,moneyMoved:false,finalizationAuthorized:false,currency:'USD',source:{...value.source},mode:value.mode,grossEntryMinor:Number(gross),benefitsMinor:Number(benefits),expensesMinor:Number(expenses),additionalIncomeMinor:Number(income),regularFundMinor:Number(fund),excludedQMinor:Number(q),excludedSideMinor:Number(side),activeLineCount:[...latest.values()].filter(l=>!l.voided).length,historyRecordCount:value.history.length,lines:[...latest.values()].map(({lineId,recordId,category,amountMinor,voided})=>({lineId,recordId,category,amountMinor,voided}))};
}
