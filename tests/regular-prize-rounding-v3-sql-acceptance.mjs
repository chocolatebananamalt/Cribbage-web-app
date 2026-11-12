// Root calls this with its reviewed disposable local SQL adapter after0256.
import assert from 'node:assert/strict';
import {calculateRegularPrizeRoundingV3} from '../src/lib/results/regular-prize-rounding-v3.ts';
const cohorts=weights=>weights.map((weight,i)=>({bandStart:[1,2,3,5][i],bandEnd:[1,2,4,5][i],weight}));
export function regularPrizeRoundingSqlCasesV3(){
 const cases=[null,{},[],{grossBaseIncomeMinor:0,expenseTotalMinor:0,benefitExpenseMinor:0,expectedQualifierCount:4,cohorts:cohorts([1,1,1])}];
 for(const count of [4,5])for(const units of [count,count+1,7,11,23,56,57,58,101,257,20000])for(const weights of count===4?[[1,1,1],[4,3,2],[1,9,1]]:[[1,1,1,1],[4,3,2,1],[1,9,1,9]])cases.push({grossBaseIncomeMinor:units*500,expenseTotalMinor:0,benefitExpenseMinor:0,expectedQualifierCount:count,cohorts:cohorts(weights)});
 const financial={grossBaseIncomeMinor:51000,expenseTotalMinor:22950,benefitExpenseMinor:15300,expectedQualifierCount:5,cohorts:cohorts([4,3,2,1])};cases.push(financial,{...financial,grossBaseIncomeMinor:48000,expenseTotalMinor:21600,benefitExpenseMinor:14800},{...financial,benefitExpenseMinor:22951},{...financial,expenseTotalMinor:51001},{...financial,grossBaseIncomeMinor:100000,expenseTotalMinor:50000,benefitExpenseMinor:0},{...financial,grossBaseIncomeMinor:10000001,expenseTotalMinor:0,benefitExpenseMinor:0},{...financial,cohorts:cohorts([Number.MAX_SAFE_INTEGER,1,1,1])},{...financial,cohorts:cohorts([0,1,1,1])},{...financial,extra:true},{...financial,grossBaseIncomeMinor:51000.1});
 let state=7281;const next=()=>{state=(state*1664525+1013904223)>>>0;return state;};for(let i=0;i<100;i++){const count=i%2?4:5;cases.push({grossBaseIncomeMinor:(count+next()%100)*500,expenseTotalMinor:0,benefitExpenseMinor:0,expectedQualifierCount:count,cohorts:cohorts(Array.from({length:count===4?3:4},()=>next()%100+1))});}
 return cases;
}
export function verifyRegularPrizeRoundingSqlV3(sql){
 const cases=regularPrizeRoundingSqlCasesV3(),quote=s=>`'${s.replaceAll("'","''")}'`;
 // Separate calls make a mismatched input directly reproducible. No financial
 // writer or temporary human grant is required to exercise this private math.
 for(const [i,input]of cases.entries()){const raw=sql(`select app.calculate_regular_prize_rounding_v3(${quote(JSON.stringify(input))}::jsonb);`);const actual=typeof raw==='string'?JSON.parse(raw.split('\n').filter(Boolean).at(-1)):raw;assert.deepEqual(actual,calculateRegularPrizeRoundingV3(input),`TS/SQL exact parity case${i}: ${JSON.stringify(input)}`);}
 assert.equal(sql("select bool_and(not has_function_privilege(r,'app.calculate_regular_prize_rounding_v3(jsonb)','EXECUTE'))from unnest(array['anon','authenticated','service_role'])r;"),'t');
 assert.equal(sql("select provolatile='i'and not prosecdef and proowner='postgres'::regrole and proconfig=array['search_path=\"\"']from pg_proc where oid='app.calculate_regular_prize_rounding_v3(jsonb)'::regprocedure;"),'t');
 console.log(`PASS regular-prize-v3 exact TS/SQL parity ${cases.length}cases; private immutable invoker math, no human/service grants`);return {cases:cases.length,status:'PASS'};
}
