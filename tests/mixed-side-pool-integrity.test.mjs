import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const sql=readFileSync("database/migrations/0184_mixed_side_pool_payout_integrity.sql","utf8");
test("mixed Side Pool integrity guards shared cents, corrections, and placement",()=>{for(const token of ["$100 to $90","guard_mixed_side_pool_payout_v4","event_side_pool_mixed_payout_guard","event_side_pool_mixed_team_payout_guard","payout_exceeds_collected","placement_exists","p_idempotency_key","prior.request_hash<>h","payout_id<>new.payout_id","team_entry_id","select distinct on\\(payout_id\\)","tg_table_name<>'event_side_pool_payout_versions'"]){assert.match(sql,new RegExp(token.replaceAll("$","\\$")));}assert.match(sql,/set_event_side_pool_payout_v1/);assert.match(sql,/set_event_side_pool_team_payout_v1/);});
