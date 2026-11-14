import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
const sql=await fs.readFile('database/proposals/native-mixed-admission-funding-source-v1.sql','utf8');
const compact=sql.replace(/\s+/g,' ').toLowerCase();
test('candidate admission funding dispatch is private gated read-only and has no legacy fallback',()=>{
 assert.equal((compact.match(/create or replace function/g)||[]).length,1);
 assert.ok(compact.includes('app.native_mixed_admission_enabled_v1()is distinct from true'));
 assert.ok(compact.includes('app.native_mixed_funding_enabled_v1()is distinct from true'));
 assert.ok(compact.includes('language plpgsql volatile security definer set search_path='));
 assert.ok(compact.includes("set timezone='utc'"));
 assert.ok(compact.includes('from public,anon,authenticated,service_role'));
 assert.doesNotMatch(compact,/\b(insert into|update app\.|delete from|grant execute|create table)\b/u);
 assert.doesNotMatch(compact,/app\.(synthetic_mixed_finance_scopes_v1|synthetic_mixed_finance_bindings_v1|event_prize_schedule_bindings_v1|prize_accounting_finals_v9)/u);
});
test('funding dispatch binds current intent and preserves independent current scoring enrollment',()=>{
 for(const part of ['app.native_mixed_funding_seal_source_v1(tid,eid)',
  "funding#>>'{scope,admissionintentid}'is distinct from intent.id::text",
  "funding#>>'{scope,admissionintentversion}'is distinct from intent.version::text",
  "funding#>>'{scope,admissionsourcedigest}'is distinct from intent.source_digest",
  "funding#>>'{scope,operationalbindingid}'is distinct from intent.operational_binding_id::text",
  'app.native_mixed_admission_score_history_empty_v1(tid,eid)is distinct from true',
  "coalesce(funding->>'sourcedigest','')!~'^[a-f0-9]{64}$'",
  'app.assert_synthetic_mixed_current_v1(tid,eid)',
  "k.protocol_kind='synthetic-mixed-18-v2'",'k.source_sha256=fixture.source_sha256',
  'app.synthetic_mixed_enrollment_kinds_v2 in share mode nowait',
  "fixture.source_sha256 is distinct from encode(extensions.digest(fixture.source_snapshot::text,'sha256'),'hex')",
  'm.game_id=g.id','m.side_a_participant_id=g.side_a_participant_id','m.side_b_participant_id=g.side_b_participant_id',
  'm.base_game_version=g.version',"'funding',funding,'scoringfixture',to_jsonb(fixture)"])
  assert.ok(compact.includes(part),part);
});
test('dispatch cannot assert ordinary financial, attendance or payout authority',()=>{
 for(const flag of ['optionalpoolsourceavailable','assessmentsourceavailable','paidcheckinauthorized','ordinarycheckinsource',
  'actualmoneyreceived','bankreceiptverified','moneymoved','refundauthorized','payoutauthorized','finalizationauthorized'])
  assert.ok(compact.includes(`funding->'${flag}'is distinct from'false'::jsonb`),flag);
 for(const flag of ['sourceavailablev2','paidcheckinauthorized','ordinarycheckinsource','actualmoneyreceived','bankreceiptverified','moneymoved','refundauthorized','payoutauthorized','finalizationauthorized'])
  assert.ok(compact.includes(`'${flag}',false`),flag);
});
