import assert from 'node:assert/strict';
export async function verifySimulatedLinks({sql,read,startSession}){
 const tid='3c58ef91-010c-4769-af20-5cfa2ffe98a9',a='de0f27a1-60d0-4449-af83-fdf360a9bc08',b='986c7f24-1d42-4115-8532-053fc4bef59a';
 const id=n=>`b2700000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const checks=[];const pass=name=>{checks.push(name);console.log('PASS',name);};
 const call=(actor,req,op,phrase='ABCD-EFGH',fn='decide_simulated_player_link_v1')=>`select public.${fn}('${actor}','${tid}','${req}','approve','${phrase}','${op}')`;
 const reject=q=>assert.deepEqual(read(q),{status:'rejected'});
 sql(`insert into auth.users(id,email)values('${a}','pr122-director@test.invalid'),('${b}','pr122-player-b@test.invalid');insert into app.tournaments(id,director_profile_id,name,status,registration_status)values('${tid}','${a}','TEST ONLY one operator simulation','open','open');insert into app.tournament_roles(tournament_id,profile_id,role)values('${tid}','${a}','director'),('${tid}','${b}','co_director');insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values('${id(1)}','${tid}','${a}','simulation_fixture','${tid}',repeat('1',64),'${id(2)}','accepted','{}',now());`);
 assert.equal(read(`select public.get_simulated_player_link_scope_v1('${a}','${tid}')`),false);
 sql(`insert into app.synthetic_paper_deployments_v1(project_ref,authorization_reference)values('nnhcnvksxgxnpvdqjgpg','LOCAL SYNTHETIC TEST ONLY');insert into app.simulated_player_link_scopes_v1(tournament_id,project_ref,operator_profile_id,authorization_reference)values('${tid}','nnhcnvksxgxnpvdqjgpg','${a}','LOCAL TEST single operator; no independent human witness');`);
 assert.equal(read(`select public.get_simulated_player_link_scope_v1('${a}','${tid}')`),true);
 assert.equal(read(`select public.get_simulated_player_link_scope_v1('${id(99)}','${tid}')`),false);pass('empty enrollment fail closed; exact fixture authority required');
 const seed=(n,profile,seconds=1800)=>{
  const roster=id(n),activation=id(n+1),request=id(n+2);
  sql(`insert into app.tournament_roster_entries(id,tournament_id,source_kind,claimed_display_name,claimed_normalized_name,scorecard_type,creator_profile_id,operation_receipt_id)values('${roster}','${tid}','director_manual','TEST ${n}','test ${n}','digital','${a}','${id(1)}');insert into app.roster_account_activations(id,tournament_id,roster_entry_id,issued_by_profile_id,token_salt,token_digest,state,expires_at,issued_at)values('${activation}','${tid}','${roster}','${a}',decode(repeat('01',32),'hex'),decode(repeat('02',32),'hex'),'pending',now()+interval '${seconds} seconds',now()-interval '10 minutes');insert into app.roster_account_activation_requests(id,tournament_id,activation_id,profile_id,confirmation_phrase,state)values('${request}','${tid}','${activation}','${profile}','ABCD-EFGH','pending');`);
  return {roster,activation,request};
 };
 const expired=seed(50,b,-1);reject(call(a,expired.request,id(54)));
 assert.equal(read(`select to_json(state) from app.roster_account_activations where id='${expired.activation}'`).toString(),'expired');
 assert.equal(read(`select count(*)::int from app.simulated_player_link_provenance_v1`),0);pass('simulated wrapper rejects expired request without link or provenance');
 const first=seed(10,b);
 reject(call(a,first.request,id(20),'WRNG-WRNG'));reject(call(b,first.request,id(21)));reject(call(id(99),first.request,id(22)));
 assert.throws(()=>sql(call(a,first.request,id(23),'ABCD-EFGH','decide_roster_account_activation_v1')),/activation approval unavailable/);
 assert.equal(read(`select count(*)::int from app.roster_account_links where tournament_id='${tid}'`),0);pass('wrong phrase, self-account, unauthorized and ordinary-path rejection preserve zero links');
 assert.throws(()=>sql(`begin;select set_config('app.simulated_player_link_request','${first.request}',true);${call(a,first.request,id(26),'ABCD-EFGH','decide_roster_account_activation_v1')};commit;`),/simulated_link_provenance_required/);
 assert.equal(read(`select count(*)::int from app.roster_account_links where tournament_id='${tid}'`),0);pass('missing provenance rolls back link, approval, receipt and audit transaction');

 const result=read(call(a,first.request,id(24)));assert.equal(result.status,'approved');
 assert.deepEqual(read(call(a,first.request,id(24))),result);reject(call(a,first.request,id(25)));
 assert.equal(read(`select count(*)::int from app.simulated_player_link_provenance_v1 where tournament_id='${tid}' and not independent_human_witness and operator_profile_id='${a}' and player_profile_id='${b}'`),1);
 assert.throws(()=>sql(`update app.simulated_player_link_provenance_v1 set method='changed'`),/immutable/);pass('atomic truthful provenance, identical replay, different-key rejection and immutable history');
 const second=seed(30,a);
 const racers=await Promise.all([startSession(call(b,second.request,id(40)),'simulation-race-a').done,startSession(call(b,second.request,id(41)),'simulation-race-b').done]);
 const results=racers.map(s=>JSON.parse(s.trim().split('\n').at(-1)));assert.equal(results.filter(x=>x.status==='approved').length,1);assert.equal(results.filter(x=>x.status==='rejected').length,1);
 assert.equal(read(`select count(*)::int from app.simulated_player_link_provenance_v1`),2);pass('concurrent opposing operation IDs serialize to one link and one provenance');
 sql(`insert into auth.users(id,email)values('${id(99)}','simulation-observer@test.invalid');insert into app.ruleset_versions(id,tournament_id,name,format,approved_at)values('${id(100)}','${tid}','TEST simulation rules','standard_singles',now());insert into app.events(id,tournament_id,ruleset_version_id,name,event_type,format,scoring_method)values('${id(101)}','${tid}','${id(100)}','TEST simulation event','main','standard_singles','digital');insert into app.event_participants(tournament_id,event_id,profile_id,status)values('${tid}','${id(101)}','${id(99)}','checked_in');`);
 assert.equal(read(`select public.get_simulated_player_link_label_v1('${id(99)}','${tid}')`),true);
 assert.equal(read(`select public.get_simulated_player_link_scope_v1('${id(99)}','${tid}')`),false);
 assert.equal(read(`select public.get_simulated_player_link_label_v1('${id(98)}','${tid}')`),false);pass('checked-in player sees simulation label without gaining decision authority');
 assert.equal(read(`select bool_and(not has_function_privilege('authenticated',p.oid,'execute') and not has_function_privilege('anon',p.oid,'execute')) from pg_proc p where p.proname in('get_simulated_player_link_scope_v1','decide_simulated_player_link_v1')`),true);
 assert.equal(read(`select bool_and(relrowsecurity and relforcerowsecurity and not has_table_privilege('service_role',c.oid,'insert'))from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='app' and c.relname in('simulated_player_link_scopes_v1','simulated_player_link_provenance_v1')`),true);pass('private forced-RLS tables and service-only RPC grants');
 // Independent baseline activation deadline suite runs separately in this same real DB.
 return {kind:'isolated synthetic SQL, not hosted or independent-human acceptance',checks};
}

export async function verifySimulationEnrollmentRace({sql,read,startSession},order){
 const t='3c58ef91-010c-4769-af20-5cfa2ffe98a9',a='de0f27a1-60d0-4449-af83-fdf360a9bc08',b='986c7f24-1d42-4115-8532-053fc4bef59a';
 const id=n=>`b2710000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 sql(`insert into auth.users(id,email)values('${a}','pr122-director@test.invalid'),('${b}','pr122-player-b@test.invalid');insert into app.tournaments(id,director_profile_id,name,status,registration_status)values('${t}','${a}','TEST ONLY race','open','open');insert into app.tournament_roles(tournament_id,profile_id,role)values('${t}','${a}','director');insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values('${id(1)}','${t}','${a}','race_fixture','${t}',repeat('1',64),'${id(2)}','accepted','{}',now());insert into app.tournament_roster_entries(id,tournament_id,source_kind,claimed_display_name,claimed_normalized_name,scorecard_type,creator_profile_id,operation_receipt_id)values('${id(3)}','${t}','director_manual','TEST race','test race','digital','${a}','${id(1)}');insert into app.roster_account_activations(id,tournament_id,roster_entry_id,issued_by_profile_id,token_salt,token_digest,state,expires_at,issued_at)values('${id(4)}','${t}','${id(3)}','${a}',decode(repeat('01',32),'hex'),decode(repeat('02',32),'hex'),'pending',now()+interval '30 minutes',now()-interval '1 minute');insert into app.roster_account_activation_requests(id,tournament_id,activation_id,profile_id,confirmation_phrase,state)values('${id(5)}','${t}','${id(4)}','${b}','ABCD-EFGH','pending');insert into app.synthetic_paper_deployments_v1(project_ref,authorization_reference)values('nnhcnvksxgxnpvdqjgpg','LOCAL TEST');`);
 const enrollment=`insert into app.simulated_player_link_scopes_v1(tournament_id,project_ref,operator_profile_id,authorization_reference)values('${t}','nnhcnvksxgxnpvdqjgpg','${a}','LOCAL TEST');`;
 const link=`select public.decide_roster_account_activation_v1('${a}','${t}','${id(5)}','approve','ABCD-EFGH','${id(6)}');`;
 const first=startSession('begin;'+(order==='enrollment-first'?enrollment:link)+'select pg_sleep(2);commit;','simulation-order-first');
 let sleeping=false;for(let i=0;i<80;i++){if(read(`select exists(select 1 from pg_stat_activity where application_name='simulation-order-first' and wait_event='PgSleep')`)){sleeping=true;break;}await new Promise(r=>setTimeout(r,20));}assert.ok(sleeping);
 const second=startSession(order==='enrollment-first'?link:enrollment,'simulation-order-second');const secondResult=second.done.then(()=>({ok:true}),error=>({ok:false,error:String(error)}));
 await first.done;const r=await secondResult;assert.equal(r.ok,false);assert.match(r.error,/activation approval unavailable|simulation_requires_fresh_unlinked_fixture/);
 assert.equal(read(`select count(*)::int from app.simulated_player_link_scopes_v1`),order==='enrollment-first'?1:0);
 assert.equal(read(`select count(*)::int from app.roster_account_links`),order==='enrollment-first'?0:1);
 console.log('PASS enrollment/link serialized',order);return {order,passed:true};
}
