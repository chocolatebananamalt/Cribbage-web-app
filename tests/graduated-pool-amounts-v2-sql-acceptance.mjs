// Root owns the reviewed disposable database lifecycle. No hosted connection.
import assert from 'node:assert/strict';
import {calculateGraduatedPoolAmountsV2}from'../src/lib/results/graduated-pool-amounts-v2.ts';
import {calculateAccWeightedPool}from'../src/lib/results/acc-weighted-pool.ts';
const quote=s=>`'${String(s).replaceAll("'","''")}'`;
export function verifyGraduatedPoolAmountsV2Sql(sql){
 const samples=[];
 for(const feeMinor of[1000,2000,5000])for(const ratio of[4,6])for(let paidCount=1;paidCount<=256;paidCount++)samples.push({paidCount,feeMinor,ratio});
 const originalCount=samples.length;
 for(const paidCount of[1,2,3,59,89,90,9999,10000])for(const ratio of[2,3,4,5,6,7,10,50,99,100])for(const feeMinor of[500,1500,100000000])samples.push({paidCount,feeMinor,ratio});
 const invalid=[null,{},[],{paidCount:'16',feeMinor:500,ratio:6},{paidCount:1.1,feeMinor:500,ratio:6},{paidCount:0,feeMinor:500,ratio:6},{paidCount:10001,feeMinor:500,ratio:6},{paidCount:1,feeMinor:499,ratio:6},{paidCount:1,feeMinor:100000001,ratio:6},{paidCount:1,feeMinor:501,ratio:6},{paidCount:1,feeMinor:500,ratio:1},{paidCount:1,feeMinor:500,ratio:101},{paidCount:1,feeMinor:500,ratio:6,extra:true}];
 const all=[...samples,...invalid];let checked=0;
 // Bounded chunks avoid oversized SQL/JSON transport for maximum5000-row output.
 for(let start=0;start<all.length;start+=32){const inputs=all.slice(start,start+32);const actual=JSON.parse(sql(`select jsonb_agg(app.calculate_graduated_pool_amounts_v2(value)order by ord)from jsonb_array_elements(${quote(JSON.stringify(inputs))}::jsonb)with ordinality as cases(value,ord);`));
  for(const[i,input]of inputs.entries()){const expected=calculateGraduatedPoolAmountsV2(input);assert.deepEqual(actual[i],expected,JSON.stringify(input));if(start+i<originalCount){const{moneyMoved,...historicalShape}=expected;assert.equal(moneyMoved,false);assert.deepEqual({...historicalShape,policyVersion:calculateAccWeightedPool(input).policyVersion},calculateAccWeightedPool(input));}checked++;}
 }
 assert.equal(sql(`select bool_and(not has_function_privilege(role,'app.calculate_graduated_pool_amounts_v2(jsonb)','EXECUTE'))from unnest(array['anon','authenticated','service_role'])role;`),'t');
 assert.equal(sql(`select p.provolatile='i'and not p.prosecdef and p.proconfig @> array['search_path=""']from pg_proc p where p.oid='app.calculate_graduated_pool_amounts_v2(jsonb)'::regprocedure;`),'t');
 console.log(`PASS shared graduated v2 SQL/BigInt parity: ${checked}cases,1536 historical domains,private immutable helper and empty search path`);
 return{cases:checked,historicalDomains:originalCount,expandedDomains:samples.length-originalCount,rejectedCases:invalid.length};
}
