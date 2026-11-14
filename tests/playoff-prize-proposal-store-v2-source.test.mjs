import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../database/proposals/playoff-prize-proposal-store-v2.sql',import.meta.url),'utf8');
const body=name=>{const start=sql.indexOf(`create function ${name}(`);assert(start>=0,name);const next=sql.indexOf('create function ',start+1);return sql.slice(start,next<0?undefined:next);};

test('private store keeps independent default-off gates and revokes every function/table without old guard changes',()=>{
 for(const name of['read','write','recovery'])assert.match(body(`app.playoff_prize_proposal_${name}_enabled_v2`),/select false/);
 const definitions=[...sql.matchAll(/create function ([a-z0-9_.]+)\(/g)].map(x=>x[1]);assert.equal(definitions.length,17);
 for(const name of definitions)assert(sql.includes(`'${name}(`),`${name} missing final revoke inventory`);
 assert.match(sql,/revoke all on function %s from public,anon,authenticated,service_role/);assert.match(sql,/enable row level security/);assert.match(sql,/force row level security/);
 assert.match(sql,/n<>'playoff_prize_proposal_heads_v2'/);assert.match(sql,/app\.reject_immutable_history\(\)/);
 assert.doesNotMatch(sql,/\bgrant\s|create or replace|set_config|request\.jwt|payoutAuthorized',true/i);
 assert.equal([...sql.matchAll(/create function public\./g)].length,3);assert.match(sql,/reciprocal cross-domain UUID exclusion is NOT/);
});
test('raw JSON rejects recursive duplicate keys, negative zero and unsupported numeric/array/depth values before jsonb normalization',()=>{
 const safe=body('app.playoff_prize_proposal_json_safe_v2');assert.match(safe,/depth>32/);assert.match(safe,/json_array_length\(v\)>10000/);assert.match(safe,/n=trunc\(n\)and n between -9007199254740991 and 9007199254740991/);assert.match(safe,/not\(n=0 and raw~/);
 assert.match(safe,/count\(\*\)<>count\(distinct pair.key\)into duplicate_keys from json_each\(v\)pair/);assert.match(safe,/if duplicate_keys then return false/);assert.match(safe,/json_safe_v2\(item,depth\+1\)/);
 for(const name of['app.save_playoff_prize_proposal_v2','app.get_playoff_prize_proposal_operation_v2']){const code=body(name);assert(code.indexOf('playoff_prize_proposal_json_safe_v2(request_text::json,0)')<code.indexOf('request_value:=request_text::jsonb'));}
});
test('exact wire request and raw byte/hash/scope conflicts are immutable and actor-operation global within store',()=>{
 const save=body('app.save_playoff_prize_proposal_v2'),recover=body('app.get_playoff_prize_proposal_operation_v2');
 assert.match(sql,/primary key\(actor_id,operation_id\)/);assert.match(sql,/request_payload=request_text::jsonb/);
 for(const code of[save,recover]){assert.match(code,/actor uuid:=auth\.uid\(\)/);assert.match(code,/request_text\)>1000000/);assert.match(code,/digest\(convert_to\(request_text,'utf8'\),'sha256'\)/);assert.match(code,/journal\.request_text is distinct from request_text/);assert.match(code,/journal\.event_id is distinct from eid/);assert.match(code,/journal\.tournament_id is distinct from tid/);assert.match(code,/journal\.request_payload is distinct from request_value/);assert.match(code,/role in\('director','co_director'\).*for share nowait/);}
 for(const key of['kind','operationId','expectedRevisionId','nativeSourceDigest','input','overrideHistory','reason','mode','confirmed'])assert(body('app.valid_playoff_prize_proposal_request_v2').includes(`'${key}'`));
 assert.match(body('app.valid_playoff_prize_proposal_request_v2'),/confirmed'='true'::jsonb/);
});
test('historical exact replay precedes native/current checks and independent recovery never requires a current native source',()=>{
 const save=body('app.save_playoff_prize_proposal_v2'),recover=body('app.get_playoff_prize_proposal_operation_v2');
 assert(save.indexOf('return document;')<save.indexOf('app.get_playoff_prize_native_source_v2'));
 assert.doesNotMatch(recover,/get_playoff_prize_native_source|playoff_prize_proposal_heads/);assert.match(recover,/'unknown','operation_not_found'/);assert.match(recover,/'unknown','operation_incomplete'/);
 assert.match(body('app.playoff_prize_proposal_operation_document_v2'),/'requestText',journal\.request_text,'requestHash',journal\.request_hash,'result',outcome\.result/);
 assert.doesNotMatch(sql,/pendingCleared|replayed|thinAck/);
});
test('native source digest and exact full server capture bind revisions while co-directors compare complete stable evidence',()=>{
 const save=body('app.save_playoff_prize_proposal_v2'),workspace=body('app.get_playoff_prize_proposal_workspace_v2');
 assert.match(save,/request_value->>'nativeSourceDigest'is distinct from native->>'sourceDigest'/);assert.match(save,/request_value->'input'is distinct from native#>'\{capture,input\}'/);
 assert.match(save,/values\(new_id,tid,eid,new_version,head.id,actor,op,request_value->>'nativeSourceDigest',native,/);
 assert.match(sql,/source_capture->>'actorId'=actor_id::text/);assert.match(sql,/'sourceCapture',rev.source_capture/);
 for(const code of[save,workspace])assert.match(code,/jsonb_build_array\(head.source_capture->'capture',head.source_capture->'coverage'\).*jsonb_build_array\(native->'capture',native->'coverage'\)/);
 assert.match(workspace,/stale:=native->>'status'is distinct from'source_available'/);assert.match(workspace,/'head',head_document/);
});
test('append enforces full immutable prefix and CAS; explicit changed-source adoption archives prior head with empty new history',()=>{
 const save=body('app.save_playoff_prize_proposal_v2');
 for(const code of['head_conflict','native_source_changed','invalid_override_history','unsafe_proposal_range','invalid_source_adoption','explicit_source_adoption_required','immutable_history_prefix_required'])assert(save.includes(`'${code}'`));
 assert.match(save,/expected is distinct from head.id/);assert.match(save,/head.id is null or jsonb_build_array.*is not distinct from.*'overrideHistory'is distinct from'\[\]'::jsonb/);
 assert.match(save,/jsonb_array_elements\(head.override_history\)with ordinality/);assert.match(save,/revision_id=head.id;if not found then raise exception/);
 assert.match(save,/new_version:=coalesce\(head.version,0\)\+1/);assert.match(save,/new_version,head.id,actor,op/);
});
test('whole actual bands, independent regular increments, raw JS reasons and per-band latest prior preserve zero/void/reopen',()=>{
 const history=body('app.valid_playoff_prize_proposal_history_v2'),reason=body('app.valid_playoff_prize_proposal_reason_v2');
 assert.match(history,/winner-takes-all'then 1/);assert.match(history,/paid>qualifiers/);assert.match(history,/rounding,regular/);assert.doesNotMatch(history,/rounding,qPool|rounding,sidePool/);
 assert.match(history,/least\(paid,case when first_place=1 then 1 else\(first_place-1\)\*2 end\)/);assert.match(history,/not\(k=any\(band_keys\)\)/);
 assert.match(history,/mod\(amount,step\)<>0/);assert.match(history,/9007199254740991/);assert.match(history,/\^\(0\|/);
 assert.match(history,/record_value->>'recordId'=any\(seen\)/);assert.match(history,/prior:=latest->>k/);assert.match(history,/priorRecordId'is distinct from'null'.*voided'is distinct from'false'/);assert.match(history,/priorRecordId'is distinct from prior/);
 assert.match(reason,/event_settings_js_text_length_v3/);assert.match(reason,/<=2000/);assert.match(reason,/chr\(65279\)/);assert.match(sql,/request_value->>'reason'\)/);
});
test('range-only approved math uses exact integer quotient, actual active regular allocations and full adjusted totals',()=>{
 const range=body('app.playoff_prize_proposal_range_safe_v2');
 assert.match(range,/entry_total-benefit_total-expense_total/);assert.match(range,/state'='voided'.*continue/);assert.match(range,/allocated<>source_amount/);
 assert.match(range,/fund>9007199254740991-step::numeric\*paid/);assert.match(range,/weight:=weight\*factor_num/);assert.match(range,/weight:=weight\*factor_den/);assert.match(range,/denominator:=denominator\+weight\*people\[i\]/);
 assert.match(range,/source_award:=pg_catalog.div\(2\*fund\*weights\[i\]\+denominator\*step,2\*denominator\*step\)\*step/);
 assert.match(range,/record_value->'voided'='false'.*else source_award/);assert.match(range,/band_total>9007199254740991 or proposed_total>9007199254740991/);
 assert.doesNotMatch(range,/double precision|\bround\(|\bpower\(|payoutAuthorized.*true|balanced/);
});
test('source busy/isolation are unjournaled attempts and one exception savepoint covers all journal/head writes',()=>{
 const save=body('app.save_playoff_prize_proposal_v2');const insertion=save.indexOf('insert into app.playoff_prize_proposal_operations_v2');
 assert(save.indexOf("'retry_exact','isolation_not_supported'")<insertion);assert(save.indexOf("native->>'status'='retry_exact'")<insertion);
 assert.match(save,/exception when lock_not_available then return app.playoff_prize_proposal_attempt_v2.*'retry_exact','source_busy'/);
 assert.equal([...save.matchAll(/exception when lock_not_available/g)].length,1);assert.match(save,/pg_try_advisory_xact_lock\(hashtextextended\('playoff-prize-proposal-event-v2:/);assert.match(save,/pg_try_advisory_xact_lock\(hashtextextended\('playoff-prize-proposal-operation-v2:/);
 assert.match(sql,/'createdAt',to_char\(timezone\('UTC',rev.created_at\),'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'\)/);
});
