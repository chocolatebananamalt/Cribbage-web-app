import test from'node:test';
import assert from'node:assert/strict';
import fs from'node:fs';
const source=fs.readFileSync(new URL('./native-optional-legacy-first-liability-local-acceptance.mjs',import.meta.url),'utf8');

test('legacy-first fixture uses the supported V10 writer and captures its immutable final provenance',()=>{
 assert.match(source,/verifyCustomCombinedAccountingRuntimeV10\(\{sql/);
 assert.match(source,/prize_accounting_finalized_unpaid_v9/);
 assert.match(source,/from app\.prize_accounting_finals_v9 f join app\.prize_accounting_drafts_v9 d/);
 assert.match(source,/join app\.operation_receipts o on o\.id=f\.operation_receipt_id/);
 assert.match(source,/legacy_financial_liability_exists_v1/);
});

test('new ownership, Finance, fund and final paths block without leaving V2 history',()=>{
 for(const call of['native_optional_pool_ownership_source_v2','save_native_optional_pool_ownership_v2','native_optional_finance_source_v2','native_optional_recorded_fund_source_v2','native_optional_final_award_source_v2','record_native_optional_final_awards_v2'])assert.match(source,new RegExp(call));
 assert.match(source,/existing_financial_liability/);
 assert.match(source,/other_final_award_liability_exists/);
 assert.match(source,/assert\.deepEqual\(after,before\)/);
 assert.match(source,/assert\.deepEqual\(afterCounts,beforeCounts\)/);
});

test('only default-false local gates are instrumented and exact definitions are restored',()=>{
 assert.match(source,/const gates=\['native_optional_pool_ownership_enabled_v2','native_optional_finance_source_enabled_v2','native_optional_playoff_source_enabled_v2','native_optional_recorded_fund_enabled_v2','native_optional_final_awards_enabled_v2'\]/);
 assert.match(source,/for\(const source of originals\)assert\.match\(source,\/select false\/i\)/);
 assert.match(source,/finally\{for\(const source of originals\)sql\(context\+source\)/);
 assert.doesNotMatch(source,/delete from app\.prize_accounting|update app\.prize_accounting|truncate/i);
});
