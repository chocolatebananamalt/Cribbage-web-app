import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const source=fs.readFileSync('database/proposals/native-mixed-qualification-review-provider-v1.sql','utf8');
const sql=source.replace(/--[^\n]*/g,'');
test('read-only provider exposes only normal own-session two-argument transport and closes every grant',()=>{
 assert.match(sql,/create function public\.get_native_mixed_qualification_review_provider_v1\(p_tournament_id uuid,p_event_id uuid\)returns jsonb/);
 assert.match(sql,/security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'/);
 assert.match(sql,/auth\.role\(\)is distinct from'authenticated'/);
 assert.equal((sql.match(/native_mixed_game_own_subject_v1\(\)/g)||[]).length,2);
 assert.match(sql,/session_value:=\(auth\.jwt\(\)->>'session_id'\)::uuid/);
 assert.match(sql,/alter function public\.get_native_mixed_qualification_review_provider_v1\(uuid,uuid\)owner to postgres/);
 assert.match(sql,/revoke all on function public\.get_native_mixed_qualification_review_provider_v1\(uuid,uuid\)\s+from public,anon,authenticated,service_role/);
 assert.doesNotMatch(sql,/\b(insert|update|delete|grant|set_config|execute|create table)\b/i);
});
test('current role and read-only bounded pilot permission surround unchanged authoritative review proof',()=>{
 const role=/and role in\('director','co_director'\)for share nowait/g;
 const permission=/native_mixed_pilot_permitted_v1\(actor,p_tournament_id,p_event_id,false\)/g;
 assert.equal([...sql.matchAll(role)].length,2);assert.equal([...sql.matchAll(permission)].length,2);
 const proof=sql.indexOf('review_value:=app.native_mixed_qualification_review_v1');
 assert(sql.search(role)<proof);assert(sql.lastIndexOf("and role in('director','co_director')for share nowait")>proof);
 assert(sql.search(permission)<proof);assert(sql.lastIndexOf('native_mixed_pilot_permitted_v1')>proof);
 assert.match(sql,/select \* into st from app\.native_mixed_simulation_starts_v1\s+where tournament_id=p_tournament_id and event_id=p_event_id for share nowait/);
 assert.match(sql,/native_mixed_qualification_review_v1\(p_tournament_id,p_event_id,st\.id\)/);
 for(const [key,value]of [['tournamentId','p_tournament_id::text'],['eventId','p_event_id::text'],['startId','st.id::text'],['startSourceDigest','st.source_digest']])
  assert(sql.includes(`review_value->>'${key}'is distinct from ${value}`));
 assert.match(sql,/review_value->>'status'is distinct from'review_available'/);
 assert.match(sql,/exception when invalid_text_representation or lock_not_available then return null/);
 assert.doesNotMatch(sql,/jsonb_build_object\('status'|source_busy|coalesce\(review_value/);
});
test('available envelope has exact scope/session/review fields and foundational proof bytes remain reviewed',()=>{
 const envelope=sql.match(/return jsonb_build_object\(([\s\S]*?)\);/)[1];
 assert.deepEqual([...envelope.matchAll(/'([^']+)'/g)].map(x=>x[1]),['kind','native-mixed-review-provider-v1','actorId','sessionId','tournamentId','eventId','review']);
 assert.match(sql,/\(auth\.jwt\(\)->>'session_id'\)is distinct from session_value::text/);
 for(const [path,hash]of [
  ['database/proposals/native-mixed-qualification-review-v1.sql','ee216fee4313839e99b0176aa5be78bdd3eb163d6540805f3a43d4a0939b7459'],
  ['database/release-packages/native-preparation51/supabase/migrations/20261107090229_native_preparation51_closed_install.sql','22f9145694802d79d13d50ab36d52e8dc030b1f86649b9cb8a5f2fe733187f58'],
 ])assert.equal(createHash('sha256').update(fs.readFileSync(path)).digest('hex'),hash,path);
});
test('all direct reader and resolver predecessors exist in the unchanged 51-source package',()=>{
 const p=fs.readFileSync('database/release-packages/native-preparation51/supabase/migrations/20261107090229_native_preparation51_closed_install.sql','utf8');
 for(const name of ['native_mixed_game_own_subject_v1','native_mixed_game_root_current_v1','native_mixed_game_complete_with_start_v1','native_mixed_funding_seal_source_v1','native_mixed_simulation_hash_v1','native_mixed_pilot_permitted_v1'])
  assert(p.includes(`create function app.${name}(`),name);
 for(const name of ['native_mixed_simulation_starts_v1','native_mixed_game_evidence_v1','native_mixed_game_artifacts_v1','native_mixed_attendance_seals_v1','native_mixed_attendance_scopes_v1'])
  assert(p.includes(`create table app.${name}(`),name);
 assert.match(p,/unique\(tournament_id,event_id\),unique\(actor_id,operation_id\)/);
 assert.doesNotMatch(p,/create function (?:app\.native_mixed_qualification_review|public\.get_native_mixed_qualification_review_provider)_v1\(/);
 // Public CI pins the complete published51 migration above.
 // Private 51-source decomposition checks remain in the local QA packet.
});
