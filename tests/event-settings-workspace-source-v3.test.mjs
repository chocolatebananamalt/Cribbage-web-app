// Static source contracts only: no SQL execution or transaction proof.
import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';
const sql=fs.readFileSync('database/proposals/event-settings-workspace-v3.sql','utf8');
test('workspace candidate remains owner-private with no transport or grants',()=>{
 assert.match(sql,/UNEXECUTED private reader/);assert.doesNotMatch(sql,/^\s*grant\s/im);assert.doesNotMatch(sql,/create(?: or replace)? function public\./i);assert.match(sql,/security definer set search_path=''set timezone='UTC'/);assert.match(sql,/owner to postgres/);assert.match(sql,/from public,anon,authenticated,service_role/);assert.doesNotMatch(sql,/\b(?:insert into|update app\.|delete from)\b/i);
});
test('authenticated subject and current director role are locked before source reads',()=>{
 assert.match(sql,/a uuid:=auth.uid\(\)/);assert.match(sql,/transaction_isolation[^\n]+read committed/);const tournament=sql.indexOf('for share nowait'),role=sql.indexOf('for key share nowait'),base=sql.indexOf('base_reply:=app.get_custom_q_setup_base_v2');assert.ok(tournament>0&&role>tournament&&base>role);assert.match(sql,/role in\('director','co_director'\)/);assert.match(sql,/exception when lock_not_available/);
});
test('full setup/current revision/snapshot are same-tournament bound and verified before response',()=>{
 assert.match(sql,/setup_workspace:=public.get_tournament_setup_workspace\(p_tournament_id\)/);assert.match(sql,/where tournament_id=p_tournament_id order by version desc/);assert.match(sql,/where tournament_id=p_tournament_id and setup_revision_id=rev.id/);assert.match(sql,/base->>'setupRevisionId'is distinct from rev.id::text/);assert.match(sql,/current_setup->>'revisionId'is distinct from rev.id::text/);assert.match(sql,/current_setup->'version'is distinct from to_jsonb\(rev.version\)/);assert.match(sql,/settings_snapshot_unavailable/);assert.doesNotMatch(sql,/coalesce\(snapshot.effective_settings/);assert.match(sql,/app.valid_event_parameters_raw_v3/);assert.match(sql,/row_id=any\(seen\)/);assert.match(sql,/event_kind in\('main','consolation'\)/);
});
test('initial empty source is explicit; base reread and exact handler workspace fields remain',()=>{
 assert.match(sql,/base->'setupRevisionId'is distinct from'null'::jsonb/);assert.match(sql,/base->'setupVersion'is distinct from'0'::jsonb/);assert.match(sql,/again:=app.get_custom_q_setup_base_v2/);assert.match(sql,/again->'base'is distinct from base/);assert.match(sql,/jsonb_build_object\('actorId',a,'tid',p_tournament_id,'base',base,'currentSnapshot',current_snapshot\)/);assert.match(sql,/'kind','event-settings-snapshot-v3','tournamentId',p_tournament_id,'setupRevisionId',rev.id,'setupVersion',rev.version,'settings',snapshot.effective_settings/);
});
