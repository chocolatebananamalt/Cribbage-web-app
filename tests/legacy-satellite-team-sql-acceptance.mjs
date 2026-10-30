// Real owning RPC acceptance module. Call capture BEFORE0260, verify AFTER0260.
// Synthetic identity/setup foundations only; accepted receipts are created by RPCs.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const q=value=>`'${String(value).replaceAll("'","''")}'`;
const id=(prefix,n)=>`${prefix}0000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const json=(sql,s)=>JSON.parse(sql(s).trim().split('\n').at(-1));
function foundation(sql,prefix,format) {
  const ns=s=>s.replaceAll('1310000',`${prefix}0000`).replaceAll('2430000',`${prefix}1000`).replaceAll('@test.invalid',`-${prefix}@test.invalid`);
  const actor=ns('a1310000-0000-4000-8000-000000000001'),tid=ns('b1310000-0000-4000-8000-000000000001'),eid=ns('11310000-0000-4000-8000-000000000001');
  let seed=ns(fs.readFileSync('tests/q-pool-membership-seed.sql','utf8')).replace(/insert into app\.tournament_setup_q_pool_versions[\s\S]+?;/,'');
  seed=seed.replaceAll('standard_singles',format).replace("1,'main','Main'","1,'satellite','Main'").replace("'Main','main',","'Main','satellite',");
  sql(`begin;set role postgres;select set_config('request.jwt.claim.role','service_role',false);${seed}
    insert into app.tournament_setup_finalization_confirmations(tournament_id,setup_revision_id,actor_profile_id,activation_receipt_id)
    values('${tid}','${ns('e1310000-0000-4000-8000-000000000001')}','${actor}','${ns('c1310000-0000-4000-8000-000000000001')}');commit;`);
  return {actor,tid,eid,ns};
}
function fingerprint(sql,f) {
  return sql(`select md5(jsonb_build_object(
    'events',(select jsonb_agg(to_jsonb(x)order by id)from app.events x where tournament_id='${f.tid}'),
    'receipts',(select jsonb_agg(to_jsonb(x)order by id)from app.operation_receipts x where tournament_id='${f.tid}'),
    'versions',(select jsonb_agg(to_jsonb(x)order by id)from app.satellite_result_versions x where tournament_id='${f.tid}'),
    'contributions',(select jsonb_agg(to_jsonb(x)order by id)from app.event_team_financial_contributions x where tournament_id='${f.tid}'),
    'changes',(select jsonb_agg(to_jsonb(x)order by id)from app.event_change_operations x where tournament_id='${f.tid}'),
    'transfers',(select jsonb_agg(to_jsonb(x)order by id)from app.event_replacement_transfer_records x where tournament_id='${f.tid}'),
    'setup',(select jsonb_agg(to_jsonb(x)order by id)from app.tournament_setup_revisions x where tournament_id='${f.tid}'),
    'activations',(select jsonb_agg(to_jsonb(x)order by id)from app.tournament_setup_activations x where tournament_id='${f.tid}'),
    'teams',(select jsonb_agg(to_jsonb(x)order by id)from app.event_teams x where tournament_id='${f.tid}'),
    'members',(select jsonb_agg(to_jsonb(x)order by id)from app.event_team_members x where tournament_id='${f.tid}'),
    'entries',(select jsonb_agg(to_jsonb(x)order by id)from app.event_team_entries x where tournament_id='${f.tid}'),
    'audit',(select jsonb_agg(to_jsonb(x)order by id)from app.audit_events x where tournament_id='${f.tid}')
  )::text);`).trim().split('\n').at(-1);
}
export function captureLegacySatelliteTeam(sql) {
  const s=foundation(sql,'671','standard_singles');
  s.package=id('a671',1);s.version=id('a671',2);s.op=id('a671',3);
  s.placements=[{placement:1,entrantId:'TEST ONLY synthetic entrant',displayName:'TEST ONLY',prizeMinor:501,qPoolMinor:0,sidePoolMinor:0,crossCheckEvidence:[{type:'synthetic',ref:'TEST ONLY no real cards'}]}];
  s.call=(op,version,expected=0)=>`public.save_satellite_results_v1('${s.actor}','${s.tid}','${s.eid}','${s.package}','${version}','save_draft',${q(JSON.stringify(s.placements))}::jsonb,'[]'::jsonb,'TEST ONLY',${expected},'${op}')`;
  s.accepted=json(sql,`select ${s.call(s.op,s.version)};`);assert.equal(s.accepted.status,'satellite_results_saved');s.before=fingerprint(sql,s);
  const teams=[];
  for(const [prefix,n] of [['672',1],['673',2],['674',3]]) {
    const f=foundation(sql,prefix,'doubles');f.team=id(`a${prefix}`,1);f.entry=id(`a${prefix}`,2);f.createOp=id(`a${prefix}`,3);f.changeOp=id(`a${prefix}`,4);
    const accepted=json(sql,`select public.create_event_team_v1('${f.actor}','${f.tid}','${f.eid}','${f.team}','${f.entry}','${f.ns('d2430000-0000-4000-8000-000000000001')}','${f.ns('d2430000-0000-4000-8000-000000000002')}','paper','${f.createOp}');`);
    assert.equal(accepted.status,'team_created');
    f.amount=n===3?500:501;
    sql(`insert into app.event_team_financial_contributions(team_entry_id,roster_entry_id,tournament_id,amount_minor,contribution_type) values('${f.entry}','${f.ns('d2430000-0000-4000-8000-000000000001')}','${f.tid}',${f.amount},'award');`);
    f.call=op=>`public.change_event_lifecycle_v1('${f.actor}','${f.tid}','${f.eid}','replace','TEST ONLY original cent contribution preserved','${op}')`;
    if(n===1){f.accepted=json(sql,`select ${f.call(f.changeOp)};`);assert.equal(f.accepted.status,'event_replaced');}
    f.before=fingerprint(sql,f);teams.push(f);
  }
  return {satellite:s,teams};
}
export function verifyLegacySatelliteTeam(sql,capture) {
  const s=capture.satellite;
  assert.deepEqual(json(sql,`select ${s.call(s.op,s.version)};`),s.accepted);
  assert.equal(fingerprint(sql,s),s.before);
  // Catch only the real trigger failure; its entire attempted RPC rolls back.
  sql(`do $test$begin begin perform ${s.call(id('a671',4),id('a671',5),1)};raise exception 'expected denomination rejection';exception when raise_exception then if sqlerrm<>'whole_five_awards_required'then raise;end if;end;end$test$;`);
  assert.equal(fingerprint(sql,s),s.before);
  const [replay,blocked,ordinary]=capture.teams;
  assert.deepEqual(json(sql,`select ${replay.call(replay.changeOp)};`),replay.accepted);
  assert.equal(fingerprint(sql,replay),replay.before);
  const rejected=json(sql,`select ${blocked.call(blocked.changeOp)};`);
  assert.equal(rejected.status,'rejected');assert.equal(rejected.code,'operation_unavailable');
  assert.equal(fingerprint(sql,blocked),blocked.before);
  const oldContribution=sql(`select to_jsonb(x)::text from app.event_team_financial_contributions x where team_entry_id='${ordinary.entry}';`).trim();
  const replaced=json(sql,`select ${ordinary.call(ordinary.changeOp)};`);assert.equal(replaced.status,'event_replaced');
  assert.equal(sql(`select to_jsonb(x)::text from app.event_team_financial_contributions x where team_entry_id='${ordinary.entry}';`).trim(),oldContribution);
  assert.equal(sql(`select count(*)||':'||sum(amount_minor)from app.event_team_financial_contributions where tournament_id='${ordinary.tid}';`).trim(),'2:1000');
  assert.equal(sql(`select count(*)from app.event_team_entry_versions where event_id='${replaced.replacementEventId}' and scorer_resolution_status='not_required';`).trim(),'1');
  return {satelliteReplay:true,satelliteRejectedRollback:true,teamAcceptedReplay:true,teamRejectedReplacementRollback:true,ordinaryTeamReplacement:true};
}
