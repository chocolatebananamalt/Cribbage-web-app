import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {parsePrizePercentBasisPoints,semifinalWeightsFromPercentText} from '../src/lib/results/prize-percentage-input.ts';
test('chart percentages parse exactly to basis points with no silent rounding',()=>{
 for(const [input,bps] of [['1',100],['0.01',1],['12.34',1234],['100',10000],['100.00',10000],[' 50.5 ',5050]])assert.equal(parsePrizePercentBasisPoints(input),bps);
 for(const input of ['', '0','-1','+1','.5','1.','01','1e1','100.01','12.345','50%','$50',null,NaN])assert.equal(parsePrizePercentBasisPoints(input),null);
});
test('combined semifinal shares become equal per-person weights without changing source percentages',()=>{
 const shares=['40','30','20','10'];assert.deepEqual(semifinalWeightsFromPercentText(shares),[8,6,3]);assert.deepEqual(shares,['40','30','20','10']);
 assert.deepEqual(semifinalWeightsFromPercentText(['36','24','24','16']),[9,6,5]);
 assert.deepEqual(semifinalWeightsFromPercentText(['33.33','33.33','16.67','16.67']),[3333,3333,1667]);
});
test('invalid/unbalanced/nonfour-place charts fail closed rather than redistribute or interpolate',()=>{
 for(const shares of [[],['50','50'],['40','30','20','9.99'],['40','30','20','10.001'],['40','30','30','0'],['40','30','20','10','1'],['-40','30','60','50']])assert.equal(semifinalWeightsFromPercentText(shares),null);
});
test('setup conversion is explicit local draft, blocks unsafe saving, resets review and uses the new explicit five-dollar rounding policy',()=>{
 const ui=fs.readFileSync('src/app/tournament/[tournamentId]/setup/prize-schedule-client.tsx','utf8');
 for(const text of ['Combine semifinal shares into weights','Discard unapplied chart percentages','chartPercentages.some(value => value !== "")','setReviewed(false); setChartPercentages','no schedule was saved','automatic $5 cohort rounding'])assert.ok(ui.includes(text));
 const fn=ui.slice(ui.indexOf('function applyChartPercentages()'),ui.indexOf('const expenseMinor ='));
 assert.ok(!fn.includes('fetch('));assert.ok(!fn.includes('save()'));assert.ok(fn.includes('if (locked || flight.current || !combinedChartWeights) return;'));
});
