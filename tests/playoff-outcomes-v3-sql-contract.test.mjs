import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync('docs/quality/2026-10-27-proposed-0240-playoff-outcomes-v3.sql','utf8');
const fixture=readFileSync('tests/playoff-outcomes-v3.sql','utf8');
test('v3 proposal derives source outcomes from exact canonical series and separates legacy authority',()=>{
 assert.match(sql,/qids\[1\],qids\[4\]/);assert.match(sql,/qids\[2\],qids\[3\]/);assert.match(sql,/wf=any\(array\[w0,w1\]\)/);
 assert.match(sql,/pm:=7\*\(wins\+1\)\*\(wins\+2\)\/2/);
 assert.match(sql,/'bandEnd',case when qid=wf then 1 when qid=lf then 2 else 4/);
 assert.match(sql,/bracket_source_version/);assert.match(sql,/mrp_source_version/);
 assert.doesNotMatch(sql,/insert into app\.(?:card_scorelines|standard_singles_playoff_placement_rows|standard_singles_settlement_drafts)/);
 assert.match(sql,/returns text[\s\S]*return 'legacy_conflict'/);
 assert.equal((sql.match(/:=app\.playoff_outcome_blocker_v3\(/g)??[]).length,2);
 assert.doesNotMatch(sql,/\b(?:select|perform|between|and|or|then|else|limit|in)\d/);
});
test('proposal is append-only, scoped, serialized, audited, and fail-closed for old writers',()=>{
 assert.match(sql,/force row level security/);assert.match(sql,/reject_immutable_history/);
 assert.match(sql,/set search_path=''/);assert.match(sql,/standard-singles-post-event:/);
 assert.match(sql,/actor_profile_id=p_actor_id and client_operation_id=p_operation_id/);
 assert.match(sql,/existing\.request_hash=request_hash/);assert.match(sql,/stale_version/);
 assert.match(sql,/foreign key\(supersedes_id,tournament_id,event_id\)/);
 assert.match(sql,/insert into app\.audit_events/);assert.match(sql,/from public,anon,authenticated/);
 assert.match(sql,/save_standard_singles_settlement_draft_v4/);assert.match(sql,/finalize_standard_singles_settlement_manual_v1/);
 assert.match(sql,/revoke execute on function public\.record_standard_singles_playoff_placements_v2/);
 assert.match(sql,/notify pgrst,'reload schema'/);
});
test('rollback fixture is isolated and labels synthetic evidence',()=>{
 for(const marker of ['fixture_0240','fixture_legacy_acl_before','legacy reader/reconciliation ACL owner or search_path changed','set local role anon','set local role authenticated','set local role service_role','wrong finalist accepted','wrong seed slots accepted','client derived claim accepted','outsider write accepted','outsider reconciliation accepted','wrong tournament reconciliation accepted','null expected version accepted','exact accepted replay failed','changed key did not conflict','stale version accepted','append correction failed','immutable delete accepted','closed exact replay failed','legacy conflict accepted','legacy settlement still writable','revoked legacy writer executed','direct table privilege exposed','rollback;'])assert.ok(fixture.includes(marker),marker);
 assert.match(fixture,/LOCAL DATABASE ONLY/);assert.match(fixture,/not hosted tournament or played-game evidence/);
});
