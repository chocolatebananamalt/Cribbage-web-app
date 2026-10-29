import test from 'node:test';
import assert from 'node:assert/strict';
import {orderQCardsV2,previewQOperatingScheduleV2} from '../src/lib/results/q-operating-schedule.ts';
const cards=n=>Array.from({length:n},(_,i)=>({participantId:`P${i+1}`,gamePoints:2*(n-i),gamesWon:n-i,plusPoints:(n-i)*10,qualified:i<2,qualificationRank:i<2?i+1:null}));
function scenario(n,fee=1000,ratio=6,amounts=[7500,4500]){
 const rows=cards(n+4);
 return {policy:{method:'graduated-paid-card-rank-v2',feeMinor:fee,ratio,scheduleId:`friend-${fee}-${ratio}`},cards:rows,
 contributions:rows.slice(0,n).map(c=>({participantId:c.participantId,amountMinor:fee})),cuts:[],
 chart:{scheduleId:`friend-${fee}-${ratio}`,sourceReference:'Parent visually verified golden example; full PDF not materialized',feeMinor:fee,ratio,paidCount:n,awardsMinor:amounts}};
}
test('exact supplied golden cells preserve dollars and count paid entrants, not tournament population',()=>{
 for(const [n,fee,awards] of [[12,1000,[7500,4500]],[13,1000,[6500,4000,2500]],[16,1000,[8000,5000,3000]],[16,5000,[39000,25000,16000]]]){
  const r=previewQOperatingScheduleV2(scenario(n,fee,6,awards));
  assert.equal(r.status,'preview');assert.deepEqual(r.awards.map(a=>a.amountMinor),awards);
  assert.equal(r.awards.reduce((s,a)=>s+a.amountMinor,0),n*fee);assert.equal(r.moneyMoved,false);
 }
});
test('graduated rank-down includes paid nonqualifiers without relabeling them playoff qualifiers',()=>{
 const s=scenario(16,1000,6,[8000,5000,3000]);s.cards[0].qualified=false;s.cards[0].qualificationRank=null;s.cards[1].qualified=false;s.cards[1].qualificationRank=null;
 const r=previewQOperatingScheduleV2(s);assert.equal(r.status,'preview');
 assert.deepEqual(r.awards.map(a=>a.participantId),['P1','P2','P3']);assert.equal(s.cards[0].qualified,false);
});
test('missing/unsupported chart cells and fee scaling fail closed',()=>{
 for(const n of [0,1,4,10,11,14,60,61]){
  const s=scenario(n);s.chart=null;assert.deepEqual(previewQOperatingScheduleV2(s),{status:'blocked',code:'chart_review_required'});
 }
 const s=scenario(16,5000,6,[8000,5000,3000]);assert.equal(previewQOperatingScheduleV2(s).code,'unbalanced_chart');
 s.chart.feeMinor=1000;assert.equal(previewQOperatingScheduleV2(s).code,'chart_review_required');
});
test('recipient boundary uses ceil for paid pool count and never fabricates missing chart recipients',()=>{
 for(const ratio of [4,6])for(let n=1;n<=80;n++){
  const k=Math.ceil(n/ratio), pot=n*1000, each=Math.floor(pot/k), rem=pot%k;
  const amounts=Array.from({length:k},(_,i)=>each+(i<rem?1:0));
  const s=scenario(n,1000,ratio,amounts); // Synthetic chart arithmetic only, not imported schedule evidence.
  const r=previewQOperatingScheduleV2(s);assert.equal(r.status,'preview');assert.equal(r.awards.length,k);
  s.chart.awardsMinor.pop();assert.equal(previewQOperatingScheduleV2(s).code,'chart_review_required');
 }
});
test('wins then positive plus margins, never net spread, determine a numeric tie',()=>{
 const rows=[{participantId:'A',gamePoints:6,gamesWon:2,plusPoints:100,qualified:true,qualificationRank:1,netSpreadPoints:1000},
 {participantId:'B',gamePoints:6,gamesWon:3,plusPoints:50,qualified:true,qualificationRank:2,netSpreadPoints:-1000},
 {participantId:'C',gamePoints:6,gamesWon:3,plusPoints:60,qualified:true,qualificationRank:3,netSpreadPoints:-2000}];
 assert.deepEqual(orderQCardsV2(rows,[]).map(c=>c.participantId),['C','B','A']);
});
test('physical low-card outcome requires exact recorded tied group; never ID/input/random fallback',()=>{
 const rows=cards(2);rows[1]={...rows[0],participantId:'P2',qualificationRank:2};
 assert.equal(orderQCardsV2(rows,[]),null);assert.equal(orderQCardsV2([...rows].reverse(),[]),null);
 const cut={participantIdsLowFirst:['P2','P1'],recordedBy:'director-test',reason:'Observed physical low-card cut; P2 lower'};
 assert.deepEqual(orderQCardsV2(rows,[cut]).map(c=>c.participantId),['P2','P1']);
 for(const cuts of [[{...cut,recordedBy:''}],[{...cut,reason:''}],[{...cut,participantIdsLowFirst:['P1','P1']}],[cut,cut]])assert.equal(orderQCardsV2(rows,cuts),null);
 assert.equal(orderQCardsV2(cards(2),[cut]),null);
});
test('equal remains qualifier-only; zero qualifying paid entrants create unpaid Q-only refund obligations',()=>{
 const s=scenario(4,501);s.policy={method:'equal-paid-playoff-qualifiers-v2',feeMinor:501};s.chart=null;
 let r=previewQOperatingScheduleV2(s);assert.equal(r.status,'preview');assert.deepEqual(r.awards.map(a=>a.amountMinor),[1002,1002]);
 s.cards.forEach(c=>{c.qualified=false;c.qualificationRank=null});r=previewQOperatingScheduleV2(s);
 assert.deepEqual(r.refunds,s.contributions);assert.deepEqual(r.awards,[]);assert.equal(r.moneyMoved,false);
});
test('partial, duplicate, unknown and overflowing contributions cannot become preview funds',()=>{
 const s=scenario(12);s.contributions[0].amountMinor=999;assert.equal(previewQOperatingScheduleV2(s).code,'invalid_input');
 s.contributions[0].amountMinor=1000;s.contributions.push(s.contributions[0]);assert.equal(previewQOperatingScheduleV2(s).code,'invalid_input');
 const bad=scenario(12);bad.contributions[0].participantId='unknown';assert.equal(previewQOperatingScheduleV2(bad).code,'invalid_input');
 const over=scenario(2,Number.MAX_SAFE_INTEGER);assert.equal(previewQOperatingScheduleV2(over).code,'invalid_input');
});
test('unpaid ties and nonqualifier ties do not block another pools recipients or equal refunds',()=>{
 const s=scenario(12);s.cards[13]={...s.cards[12],participantId:'P14'};
 assert.equal(previewQOperatingScheduleV2(s).status,'preview');
 s.policy={method:'equal-paid-playoff-qualifiers-v2',feeMinor:1000};
 s.cards.forEach(c=>{c.qualified=false;c.qualificationRank=null});s.cards[1]={...s.cards[0],participantId:'P2'};
 const r=previewQOperatingScheduleV2(s);assert.equal(r.status,'preview');assert.equal(r.refunds.length,12);
});
test('malformed runtime inputs fail closed without throwing',()=>{
 for(const s of [null,{}, {...scenario(12),cards:[null]}, {...scenario(12),contributions:[null]}, {...scenario(12),cuts:[null]},
  {...scenario(12),chart:{}}, {...scenario(12),chart:{...scenario(12).chart,awardsMinor:null}}]){
  assert.doesNotThrow(()=>previewQOperatingScheduleV2(s));assert.equal(previewQOperatingScheduleV2(s).status,'blocked');
 }
 for(const [rows,cuts] of [[null,[]],[cards(2),null],[[null],[]],[cards(2),[null]]])assert.equal(orderQCardsV2(rows,cuts),null);
});
