// Local formula reconstructions only, not observed/live spreadsheet outputs.
import fs from'node:fs';
import {calculateWorkbookSatelliteComparisonV1 as calculate}from'../src/lib/results/workbook-satellite-comparison-v1.ts';
const rows=[];
for(const entrantCount of[2,12,17,18,30,31,35,90])for(const ratio of[1,3,5,6,7,11])
 for(const feeMinor of[1,2999,3000,3001,4000])for(const fundMinor of[500,15000,29000,30000,30001,100300,100500,1000000]){
  const input={entrantCount,feeMinor,ratio,fundMinor,rankingState:'individual_ranks'};
  rows.push({input,result:calculate(input)});
 }
for(const input of[
 {entrantCount:18,feeMinor:4000,ratio:6,fundMinor:30000,rankingState:'unresolved_ties'},
 {entrantCount:Number.MAX_SAFE_INTEGER,feeMinor:Number.MAX_SAFE_INTEGER,ratio:Math.floor(Number.MAX_SAFE_INTEGER/2),fundMinor:Number.MAX_SAFE_INTEGER,rankingState:'individual_ranks'},
])rows.push({input,result:calculate(input)});
const output={kind:'satellite-source-model-reconstructions-v1',liveSpreadsheetRecalculation:false,operationalPolicyAdopted:false,rows};
fs.writeFileSync('test-results/workbook-satellite-comparison-local.json',JSON.stringify(output));
console.log(JSON.stringify({cases:rows.length,comparisons:rows.filter(x=>x.result.status==='comparison').length,blocked:rows.filter(x=>x.result.status==='blocked').length,liveSpreadsheetRecalculation:false}));
