import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const file='database/proposals/native-mixed-latest-prize-admission-v1.sql';
const sql=fs.readFileSync(file,'utf8');
function body(file,name){const s=fs.readFileSync(file,'utf8').replaceAll('\r\n','\n'),i=s.indexOf(`create function app.${name}(`),a=s.indexOf('$$',i)+2,b=s.indexOf('$$;',a);assert(i>=0&&a>1&&b>a);return s.slice(a,b);}
const base=body('database/proposals/native-mixed-admission-v1.sql','native_mixed_admission_base_source_v1');
const playoff=body('database/proposals/native-mixed-playoff-v1.sql','native_mixed_playoff_source_v1');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const count=(s,x)=>s.split(x).length-1;
// Source contracts, not a SQL parser, install, runtime, ACL or provider proof.
test('atomic closed bridge has no new tables, grants, ordinary writes or monetary authority',()=>{
 assert.match(sql,/^begin;$/m);assert.match(sql,/commit;\s*$/);
 assert.match(sql,/admission_enabled_v1\(\)returns boolean\s+language sql immutable set search_path=''as \$\$select false\$\$/);
 assert.doesNotMatch(sql,/\b(?:insert into|update|delete from|create table|alter table|grant\s+execute|grant\s+usage)\b/i);
 assert(sql.includes("'latestPolicyExecuted',false,'ordinaryFinanceSource',false"));
 assert(sql.includes('from public,anon,authenticated,service_role'));
});
test('installed definition bodies are pinned to recoverable exact source plus catalog metadata',()=>{
 for(const b of[base,playoff])assert(sql.includes(sha(b)));
 for(const field of['x.prosecdef','not x.proisstrict',"x.prorettype='jsonb'::regtype","x.proowner='postgres'::regrole","l.lanname='plpgsql'",'x.provolatile::text',"lower(g)='timezone=utc'"] )assert(sql.includes(field));
 assert(sql.includes("replace(prosrc,E'\\r\\n',E'\\n')"));
 assert(sql.includes('native_latest_original_oid_changed'));assert(sql.includes('native_latest_legacy_copy_changed'));
 assert.doesNotMatch(sql,/alter function[^;]*rename to/i);
});
test('latest clones alter only unique assessor/declaration/capture anchors and preserve all domain guards',()=>{
 const assessor='assessment:=app.assess_event_rule_draft_v1(b.draft,b.context);';
 for(const b of[base,playoff]){assert.equal(count(b,assessor),1);assert.equal(count(b,'assessment jsonb;'),1);}
 assert.equal(count(base,"'syntheticAllFlags',false"),1);assert.equal(count(playoff,"'series',series,'roster',roster"),1);
 for(const guard of["s.game_count<>12","b.context->'sanctioned'is distinct from'false'::jsonb",'jsonb_array_length(roster)<>18',"x->>'mode'='digital'","x->>'mode'='paper'"])assert(base.includes(guard));
 for(const guard of['app.native_mixed_playoff_review_v1',"review->'qualificationReady'is distinct from'true'::jsonb",'array[1,2,3,4,5]'])assert(playoff.includes(guard));
 assert(sql.includes('native_latest_assessor_anchor_changed'));assert(sql.includes('native_latest_capture_anchor_changed'));
});
test('latest history, missing head or disabled opt-in never delegate to dormant legacy',()=>{
 const dispatcher=sql.slice(sql.indexOf('execute format($wrapper$'),sql.indexOf('end$install$;'));
 assert(dispatcher.indexOf('native_mixed_latest_prize_present_v1')<dispatcher.indexOf('native_mixed_latest_prize_admission_enabled_v1'));
 assert(dispatcher.includes('return app.%I(tid,eid);\n    end if;\n    return app.%I(tid,eid);'));
 for(const n of['snapshots','heads','revision_bindings','policy_activation_pins','reservations'])assert(sql.includes(`exists(select 1 from app.event_prize_${n}_v1 where tournament_id=tid)`));
 assert(sql.includes('exists(select 1 from app.event_prize_outcomes_v1 o join app.event_prize_reservations_v1 r'));
 const presence=sql.slice(sql.indexOf('create function app.native_mixed_latest_prize_present_v1'),sql.indexOf('create function app.native_mixed_latest_prize_pin_v1'));
 assert.doesNotMatch(presence,/accepted|outcome\s*=|status\s*=/i,'Rejected or reservation-only history is still a latest barrier');
 assert(sql.includes('native_latest_bridge_disabled'));assert(sql.includes('native_latest_prize_binding_unavailable'));
 // No old operational/Finance gate is removed or enabled by the bridge.
 assert.doesNotMatch(sql,/create or replace function app\.(?:event_settings_playoff_source|operational_event_finance_source)/);
});
test('current latest capture requires genuine head/save/revision/settings/context/activation proof',()=>{
 for(const anchor of['app.event_prize_activation_current_v1(tid,b.intent_actor_id,b.intent_operation_id)',
  'rb.settings_snapshot_id is distinct from s.id','rb.actor_id is distinct from p.actor_id','s.operation_id is distinct from r.nested_operation_id',
  "saved#>'{result,ack,envelope}'is distinct from r.request_payload","saved#>'{result,ack,snapshot}'is distinct from p.document",
  "activated->>'status'is distinct from'event_settings_operationally_activated'",
  "plan#>>'{draft,method}'is distinct from'graduated'","plan#>>'{draft,recipients}'is distinct from'all'",
  "'settingsSnapshot',to_jsonb(s)","'prizeSnapshot',to_jsonb(p)","'activationPin',to_jsonb(pin)","'plan',plan"])assert(sql.includes(anchor),anchor);
 assert(sql.includes('app.assess_event_prize_series_draft_v1'));
 assert.doesNotMatch(sql,/insert[^;]*event_prize_schedule_bindings_v1|save_setup_prize_schedule_v1|set_config\(/i);
});
test('existing funding and attendance carry and compare entire versioned base source; browser DTOs stay summary-only',()=>{
 const funding=fs.readFileSync('database/proposals/native-mixed-funding-v1.sql','utf8'),attendance=fs.readFileSync('database/proposals/native-mixed-attendance-v1.sql','utf8');
 assert(funding.includes("'baseSource',base"));assert(funding.includes('base is distinct from intent.base_source_capture'));
 assert(funding.includes("base is distinct from s.source_capture->'baseSource'"));
 assert(attendance.includes('app.native_mixed_admission_base_source_v1'));
 const start=fs.readFileSync('database/proposals/native-mixed-simulation-game-evidence-v1.sql','utf8');
 assert(start.includes('app.native_mixed_attendance_projection_v1'));assert(start.includes('seal.source_capture is distinct from a'));
 assert(sql.includes("''latestPrize'',latest_pin"));
});
