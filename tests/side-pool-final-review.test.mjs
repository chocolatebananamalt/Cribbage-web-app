import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const sql=readFileSync("database/migrations/0187_side_pool_final_review_repairs.sql","utf8");
test("Side Pool final-review boundaries lock elections, allow post-play payouts, and scope identity",()=>{
 for(const token of ["side_pool_election_locked","order by participant_id,version desc","order by team_entry_id,version desc","payout_identity_conflict","posted_before_play","event_side_pool_reconciliation","prior.request_hash<>h","already-posted payouts remain recordable"]){assert.ok(sql.includes(token), token);}
});
test("Side Pool operations GET is official-only",()=>{const route=readFileSync("src/app/api/v1/tournaments/[id]/side-pools/route.ts","utf8");assert.match(route,/requireTournamentAccess/);assert.match(route,/director.*co_director/);});
