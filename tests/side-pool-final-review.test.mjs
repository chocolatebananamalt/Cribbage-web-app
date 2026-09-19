import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const sql=readFileSync("database/migrations/0187_side_pool_final_review_repairs.sql","utf8");
test("Side Pool final-review boundaries lock elections, allow post-play payouts, and scope identity",()=>{
 for(const token of ["side_pool_election_locked","order by participant_id,version desc","order by team_entry_id,version desc","payout_identity_conflict","posted_before_play","event_side_pool_reconciliation","prior.request_hash<>h","already-posted payouts remain recordable"]){assert.ok(sql.includes(token), token);}
});
test("Side Pool operations GET is official-only",()=>{const route=readFileSync("src/app/api/v1/tournaments/[id]/side-pools/route.ts","utf8");assert.match(route,/get_tournament_role/);assert.match(route,/director.*co_director/);assert.match(route,/requireVerifiedSubject/);assert.doesNotMatch(route,/requireTournamentAccess/);});
test("the Finalize Reconciled Side Pool gate says on screen why it is unavailable",()=>{
 const client=readFileSync("src/app/tournament/[tournamentId]/side-pools/side-pools-client.tsx","utf8");
 // The button is gated on a posted policy and on collected matching paid. A
 // director looking at a pool that is out of balance must be told the shortfall,
 // not left with a control that looks broken.
 assert.match(client,/Post the payout schedule above before finalizing/);
 assert.match(client,/This is disabled because \$\{money\(pool\.collectedMinor\)\} was collected and \$\{money\(pool\.paidMinor\)\} was paid out/);
 assert.match(client,/money\(Math\.abs\(pool\.collectedMinor - pool\.paidMinor\)\)/);
 const reason=client.indexOf("This is disabled because ${money(pool.collectedMinor)}");
 const button=client.indexOf("Finalize Reconciled Side Pool");
 assert.ok(reason>-1&&reason<button,"the reason must render above the button it explains");
});
