import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

test('partial two-role SQL regression seeds nominations, then uses canonical explicit acceptance and rollback',async()=>{
 const sql=await readFile('tests/official-two-role-acceptance.sql','utf8');
 assert.match(sql,/one acceptance incorrectly completed both roles/);
 assert.match(sql,/other account accepted second role/);assert.match(sql,/expired second role accepted/);assert.match(sql,/removed second role accepted/);
 assert.match(sql,/explicit second acceptance has wrong scope/);assert.match(sql,/two-role replay duplicated audit\/receipt/);
 assert.match(sql,/accept_tournament_setup_official_nomination_by_id_v1\(nominee,co_nomination,co_operation\)/);
 assert.match(sql,/accept_tournament_setup_official_nomination_by_id_v1\(nominee,cross_nomination,cross_operation\)/);
 assert.doesNotMatch(sql,/insert into app\.tournament_roles[^;]*nominee/i);
 assert.match(sql,/set constraints all immediate;\s*rollback;\s*$/);
});
test('current paper-only self-binding allowance does not remove distinct hybrid reviewers',async()=>{
 const paper=await readFile('database/migrations/0223_one_official_can_complete_a_paper_game.sql','utf8');
 const mixed=await readFile('database/migrations/0148_hybrid_digital_paper_authoritative_completion.sql','utf8');
 assert.match(paper,/if position\('self_confirmation_denied' in v_new\) > 0 then\s*raise exception 'bind: the self confirmation code survived the replacement'/);
 assert.match(paper,/alter table app\.paper_official_identity_bindings drop constraint if exists paper_official_identity_bindings_check;/);
 assert.match(mixed,/p_actor_id=v_case\.first_official_profile_id[^;]*not_eligible_reviewer/);
});
