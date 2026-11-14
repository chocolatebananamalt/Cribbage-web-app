import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const path = 'database/proposals/native-mixed-funding-v1.sql';
const sql = await fs.readFile(path, 'utf8');
const compact = sql.replace(/\s+/g, ' ').toLowerCase();
const has = (...parts) => parts.forEach(part => assert.ok(compact.includes(part.toLowerCase()), `missing ${part}`));

test('native mixed funding is private immutable default-off journal groundwork', () => {
  has('create function app.native_mixed_funding_enabled_v1()returns boolean', 'as $$select false$$',
    "alter table app.%i force row level security", "revoke all on table app.%i from public,anon,authenticated,service_role",
    'execute function app.reject_immutable_history()', 'revoke all on function %s from public,anon,authenticated,service_role');
  for (const table of ['operations', 'scopes', 'contexts', 'obligations', 'receipts', 'provenance', 'outcomes'])
    has(`create table app.native_mixed_funding_${table}_v1`);
  assert.doesNotMatch(sql, /grant\s+execute/iu);
  assert.doesNotMatch(sql, /create\s+function\s+public\./iu);
  assert.doesNotMatch(sql, /insert\s+into\s+app\.(roster_payment|tournament_expense|q_pool|event_side_pool)/iu);
  for (const flag of ['actual_money_received', 'bank_receipt_verified', 'money_moved', 'refund_authorized', 'payout_authorized', 'finalization_authorized'])
    has(`${flag} boolean not null default false check(not ${flag})`);
});

test('quarantine begins at admission intent and excludes all other financial domains', () => {
  has("'app.synthetic_mixed_fixtures_v1','app.synthetic_mixed_finance_scopes_v1'",
    "'app.native_mixed_admission_intents_v1','app.native_mixed_funding_scopes_v1'",
    "if not exists(select 1 from pg_catalog.pg_attribute where attrelid=r and attname='tournament_id'",
    'exception when undefined_table or undefined_column then return null',
    'create function app.native_mixed_funding_other_domains_idle_v1',
    'from app.synthetic_mixed_finance_scopes_v1 where tournament_id=tid',
    'from app.synthetic_paper_fixtures_v1 where tournament_id=tid and event_id=eid',
    'from app.multi_event_finance_modes_v1 where tournament_id=tid',
    'from app.native_optional_pool_ownership_revisions_v2 where tournament_id=tid and event_id=eid',
    'from app.native_optional_finance_revisions_v2 where tournament_id=tid and event_id=eid',
    'from app.native_optional_fund_reviews_v2 where tournament_id=tid and event_id=eid',
    'from app.native_unrestricted_income_sources_v1 where tournament_id=tid and event_id=eid',
    'create or replace function app.native_mixed_admission_operation_reserved_v1',
    'from app.native_mixed_funding_operations_v1 where actor_id=actor and operation_id=op');
  assert.equal((compact.match(/app\.native_mixed_funding_other_domains_idle_v1\(tid,eid\)is distinct from true/g) ?? []).length, 3);
  has('app.synthetic_mixed_finance_scopes_v1,app.synthetic_paper_fixtures_v1,app.multi_event_finance_modes_v1',
    'app.native_optional_pool_ownership_revisions_v2,app.native_optional_finance_revisions_v2,app.native_optional_fund_reviews_v2',
    'app.native_unrestricted_income_sources_v1,app.native_unrestricted_income_records_v1,app.native_optional_income_records_v2');
});

test('scope and entry writes bind the exact admission source before Start or scoring', () => {
  has("v->>'kind'='native-mixed-funding-scope-v1'", "v->>'kind'='native-mixed-funding-entry-v1'",
    "v->'expectedversion'='0'::jsonb", "name like'test only%'for update nowait",
    "profile_id=actor and role='director'for key share nowait", 'app.native_mixed_admission_base_source_v1(tid,eid)',
    'app.native_mixed_funding_lifecycle_open_v1(tid,eid)is distinct from true',
    'not exists(select 1 from app.event_play_starts where tournament_id=tid and event_id=eid)',
    'app.native_mixed_admission_score_history_empty_v1(tid,eid)is true',
    "entry_fee_minor between 300 and 500399958596721 and entry_fee_minor%100=0",
    "simulatedreceivedat')~'^[0-9]{4}-[0-9]{2}-[0-9]{2}t[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}z$",
    "to_char(received at time zone'utc','yyyy-mm-dd\"t\"hh24:mi:ss.ms\"z\"')<>request->>'simulatedreceivedat'");
  assert.ok(compact.indexOf('perform app.lock_native_ledger_sources_v1()') < compact.indexOf('perform app.lock_event_settings_playoff_sources_v1()'));
  const scope = compact.slice(compact.indexOf('create function app.save_native_mixed_funding_scope_v1'), compact.indexOf('create function app.record_native_mixed_funding_entry_v1'));
  const entry = compact.slice(compact.indexOf('create function app.record_native_mixed_funding_entry_v1'), compact.indexOf('-- owner-only complete projection'));
  for (const body of [scope, entry]) assert.ok(body.indexOf("role='director'for key share nowait") < body.indexOf('select*into old'));
});

