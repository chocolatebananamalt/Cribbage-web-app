import fs from'node:fs';import assert from'node:assert/strict';import test from'node:test';
const pool=fs.readFileSync('database/proposals/native-mixed-pool-finance-v1.sql','utf8');
const main=fs.readFileSync('database/proposals/native-mixed-main-finance-v1.sql','utf8');
// Source contracts only. Actual role, mismatch rejection, legacy preservation
// and successful selected-unit calculation require the disposable DB run.
test('latest optional-pool rounding comes from proved funding capture, after historical replay',()=>{
 const at=pool.indexOf("select s.source_capture#>'{baseSource,latestPrize}'into latest_prize");assert(at>0);
 assert(pool.indexOf("'replayed',true")<at);assert(pool.indexOf('app.native_mixed_funding_seal_source_v1(tid,eid)')<at);
 assert(pool.includes("array['plan','draft','rounding',case when requested_kind='q'then'qPool'else'sidePool'end]"));
 assert(pool.includes("if latest_prize is not null then"));
 assert(pool.includes("saved_rounding is null or saved_rounding not in('1','5','10')"));
 assert(pool.includes("amount_policy->'roundingUnitMinor'is distinct from to_jsonb(saved_rounding::integer*100)"));
 for(const code of['native_pool_saved_rounding_unavailable','native_pool_saved_rounding_mismatch'])assert(pool.includes(code));
 assert(at<pool.indexOf("record_payload:=jsonb_build_object('setupSource'"));
});
test('latest regular rounding is source bound before cost review and leaves historical replay first',()=>{
 const at=main.indexOf("latest_prize:=source#>'{capture,playoffSource,capture,latestPrize}'");assert(at>0);
 assert(main.indexOf("'historicalReceipt',true")<at);
 assert(main.includes("latest_prize#>>'{plan,draft,rounding,regular}'"));assert(main.includes('if latest_prize is not null then'));
 assert(main.includes("saved_rounding is null or saved_rounding not in('1','5','10')"));
 assert(main.includes("d->'roundingUnitMinor'is distinct from to_jsonb(saved_rounding::integer*100)"));
 assert(at<main.indexOf("record_payload:=jsonb_build_object('costs',costs"));
});
