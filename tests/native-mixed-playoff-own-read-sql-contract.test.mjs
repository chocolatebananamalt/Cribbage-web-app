import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const sql=fs.readFileSync('database/proposals/native-mixed-playoff-own-read-v1.sql','utf8');

test('own playoff projection remains private, default gated and read-only',()=>{
 assert.match(sql,/native_mixed_playoff_enabled_v1\(\)is distinct from true then return null/);
 assert.match(sql,/revoke all on function app\.get_native_mixed_playoff_own_v1\(uuid,uuid\)from public,anon,authenticated,service_role/);
 assert.doesNotMatch(sql,/\bgrant\b|\binsert into\b|\bupdate app\.|\bdelete from\b/i);
});
test('own identity and current source/history are checked instead of accepting a caller profile',()=>{
 assert.match(sql,/actor:=app\.native_mixed_pool_actor_v1\(\)/);
 assert.match(sql,/x->>'mode'='digital'and x->>'profileId'=actor::text/);
 assert.match(sql,/c\.source_capture is distinct from source->'capture'/);
 assert.match(sql,/native_mixed_playoff_row_bound_v1\(c\.id,'context'\)/);
 assert.match(sql,/native_mixed_playoff_completion_bound_v1\(c\.id\)/);
 assert.match(sql,/native_mixed_pool_actor_v1\(\)is distinct from actor/);
});
test('counteranswers stay blind until the exact own player has submitted that game',()=>{
 assert.match(sql,/game_number=\(g->>'gameNumber'\)::integer and entry->>'type'='digital-submit'\s+and entry->>'participantId'=own_id::text and actor_id=actor/);
 assert.match(sql,/game_number=\(g->>'gameNumber'\)::integer and own_submitted order by sequence/);
 assert.match(sql,/'winnerParticipantId',case when own_submitted then g->'winnerId'else'null'::jsonb end/);
 assert.match(sql,/'counterEvidenceAvailable',own_submitted,'entries',entries/);
 assert.doesNotMatch(sql,/jsonb_build_object\([^;]*'actorId'|jsonb_build_object\([^;]*'profileId'/);
});
test('own opponent uses fixed tournament number; server supplies exact new-game CAS',()=>{
 assert.match(sql,/'tournamentIdNumber',other_person->'fixedTournamentId'/);
 assert.match(sql,/'displayName',\(select claimed_display_name/);
 assert.match(sql,/'expectedRevision',coalesce\(g->'revision','0'::jsonb\)/);
 assert.match(sql,/'expectedHistoryDigest',coalesce\(g->'historyDigest',to_jsonb\(app\.native_mixed_simulation_hash_v1/);
 assert.doesNotMatch(sql,/claimed_acc_number|claimed_email|to_jsonb\(c\)|'cards',|'roster',/);
});
