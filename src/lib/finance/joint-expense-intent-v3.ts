import {isUuid} from '../api/validation.ts';
import {closeSame as same} from './modern-event-close-contract-v1.ts';
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const minor=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0;
/** Private-RPC evidence decoder, not an authority for accepting posted splits. */
export function readJointExpenseIntentV3(value:unknown,scope:{tournamentId:string;mainEventId:string;consolationEventId:string}){
 if(!obj(value)||value.kind!=='current-joint-expense-intent-v3'||value.status!=='source_available'||value.receiptOwnershipClaimed!==false||value.moneyMoved!==false||!Object.entries(scope).every(([k,v])=>value[k]===v)||!Object.values(scope).every(isUuid)||scope.mainEventId===scope.consolationEventId||typeof value.sourceDigest!=='string'||!/^[a-f0-9]{64}$/.test(value.sourceDigest)||!Array.isArray(value.sources))return null;
 let saved:unknown[],reviewSplits:unknown[]|null=null;
 if(value.reviewDomain==='joint-expense-split-journal-v3'){
  const a=value.expenseReviewRevision,o=value.expenseReviewOperation,r=value.expenseReviewOutcome;
  if(!obj(a)||!obj(o)||!obj(r)||!isUuid(a.id)||a.tournament_id!==scope.tournamentId||a.main_event_id!==scope.mainEventId||a.consolation_event_id!==scope.consolationEventId||o.tournament_id!==scope.tournamentId||o.main_event_id!==scope.mainEventId||o.consolation_event_id!==scope.consolationEventId||o.actor_id!==a.actor_id||o.operation_id!==a.operation_id||o.request_hash!==a.request_hash||!obj(o.request)||o.request.reviewed!==true||!Array.isArray(o.request.splits)||r.status!=='joint_expense_split_reviewed_v3'||r.revisionId!==a.id||r.actorId!==a.actor_id||r.tournamentId!==scope.tournamentId||r.eventId!==scope.mainEventId||r.consolationEventId!==scope.consolationEventId||r.sourceDigest!==a.source_digest||r.version!==a.version||!same(r.request,o.request)||!Array.isArray(a.sources))return null;
  if(!obj(a.source_capture)||a.source_capture.sourceDigest!==a.source_digest||a.source_capture.actorId!==a.actor_id||a.source_capture.tournamentId!==scope.tournamentId||a.source_capture.eventId!==scope.mainEventId||a.source_capture.consolationEventId!==scope.consolationEventId||o.request.kind!=='joint-expense-split-review-v3'||o.request.expectedSourceDigest!==a.source_digest||typeof a.version!=='number'||!Number.isInteger(a.version)||o.request.expectedVersion!==a.version-1||o.request.priorRevisionId!==a.prior_revision_id||o.request.consolationEventId!==scope.consolationEventId)return null;
  saved=a.sources;reviewSplits=o.request.splits;
 }else{
  if(value.reviewDomain!==undefined)return null;
  const a=value.allocationRevision,o=value.allocationOperation,r=value.allocationOutcome;
  if(!obj(a)||!obj(o)||!obj(r)||!isUuid(a.id)||a.tournament_id!==scope.tournamentId||o.tournament_id!==scope.tournamentId||o.actor_id!==a.actor_id||o.operation_id!==a.operation_id||!same(o.request_payload,a.request_payload)||o.request_hash!==a.request_hash||r.status!=='accepted'||r.revisionId!==a.id||!obj(a.snapshot)||!Array.isArray(a.snapshot.sources)||!same(r.snapshot,a.snapshot))return null;
  saved=a.snapshot.sources.filter(s=>obj(s)&&s.kind==='expense');
 }
 const ids=new Set<string>(),mainExpenses:unknown[]=[],consolationExpenses:unknown[]=[];
 if(!same(saved,value.sources))return null;
 for(const s of value.sources){
  if(!obj(s)||!isUuid(s.sourceId)||s.physicalEvidenceId!==s.sourceId||ids.has(s.sourceId)||s.kind!=='expense'||s.state!=='active'||!minor(s.amountMinor)||!Array.isArray(s.allocations)||s.allocations.length<1||s.allocations.length>2)return null;
  ids.add(s.sourceId);let total=0;const events=new Set<string>();
  for(const p of s.allocations){
   if(!obj(p)||Object.keys(p).sort().join(',')!=='amountMinor,bucket,classificationReviewed,eventId,poolId'||typeof p.eventId!=='string'||![scope.mainEventId,scope.consolationEventId].includes(p.eventId)||events.has(p.eventId)||!['player_benefit','operating_expense'].includes(String(p.bucket))||p.poolId!==null||p.classificationReviewed!==true||!minor(p.amountMinor))return null;
   events.add(p.eventId);total+=p.amountMinor;if(!Number.isSafeInteger(total))return null;
   const costs=p.eventId===scope.mainEventId?mainExpenses:consolationExpenses;
   const supplied=(p.eventId===scope.mainEventId?value.mainExpenses:value.consolationExpenses);
   if(!Array.isArray(supplied))return null;
   const matches=supplied.filter(x=>obj(x)&&x.expenseEventId===s.sourceId);if(matches.length!==1)return null;
   const c=matches[0];if(!obj(c)||Object.keys(c).sort().join(',')!=='amountMinor,category,description,expenseEventId'||c.amountMinor!==p.amountMinor||c.category!==p.bucket||typeof c.description!=='string')return null;costs.push(c);
  }
  if(total!==s.amountMinor)return null;
  if(reviewSplits){const matches=reviewSplits.filter(x=>obj(x)&&x.expenseEventId===s.sourceId);if(matches.length!==1||!obj(matches[0]))return null;const x=matches[0],main=s.allocations.find(p=>obj(p)&&p.eventId===scope.mainEventId),con=s.allocations.find(p=>obj(p)&&p.eventId===scope.consolationEventId);if(Object.keys(x).sort().join(',')!=='consolationCategory,consolationMinor,expenseEventId,mainCategory,mainMinor'||x.mainMinor!==(obj(main)?main.amountMinor:0)||x.mainCategory!==(obj(main)?main.bucket:null)||x.consolationMinor!==(obj(con)?con.amountMinor:0)||x.consolationCategory!==(obj(con)?con.bucket:null))return null;}
 }
 if(reviewSplits&&reviewSplits.length!==value.sources.length||!same(mainExpenses,value.mainExpenses)||!same(consolationExpenses,value.consolationExpenses))return null;
 return{sources:value.sources,mainExpenses,consolationExpenses};
}
