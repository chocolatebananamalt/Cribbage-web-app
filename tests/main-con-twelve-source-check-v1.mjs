import assert from'node:assert/strict';import{raw,call,checkpoint,actor,tid,lit,report}from'./main-con-owned-db-v3.mjs';
const con=report.consolationEventId;assert(con);
const q=call('select to_jsonb(id)from app.qualification_result_versions where event_id='+lit(con)+'order by version desc limit 1;');assert(q);
const expr='app.linked_consolation_four_qualifier_source_v2('+[tid,con,q].map(lit).join(',')+')';
const digest=call('select to_jsonb('+expr+');');assert.match(digest,/^[a-f0-9]{64}$/);
const disabled=call("begin;create or replace function app.linked_consolation_twelve_enabled_v1()returns boolean language sql stable set search_path=''as $$select false$$;select to_jsonb("+expr+');rollback;');assert.equal(disabled,null);
assert.equal(call('select to_jsonb('+expr+');'),digest);
assert.equal(call('select to_jsonb(app.linked_consolation_four_qualifier_source_v2('+[tid,con,report.eventId].map(lit).join(',')+'));'),null);
checkpoint('twelve_source_regression',{gameCount:12,qualifierCount:4,gateEnabledDigest:digest,gateDisabledNull:true,rollbackPreservedDigest:true,mismatchedQualificationRejected:true,thresholdSource:'https://www.cribbage.org/newsite/about/points.asp?games=12&min=16&scale=3'});
