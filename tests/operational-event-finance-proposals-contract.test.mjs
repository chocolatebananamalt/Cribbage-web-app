import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const file=new URL('../database/proposals/operational-event-finance-proposals-v1.sql',import.meta.url);
const sql=fs.readFileSync(file,'utf8');

test('operational Finance proposal is default-off, private, immutable and event scoped',()=>{
 assert.match(sql,/operational_event_finance_proposals_enabled_v1\(\)returns boolean[\s\S]*?select false/);
 assert.match(sql,/foreign key\(event_id,tournament_id\)references app\.events\(id,tournament_id\)/);
 assert.match(sql,/foreign key\(binding_id\)references app\.event_settings_operational_bindings_v1\(id\)/);
 assert.match(sql,/foreign key\(native_allocation_revision_id,tournament_id\)[\s\S]*?native_ledger_allocation_revisions_v1/);
 assert.match(sql,/enable row level security[\s\S]*?force row level security/);
 assert.match(sql,/revoke all on table app\.%I from public,anon,authenticated,service_role/);
 assert.match(sql,/create trigger %I before update or delete[\s\S]*?reject_immutable_history/);
 assert.doesNotMatch(sql,/^\s*grant\b/im);
});

test('raw source binds operational settings and current native allocation without inventing actual funds',()=>{
 for(const marker of [
  "'kind','operational-event-finance-source-v1'",
  "'kind','operational-finance-estimate-basis-v1'",
  "'additionalIncome','unavailable'",
  "'optionalPools','isolated_regular_allocation'",
  "'recordedFundAvailable',false",
  "'mode','estimate'",
  "'proposalOnly',true",
  "'moneyMoved',false",
  "'finalizationAuthorized',false",
  "'payoutAuthorized',false",
 ])assert.ok(sql.includes(marker),marker);
 assert.match(sql,/allocation\.source_digest is distinct from current_native->>'sourceDigest'/);
 assert.match(sql,/where tournament_id=tid and event_id=eid/);
 assert.match(sql,/part->>'bucket'not in\('regular_entry','player_benefit','operating_expense'\)/);
 assert.match(sql,/part->'poolId'is distinct from'null'::jsonb/);
 assert.match(sql,/part->'classificationReviewed'is distinct from'true'/);
 assert.match(sql,/physicalEvidenceId'is distinct from source_id/);
 assert.match(sql,/qualification_resolution_snapshot_current_v1\(qualification\.id\)is distinct from true/);
 assert.match(sql,/'participantCount',qualification\.participant_count/);
 assert.match(sql,/qualification\.qualifier_count<>\(qualification\.participant_count\+3\)\/4/);
 assert.match(sql,/operational-finance-basis-line-v1\|/);
 assert.ok(sql.includes("(source_row->>'sourceId')||'|'||(part->>'bucket')"));
 assert.match(sql,/with ordinality x\(value,n\)/);
 assert.doesNotMatch(sql,/'unrestricted_income'.*Recorded allocation basis/);
});

test('save wire is exact seven keys and editor remains exact eight-key V1 shape',()=>{
 assert.match(sql,/count\(\*\)from jsonb_object_keys\(request_value\)\)<>7/);
 assert.match(sql,/array\['kind','operationId','expectedVersion','expectedSourceDigest','expectedBasisDigest','editor','reason'\]/);
 assert.match(sql,/count\(\*\)from jsonb_object_keys\(editor\)\)<>8/);
 assert.match(sql,/array\['basis','history','overrideHistory','overrideInput','overridePlan','lineForm','bandForm','message'\]/);
 assert.match(sql,/editor->'basis'is distinct from basis->'workspace'/);
 assert.match(sql,/expectedVersion'\)::numeric>2147483646/);
 assert.match(sql,/jsonb_typeof\(request_value->'kind'\)is distinct from'string'/);
 assert.match(sql,/head\.source_digest is distinct from source_value->>'sourceDigest'/);
 assert.match(sql,/source_revision_changed_requires_review/);
});

test('append-only history, explicit zero, incomplete forms and whole-band $5 constraints are mirrored',()=>{
 assert.match(sql,/jsonb_array_elements\(prior_editor->'history'\)with ordinality/);
 assert.match(sql,/jsonb_array_elements\(prior_editor->'overrideHistory'\)with ordinality/);
 assert.match(sql,/amountMinor'\)is distinct from'number'[\s\S]*?\^\(0\|\[1-9\]\[0-9\]\*\)\$/);
 assert.match(sql,/editor->'lineForm'<>'null'::jsonb/);
 assert.match(sql,/editor->'bandForm'<>'null'::jsonb/);
 assert.match(sql,/jsonb_typeof\(line->'category'\)is distinct from'string'/);
 assert.match(sql,/line->>'reason'is distinct from app\.custom_payout_classification_text_v2/);
 assert.match(sql,/old:=latest->\(line->>'lineId'\)/);
 assert.match(sql,/lastPlace'\)::integer>award_places/);
 assert.match(sql,/plan->'history'\)with ordinality/);
 assert.match(sql,/plan_fund:=gross-plan_benefit-plan_expense\+plan_income/);
 assert.match(sql,/perPersonMinor'\)::numeric%500<>0/);
 assert.match(sql,/custom_paid_ratio/);
 assert.match(sql,/\(first_place-1\)&\(first_place-2\)/);
 assert.match(sql,/overridePlan/);
});

test('replay, CAS, reconciliation and transient source contention are explicit',()=>{
 assert.match(sql,/pg_try_advisory_xact_lock\(hashtextextended\(a::text\|\|':'\|\|op::text,0\)\)/);
 assert.match(sql,/pg_try_advisory_xact_lock\(hashtextextended\('event-lifecycle:'\|\|eid::text,0\)\)/);
 assert.match(sql,/historicalReceipt',true,'currentSourceVerified',false/);
 assert.match(sql,/coalesce\(head\.version,0\)<>expected/);
 assert.match(sql,/stale_version/);
 assert.match(sql,/idempotency_conflict/);
 assert.match(sql,/exception when lock_not_available then return jsonb_build_object\('status','retry_exact','code','source_busy'\)/);
 assert.match(sql,/reconcile_operational_event_finance_proposal_v1/);
});