test('complete source reconstructs accepted operations contexts provenance and exact roster coverage', () => {
  has('app.native_mixed_funding_scope_bound_v1(s.id)is distinct from true',
    'app.native_mixed_funding_entry_bound_v1(o.id)is distinct from true',
    "o.request_payload->>'expectedscopedigest'=s.source_digest", "c.request_hash=o.request_hash",
    "x.result=jsonb_build_object('kind','native-mixed-funding-receipt-v1'",
    "pb.row_digest=encode(extensions.digest(to_jsonb(b)::text,'sha256'),'hex')",
    "pr.row_digest=encode(extensions.digest(to_jsonb(r)::text,'sha256'),'hex')",
    'from app.native_mixed_funding_contexts_v1 where scope_id=s.id)<>18',
    'where c.scope_id=s.id)<>36', "where o.tournament_id=tid and o.event_id=eid and o.action='entry')<>18",
    "from jsonb_array_elements(base->'roster') b where not exists(",
    "o.profile_id is not distinct from nullif(b->>'profileid','')::uuid",
    'obligation_total is distinct from s.entry_fee_minor*18', 'receipt_total is distinct from obligation_total',
    "'sourcedigest',digest");
  has("s.source_capture=jsonb_build_object('kind','native-mixed-funding-scope-source-v1'",
    "s.source_digest=encode(extensions.digest(convert_to(jsonb_build_array(",
    's.admission_intent_version=i.version', 's.admission_source_digest=i.source_digest',
    's.operational_binding_id=i.operational_binding_id');
});

test('source DTO is exact simulation-only evidence with canonical timestamps and no attendance authority', () => {
  has("'status','source_available','kind','native-mixed-funding-source-v1'",
    "'entrycount',18,'obligationminor',obligation_total,'receiptminor',receipt_total",
    "to_char(r.simulated_received_at at time zone'utc','yyyy-mm-dd\"t\"hh24:mi:ss.ms\"z\"')",
    "'optionalpoolsourceavailable',false,'assessmentsourceavailable',false,'paidcheckinauthorized',false,'ordinarycheckinsource',false",
    "'actualmoneyreceived',false,'bankreceiptverified',false,'moneymoved',false,'refundauthorized',false,'payoutauthorized',false,'finalizationauthorized',false",
    'these rows still do not satisfy qr/desk paid attendance or', 'normal start');
  assert.doesNotMatch(sql, /insert\s+into\s+app\.event_check_in_events/iu);
  assert.doesNotMatch(sql, /insert\s+into\s+app\.event_play_starts/iu);
  assert.doesNotMatch(sql, /event_qr_player_is_paid_and_enrolled/iu);
});

test('hash construction is UTC-pinned and admission corrections cannot strand funding', () => {
  has("alter function app.native_mixed_admission_base_source_v1(uuid,uuid)set timezone='utc'",
    "alter function app.save_native_mixed_admission_intent_v1(uuid,uuid,uuid,jsonb)set timezone='utc'",
    "alter function app.seal_native_mixed_admission_v1(uuid,uuid,uuid,jsonb)set timezone='utc'",
    "native_mixed_funding_scope_bound_v1(scope_value uuid)returns boolean language sql stable security definer set search_path=''set timezone='utc'",
    "save_native_mixed_funding_scope_v1(actor uuid,tid uuid,eid uuid,request jsonb)returns jsonb language plpgsql security definer set search_path=''set lock_timeout='250ms'set timezone='utc'",
    "record_native_mixed_funding_entry_v1(actor uuid,tid uuid,eid uuid,request jsonb)returns jsonb language plpgsql security definer set search_path=''set lock_timeout='250ms'set timezone='utc'",
    "native_mixed_funding_seal_source_v1(tid uuid,eid uuid)returns jsonb language plpgsql volatile security definer set search_path=''set timezone='utc'",
    'native_mixed_admission_finance_idle_before_funding_v1',
    'and not exists(select 1 from app.native_mixed_funding_scopes_v1 where tournament_id=tid and event_id=eid)');
  assert.match(sql, /do \$\$declare d text;p text;begin\s+d:=pg_get_functiondef/u);
});
