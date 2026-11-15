import assert from 'node:assert/strict';
import {calculatePlayoffPrizeComparisonV2} from '../src/lib/results/playoff-prize-comparison-v2.ts';
import {calculatePlayoffPrizeProposalsV2} from '../src/lib/results/playoff-prize-proposals-v2.ts';
const literal=v=>"'"+JSON.stringify(v).replaceAll("'","''")+"'::jsonb";
/** Pure SQL/JS representability parity, not altered sporting/native authority.
 * Caller owns an approved fictional fixture and installed private helpers. */
export async function acceptPlayoffPrizeRangeLocalV2({call,tournamentId,eventId,actorId,nativeSource}){
 const cases=[];const original=nativeSource.capture.input,eventRow=original.binding.eventClientRowId;
 const make=(q,method,step,override=false)=>{const input=structuredClone(original),plan=input.prizeSource.snapshot.plans.find(p=>p.eventClientRowId===eventRow).draft;plan.method=method;plan.recipients='all';plan.rounding.regular=step;plan.firstRoundComparison='unset';input.qualification.result.qualifierCount=q;
  const field={status:'known',qualifierCount:q,firstRoundLoserPlaces:null,entryFeeMinor:null};
  // Use the actual current fund for ordinary cases; only qualifier count and
  // method parameters are counterfactual math inputs in this parity check.
  const allocations=input.ledger.current.sources.flatMap(s=>s.state==='active'?s.allocations:[]).filter(p=>p.eventId===eventId);
  const fundMinor=allocations.reduce((sum,p)=>sum+(p.bucket==='regular_entry'?p.amountMinor:p.bucket==='player_benefit'||p.bucket==='operating_expense'?-p.amountMinor:0),0);
  const calculation=calculatePlayoffPrizeComparisonV2({plan,field,fundMinor});assert.equal(calculation.status,'calculated_comparison');
  const source={tournamentId,eventId,eventClientRowId:eventRow,eventKind:input.binding.eventKind,setupRevisionId:input.binding.setupRevisionId,settingsSnapshotId:input.binding.settingsSnapshotId,settingsDigest:input.binding.settingsDigest,prizeSnapshotId:input.binding.prizeSnapshotId,prizeDigest:input.binding.prizeDigest,allocationRevisionId:input.ledger.allocationRevisionId,qualificationResultVersionId:input.qualification.currentResultVersionId,ledgerDigest:'a'.repeat(64),resultsDigest:'b'.repeat(64)};
  const current={source,input:{plan,field,fundMinor}},history=[];
  if(override){const band=calculation.bands.at(-1),amount=Number.MAX_SAFE_INTEGER-Number.MAX_SAFE_INTEGER%(Number(step)*100);history.push({recordId:'a8080000-0000-4000-8000-000000099001',firstPlace:band.firstPlace,lastPlace:band.lastPlace,priorRecordId:null,perPersonMinor:amount,voided:false,reason:'Fictional exact range boundary'});}
  return{input,history,expected:calculatePlayoffPrizeProposalsV2({...current,overrideHistory:history},current).status==='proposal_review',label:{q,method,step,override}};
 };
 for(const q of[1,5,10,64,10000])for(const method of['graduated','equal','winner-multiplier','winner-takes-all'])for(const step of['1','5','10'])cases.push(make(q,method,step));
 for(const q of[5,10,64])for(const method of['graduated','equal','winner-multiplier'])cases.push(make(q,method,'5',true));
 const result=await call(`select jsonb_agg(app.playoff_prize_proposal_range_safe_v2(x->'input',x->'history')order by n)from jsonb_array_elements(${literal(cases.map(({input,history})=>({input,history})))})with ordinality a(x,n);`,actorId);
 assert.equal(result.length,cases.length);result.forEach((value,i)=>assert.equal(value,cases[i].expected,JSON.stringify(cases[i].label)));
 return{passed:true,cases:cases.length,counterfactualMathOnly:true,nativeQualificationChanged:false,moneyMoved:false};
}
