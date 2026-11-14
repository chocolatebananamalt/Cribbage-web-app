import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const sql=fs.readFileSync('database/proposals/native-mixed-playoff-v1.sql','utf8');
test('private atomic default-off candidate has no grants or ordinary sporting/financial writes',()=>{
 assert.match(sql,/^begin;$/m);assert.match(sql,/commit;\s*$/);
 assert.match(sql,/native_mixed_playoff_enabled_v1\(\)returns boolean\s+language sql immutable set search_path=''as \$\$select false\$\$/);
 assert.doesNotMatch(sql,/\bgrant\s+(execute|all|usage|select|insert)\b/i);
 const writes=[...sql.matchAll(/\b(?:insert into|update|delete from)\s+app\.([a-z0-9_]+)/gi)].map(x=>x[1]);
 assert(writes.length>5);assert(writes.every(x=>x.startsWith('native_mixed_playoff_')||['operation_receipts','audit_events'].includes(x)));
 assert.match(sql,/force row level security/);assert.match(sql,/before update or delete/);assert.match(sql,/before truncate/);
});
test('sporting-authority clone pins actual normalized definition and never substitutes caller JWT',()=>{
 const original=fs.readFileSync('database/proposals/native-mixed-qualification-review-v1.sql','utf8').replaceAll('\r\n','\n');
 assert(sql.includes('e326b89c4d21a982a324e04c5a9a229f016350e9f666234debdccaf5c7ac2bdd'));
 const anchor=" perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor\n  and role in('director','co_director')for share nowait;";
 assert.equal(original.split(anchor).length-1,1);
 assert.match(sql,/start_row\.id=sid and start_row\.tournament_id=tid and start_row\.event_id=eid/);
 assert.match(sql,/role_row\.profile_id=start_row\.actor_id and role_row\.role='?'?director/);
 assert.match(sql,/caller-role anchor changed/);assert.match(sql,/clone postcondition changed/);
 assert.doesNotMatch(sql,/set_config|set local role|request\.jwt\.claims|actor\s*:=\s*.*start_row/i);
});
test('actual source pins review, saved settings and exact five seeds without ordinary qualification coercion',()=>{
 assert.match(sql,/qualificationReady'is distinct from'true'/);assert.match(sql,/tieReviewRequired'is distinct from'false'/);
 assert.match(sql,/entrantCount'is distinct from'18'/);assert.match(sql,/qualifyingCount'is distinct from'5'/);
 assert.match(sql,/assessment:=app\.assess_event_rule_draft_v1\(b\.draft,b\.context\)/);
 assert.match(sql,/settingsBinding',to_jsonb\(b\)/);assert.match(sql,/settingsSnapshot',to_jsonb\(s\)/);
 assert.match(sql,/array\[1,2,3,4,5\]/);assert.match(sql,/source_capture is distinct from source->'capture'/);
});
test('own actor, current roles, current paper identity and nonself precede receipt recovery',()=>{
 const own=sql.indexOf('actor:=app.native_mixed_pool_actor_v1()'),receipt=sql.indexOf('select*into old from app.operation_receipts');
 assert(own>0&&receipt>own);assert(sql.indexOf('paper_official_identity_is_current_valid(actor,tid)',own)<receipt);
 assert(sql.indexOf('p.profile_id=actor or p.roster_entry_id=binding.roster_entry_id',own)<receipt);
 assert.match(sql,/native_mixed_pilot_permitted_v1\(actor,tid,eid,true\)/);
 assert.match(sql,/historicalReceipt',true,'currentSourceVerified',false/);
 assert.match(sql,/idempotency_conflict/);assert.match(sql,/native_mixed_simulation_operation_reserved_v1\(actor,op\)/);
});
test('ordered complete counterevidence is required before own confirmation; no unplayed advancement',()=>{
 assert.match(sql,/jsonb_array_length\(submissions\)<>jsonb_array_length\(digital\)/);
 assert.match(sql,/jsonb_array_length\(paper\)>0 and review_entry is null/);
 assert.match(sql,/p->'evidenceIds'is distinct from refs/);assert.match(sql,/p->>'submissionId'/);
 assert.match(sql,/actor=capture_entry->>'actorId'/);assert.match(sql,/p->'reenteredClaims'is distinct from capture_entry->'claims'/);
 assert.match(sql,/winner is not null or n<>last_game\+1/);assert.match(sql,/wins_a=limit_wins or wins_b=limit_wins/);
 assert.match(sql,/firstPlace',3,'lastPlace',4/);assert.match(sql,/firstPlace',5,'lastPlace',5/);
});
test('receipt audit, exact per-game CAS and recursive result/completion replay are enforced',()=>{
 assert.match(sql,/r\.request_hash=app\.native_mixed_simulation_hash_v1/);assert.match(sql,/a\.after_state=r\.response_payload/);
 assert.match(sql,/revision<>\(data->>'expectedRevision'\)::integer or hd<>data->>'expectedHistoryDigest'/);
 assert.match(sql,/native_mixed_playoff_result_bound_v1\(r1\.id\)is distinct from true/);
 assert.match(sql,/native_mixed_playoff_result_bound_v1\(result_id\)is distinct from true/);
 assert.match(sql,/native_mixed_playoff_completion_bound_v1\(c\.id\)is distinct from true/);
 assert.match(sql,/last_e\.receipt_id=r\.receipt_id/);assert.match(sql,/v\.receipt_id=r\.receipt_id/);
});
test('each first write revalidates actual expiry/cohort and immutable evidence binds request coordinates and session',()=>{
 const inserts=[...sql.matchAll(/insert into app\.operation_receipts/g)];assert.equal(inserts.length,2);
 for(const i of inserts){const prefix=sql.slice(0,i.index);assert.match(prefix.slice(-400),/app\.native_mixed_pool_actor_v1\(\)is distinct from actor or app\.native_mixed_pilot_permitted_v1\(actor,tid,eid,true\)is distinct from true/);}
 assert.match(sql,/actor_session_id uuid not null/);
 for(const field of['contextId','slot','gameNumber','expectedMatchDigest','expectedRevision','expectedHistoryDigest'])assert(sql.includes(`d->${['slot','gameNumber','expectedRevision'].includes(field)?"'":">'"}${field}'`));
 assert.match(sql,/authority_capture,sessionId}'is distinct from v->>'actor_session_id'/);
 assert.match(sql,/authority_capture,actorId}'is distinct from v->>'actor_id'/);
 assert.match(sql,/v->'entry'is distinct from expected_entry/);assert.match(sql,/expected_entry:=jsonb_build_object\('id',row_id,'actorId'/);
 assert.match(sql,/artifactDigest',app\.native_mixed_simulation_hash_v1\(artifact\)/);
});
test('JSON entry extraction is explicitly grouped before text-key subtraction',()=>{
 assert(sql.includes("payload:=(data->'entry')-'type';"));
 assert.doesNotMatch(sql,/payload:=data->'entry'-'type'/);
});
