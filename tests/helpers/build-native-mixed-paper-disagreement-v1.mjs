// Current source pins: actual closed local installation/ACL-denial proof in tests/fixtures/integrated-history/closed-proposals-proof.json. No enabled write/provider claim.
// Deterministic SOURCE generation only; no database, subprocess or network.
import fs from'node:fs';import assert from'node:assert/strict';import{createHash}from'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
export const paperDisagreementPinsV1={
 'database/proposals/native-mixed-simulation-game-evidence-v1.sql':'9d52eb527b16a0cbfca958727b2214b8ecb196244d29f5348b30fa38b27657d8',
 'database/proposals/native-mixed-game-reopen-v1.sql':'239d2e7a8504d7c6077ff9fd48d58bc015c40d8955fd4f83982031d164f3b962',
};
const load=p=>{const b=fs.readFileSync(p);assert.equal(sha(b),paperDisagreementPinsV1[p],p);return b.toString('utf8').replaceAll('\r\n','\n');};
const one=(s,old,next)=>{assert.equal(s.split(old).length-1,1,'Exact single anchor required: '+old);return s.replace(old,()=>next);};
const fn=(s,name)=>{const m=s.match(new RegExp(`create (?:or replace )?function app\\.${name}\\([\\s\\S]*?end\\$\\$;`));assert(m,name);return m[0].replace(/^create function/,'create or replace function');};
const claims=(value,key)=>`(select jsonb_agg(x order by x->>'side')from jsonb_array_elements(${value}->'${key}')x)`;
const sides=(value,key)=>`(select jsonb_agg(x->'side'order by x->>'side')from jsonb_array_elements(${value}->'${key}')x)`;
function reviewGuard(payload,capture,priorConfirmation){
 const p=claims(payload,'reenteredClaims'),c=claims(capture,'claims');
 return `${sides(payload,'reenteredClaims')}is distinct from${sides(capture,'claims')}
    or(${payload}->>'decision'='accepted-simulation-only'and ${p}is distinct from${c})
    or(${payload}->>'decision'='disputed-simulation-only'and(${p}is not distinct from${c}or ${priorConfirmation}))`;
}
export function buildNativeMixedPaperDisagreementSQLV1(){
 const base=load('database/proposals/native-mixed-simulation-game-evidence-v1.sql'),prior=load('database/proposals/native-mixed-game-reopen-v1.sql'),parts=[];
 let s=fn(base,'native_mixed_game_request_valid_v1');
 s=one(s,"p->>'decision'is not distinct from'accepted-simulation-only'","p->>'decision'in('accepted-simulation-only','disputed-simulation-only')");parts.push(s);
 s=fn(prior,'native_mixed_game_entry_bound_with_start_v1');
 const oldBound="(select jsonb_agg(x order by x->>'side')from jsonb_array_elements(e.entry->'reenteredClaims')x)\n    is distinct from(select jsonb_agg(x order by x->>'side')from jsonb_array_elements(capture_entry.entry->'claims')x)";
 s=one(s,oldBound,reviewGuard('e.entry','capture_entry.entry',"exists(select 1 from app.native_mixed_game_attempt_history_v1(e.start_id,e.game_id,app.native_mixed_game_entry_attempt_v1(e.id))previous where previous.sequence<e.sequence and previous.entry->>'action'='digital-confirm')"));parts.push(s);
 s=fn(prior,'native_mixed_game_complete_with_start_v1');
 s=one(s," if jsonb_array_length(h)<>"," if exists(select 1 from jsonb_array_elements(h)x where x->>'action'='paper-review'and x->>'decision'is distinct from'accepted-simulation-only')then return false;end if;\n if jsonb_array_length(h)<>");parts.push(s);
 s=fn(prior,'append_native_mixed_simulation_game_evidence_v1');
 s=one(s," body:=jsonb_build_object('id',idv",` -- Only a fully validated fresh intent reaches this no-write retry branch.
 -- Old accepted receipts replay above even while the new append mode is off.
 if action_value='paper-review'and payload->>'decision'='disputed-simulation-only'and app.native_mixed_paper_disagreement_enabled_v1()is distinct from true then return jsonb_build_object('status','retry_exact','code','paper_disagreement_unavailable');end if;
 body:=jsonb_build_object('id',idv`);
 s=one(s,"if(select count(distinct v)from jsonb_array_elements(results)v)>1 then",`if(select count(distinct v)from jsonb_array_elements(results)v)>1
  or exists(select 1 from jsonb_array_elements(history)x where x->>'action'='paper-review'and x->>'decision'='disputed-simulation-only')then`);
 const oldWriter="(select jsonb_agg(x order by x->>'side')from jsonb_array_elements(payload->'reenteredClaims')x)\n     is distinct from(select jsonb_agg(x order by x->>'side')from jsonb_array_elements(capture->'claims')x)";
 s=one(s,oldWriter,reviewGuard('payload','capture',"exists(select 1 from jsonb_array_elements(history)x where x->>'action'='digital-confirm')"));parts.push(s);
 s=fn(prior,'native_mixed_game_reopen_block_v1');
 s=one(s,"if jsonb_array_length(results)<>2 or(select count(distinct x)from jsonb_array_elements(results)x)<>2 then",`if not exists(select 1 from jsonb_array_elements(h)x where x->>'action'='paper-review'and x->>'decision'='disputed-simulation-only')
  and(jsonb_array_length(results)<>2 or(select count(distinct x)from jsonb_array_elements(results)x)<>2)then`);parts.push(s);
 s=fn(prior,'get_native_mixed_simulation_game_state_v1');
 s=one(s,' -- Display DTOs never disclose another account UUID',` -- A bound dispute may precede the Digital participant's own submission.
 -- Reveal only a read-only status hint, never the hidden independent claims.
 -- Future Paper evidence must not turn an upcoming game into the current game.
 if blind and own_participant is not null and play_order='current'and exists(
  select 1 from app.native_mixed_game_active_evidence_v1(sid,gid)e where e.entry->>'action'='paper-review'and e.entry->>'decision'='disputed-simulation-only')then play_order:='review';end if;
 -- Display DTOs never disclose another account UUID`);parts.push(s);
 const prefix=`-- PRIVATE DEFAULT-OFF native fictional independent Paper disagreement.
-- Depends on exact closed native-mixed-game-reopen-v1.sql SHA256
-- 2f3f5a09da1caebf9bd96137435bb19b31f0e8ba49c12a81ab75d5b1421ee998.
-- This separate delta preserves that prior candidate and every historical row.
-- No ordinary scores, eligibility, MRPs, money, grants or policy overrides.
begin;
create function app.native_mixed_paper_disagreement_enabled_v1()returns boolean
language sql immutable set search_path=''set timezone='UTC'as $$select false$$;

`;
 const body=prefix+parts.join('\n\n')+'\n',functions=[...body.matchAll(/create (?:or replace )?function (app\.[a-z0-9_]+)\(([^)]*)\)/g)].map(m=>({name:m[1],args:m[2].split(',').filter(Boolean).map(a=>a.trim().split(/\s+/).slice(1).join(' ')).join(',')}));
 assert.equal(functions.length,7);
 return body+'\n'+functions.map(f=>`alter function ${f.name}(${f.args})owner to postgres;\nrevoke all on function ${f.name}(${f.args})from public,anon,authenticated,service_role;`).join('\n')+'\ncommit;\n';
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/build-native-mixed-paper-disagreement-v1.mjs')){
 const file='database/proposals/native-mixed-paper-disagreement-v1.sql',text=buildNativeMixedPaperDisagreementSQLV1();
 if(process.argv.includes('--check'))assert.equal(fs.readFileSync(file,'utf8').replaceAll('\r\n','\n'),text);else fs.writeFileSync(file,text);
 console.log(JSON.stringify({file,sha256:sha(text),bytes:Buffer.byteLength(text)}));
}
