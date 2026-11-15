import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const proposal = fs.readFileSync('docs/quality/2026-10-27-proposed-0239-hybrid-workspace.sql', 'utf8');
const original = fs.readFileSync('database/migrations/0148_hybrid_digital_paper_authoritative_completion.sql', 'utf8');
const fixture = fs.readFileSync('tests/hybrid-dual-role-workspace.sql', 'utf8');
const start = original.indexOf('create or replace function public.get_hybrid_game_workspace_v1(');
const reader = original.slice(start, original.indexOf('end $$;', start) + 7);

test('workspace fix only changes role precedence inside the existing reader', () => {
  const fixed = reader.replace("order by case role when 'director' then 1 when 'co_director' then 2 else 3 end limit 1;", "order by case role when 'cross_checker' then 1 when 'director' then 2 else 3 end limit 1;");
  assert.ok(proposal.includes(fixed));
  assert.notEqual(fixed, reader);
  assert.equal((proposal.match(/create or replace function/g) ?? []).length, 1);
  assert.match(proposal, /revoke all on function[^;]+from public,anon,authenticated/);
  assert.match(proposal, /grant execute on function[^;]+to service_role/);
  assert.doesNotMatch(proposal, /insert into|update app\.|delete from|create table/i);
});

test('rollback regression covers dual-role capability, negative identity, and distinct review', () => {
  for (const marker of ['initial_seating_publications', 'initial_seating_assignments', 'workspace service-only boundary failed', 'single cross checker unbound workspace failed', 'unbound dual role workspace failed', 'player workspace disclosed', 'bound single cross checker hidden', 'director cross checker overlap hidden', 'cross tournament workspace disclosed', 'bound dual role candidate hidden', 'director acquired capture', 'co director acquired capture', 'first official can see self review', 'distinct director review hidden', 'not_eligible_reviewer', 'rollback;']) assert.ok(fixture.includes(marker), marker);
  assert.match(proposal, /v_role='cross_checker' and app\.paper_official_identity_is_current_valid/);
  assert.match(proposal, /c\.first_official_profile_id<>p_actor_id/);
  assert.match(proposal, /app\.paper_official_is_independent/);
});
