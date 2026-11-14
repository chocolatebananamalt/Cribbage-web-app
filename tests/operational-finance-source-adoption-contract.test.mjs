import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../database/proposals/operational-finance-source-adoption-v1.sql',import.meta.url),'utf8');
const compact=sql.replace(/\s+/g,' ').toLowerCase();

test('adoption remains private, hard-disabled and proposal-only',()=>{
 assert.match(compact,/operational_finance_source_adoption_enabled_v1\(\).*select false/);
 assert.match(compact,/force row level security/);
 assert.match(compact,/revoke all on table app\.operational_event_finance_source_adoptions_v1 from public,anon,authenticated,service_role/);
 assert.match(compact,/proposalonly',true,'moneymoved',false,'payoutauthorized',false,'finalizationauthorized',false/);
 assert.doesNotMatch(compact,/service_role\s*\)/);
 assert.doesNotMatch(compact,/set_config\s*\(/);
});

test('writer pins twelve request fields and eight disposition fields',()=>{
 for(const field of ['expectedpriorrevisionid','expectedpriorsourcedigest','expectedpriorbasisdigest','expectedcurrentsourcedigest','expectedcurrentbasisdigest','expectedunchangedframedigest','dispositions','editor','reason'])assert.ok(compact.includes(`'${field}'`),field);
 assert.match(compact,/count\(\*\)from jsonb_object_keys\(request_value\)\)<>12/);
 assert.match(compact,/count\(\*\)from jsonb_object_keys\(d\)\)<>8/);
 assert.match(compact,/jsonb_typeof\(d->'kind'\)is distinct from'string'/);
 for(const kind of ['carry_native','restore_native','replace_manual','introduce_recorded','retire_voided_manual','retire_zero_manual'])assert.ok(compact.includes(`'${kind}'`),kind);
 assert.match(compact,/retire_zero_manual'and\( lineage#>>'\{latest,voided\}'<>'false'/);
});

test('locked current sources, complete lineage coverage and immutable sidecar guard adoption',()=>{
 assert.match(compact,/operational_event_finance_source_v1\(tid,eid,actor\)/);
 assert.match(compact,/operational_finance_adoption_frame_digest_v1\(prior_source\)/);
 assert.match(compact,/array_length\(seen_prior,1\).*<>lineage_count/);
 assert.match(compact,/array_length\(seen_current,1\).*<>current_count/);
 assert.match(compact,/disposition_coverage_incomplete/);
 assert.match(compact,/income_rebind_capture/);
 assert.match(compact,/adoption\.current_source_digest=head\.source_digest/);
 assert.match(compact,/disposition->>'currentbasislineid'=line_id::text/);
 assert.match(compact,/snapshotlabel',coalesce\(adoption_label,latest->>'label'\)/);
 assert.match(compact,/unfinished_retained_form/);
 assert.match(compact,/stale_override_plan/);
 assert.match(compact,/fresh_override_plan is distinct from jsonb_build_object/);
 assert.match(compact,/operational_event_finance_source_adoptions_v1_immutable/);
 assert.match(compact,/native_playoff_final_award_sets_v1/);
 assert.match(compact,/legacy_financial_liability_exists_v1/);
});

test('native costs remain actual immutable expense events and sanctioning is metadata only',()=>{
 assert.match(compact,/from app\.tournament_expense_events newer where newer\.expense_id=expense\.expense_id and newer\.version>expense\.version/);
 assert.ok(compact.includes("physical_bucket:=expense.id::text||':'||(part->>'bucket')"));
 assert.match(compact,/allocated>expense\.amount_minor/);
 assert.match(compact,/native_sanctioning_coverage_v1\(tid,eid/);
 assert.doesNotMatch(compact,/insert into app\.tournament_expense_events/);
 assert.doesNotMatch(compact,/insert into app\.native_ledger_allocation_revisions_v1/);
});

test('public wrappers derive auth uid and grant only narrow authenticated execute',()=>{
 assert.match(compact,/actor:=app\.require_operational_provider_official_v1\(tid\)/);
 assert.match(compact,/get_native_event_ledger_sources_v1\(tid\)/);
 assert.match(compact,/grant execute on function %s to authenticated/);
 assert.doesNotMatch(compact,/grant execute on function %s to anon/);
});
