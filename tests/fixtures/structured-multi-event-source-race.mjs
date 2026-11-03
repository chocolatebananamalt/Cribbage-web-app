// Two disposable, normally activated pre-start tournaments. Tests only
// serialization of supported event retirement versus the private joint writer.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
export async function verifySourceSetRace({q,read,startSession,name,db,actor,base,setupEvents,literal,schedule,id,publicMode=false}) {
 const status=(r,s)=>{assert.equal(r?.status,s,JSON.stringify(r));return r;};
 const make=(n,extra=false)=>{
  const tid=id('b876',n),op=id('d086',n*10),events=setupEvents.map((e,i)=>({...e,clientRowId:id('e086',n*10+i),qPools:[],sidePools:[]}));
  if(extra)events.push({...events[1],clientRowId:id('e086',n*10+2),eventKind:'satellite',displayName:'Extra Satellite'});
  const core={...base,tournamentName:'TEST ONLY source-set race '+n,events:events.map(({sidePools,...e})=>e)};
  q(`insert into app.tournaments(id,director_profile_id,name,status,registration_status)values('${tid}','${actor}','TEST ONLY source-set race','draft','closed');insert into app.tournament_roles(tournament_id,profile_id,role)values('${tid}','${actor}','director');`);
  status(read(`select public.bind_side_pool_setup_request_v1('${actor}','${tid}','${op}','setup',${literal({expectedVersion:0,payload:{...core,events},idempotencyKey:op})});`),'bound');
  const saved=status(read(`select public.save_tournament_setup_version('${tid}',0,${literal(core)},'${op}');`),'setup_draft_saved'),rid=saved.revisionId;
  status(read(`select public.configure_tournament_setup_side_pools_v1('${actor}','${tid}','${rid}',${literal(events)});`),'setup_side_pools_configured');
  for(let i=0;i<2;i++){
   const row=events[i].clientRowId,digest=read(`select to_jsonb(app.event_prize_settings_digest_v2(app.event_prize_settings_v2('${tid}','${row}')));`),req={expectedVersion:0,expectedSettingsFingerprint:digest,schedule:schedule(i===0?5:4),reviewed:true,reason:'TEST ONLY synthetic source race'};
   status(read(`select public.save_event_prize_declaration_v2('${actor}','${tid}','${row}',${literal(req)},'${id('d086',n*10+1+i)}');`),'event_prize_declaration_saved_v2');
  }
  const pins=read(`select app.current_event_prize_activation_pins_v1('${tid}','${rid}',1);`);
  const activated=status(read(`select public.finalize_tournament_setup_pinned_v2('${actor}','${tid}','${rid}',1,true,${literal(pins)},'${id('d086',n*10+5)}');`),'tournament_setup_activated');
  const eventIds=activated.events.map(x=>x.eventId),main=activated.events.find(x=>x.eventType==='main').eventId;
  q(eventIds.map(eid=>`insert into app.synthetic_paper_fixtures_v1(event_id,tournament_id,project_ref,authorization_reference)values('${eid}','${tid}','nnhcnvksxgxnpvdqjgpg','TEST ONLY source-set race');`).join('\n'));
  status(read(`select public.activate_multi_event_finance_v1('${actor}','${tid}','simulation','${id('d086',n*10+6)}');`),'multi_event_finance_activated');
  return {tid,main,eventIds};
 };
 const gate=()=>{const child=spawn('docker',['--context','desktop-linux','exec','-i',name,'psql','-h','/tmp','-X','-qAt','-U','supabase_admin','-d',db,'-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']});let out='',err='';child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>err+=x);const done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>code===0?resolve():reject(Error(err)));});return {child,done,out:()=>out};};
 const wait=async(test,label)=>{const end=Date.now()+10000;while(Date.now()<end){if(test())return;await new Promise(r=>setTimeout(r,50));}throw Error('Source-set barrier unavailable '+label);};
 const writer=publicMode?'public.finalize_multi_event_unpaid_v1':'app.write_multi_event_joint_final_candidate_v1';
 const workspace=publicMode?'public.get_multi_event_joint_final_workspace_v1':'app.multi_event_joint_final_candidate_workspace_v1';
 const call=(t,op)=>`set statement_timeout='15s';select ${writer}('${actor}','${t}',${literal({jointDigest:'0'.repeat(64),reason:'TEST ONLY SYNTHETIC: source-set race',reviewed:true})},'${op}');`;
 const retire=(t,e,op)=>`select public.change_event_lifecycle_v1('${actor}','${t}','${e}','retire','TEST ONLY synthetic source-set race','${op}');`;
 // Mutation commits while writer is parked before its first qualification lock.
 const a=make(1),hold=gate(),first=[...a.eventIds].sort()[0];
 hold.child.stdin.write(`begin;select pg_advisory_xact_lock(hashtextextended('qualification-finalization:${first}',0));select 'HELD';\n`);await wait(()=>hold.out().includes('HELD'),'first');
 const pending=startSession(call(a.tid,id('d086',18)),'source_set_final_first');
 try{await wait(()=>q("select count(*) from pg_stat_activity where application_name='source_set_final_first' and wait_event_type='Lock';")==='1','writer');const changed=read(retire(a.tid,a.main,id('d086',19)));status(changed,'event_retired');}finally{hold.child.stdin.end('rollback;');await hold.done;}
 const changedResult=JSON.parse((await pending.done).trim().split('\n').findLast(x=>x.startsWith('{')));assert.equal(changedResult.code,'source_changed',JSON.stringify(changedResult));
 const unsupported=read(`select ${workspace}('${actor}','${a.tid}');`);assert.equal(unsupported?.code,'unsupported_event_set',JSON.stringify(unsupported));
 // Final writer holds its source key while waiting on a tournament lock; a
 // supported event retirement then waits behind it and cannot interleave.
 const b=make(2),tournamentGate=gate();
 tournamentGate.child.stdin.write(`begin;select 1 from app.tournaments where id='${b.tid}' for update;select 'HELD';\n`);await wait(()=>tournamentGate.out().includes('HELD'),'second');
 const final=startSession(call(b.tid,id('d086',28)),'source_set_final_second');let change;
 try{await wait(()=>q("select count(*) from pg_stat_activity where application_name='source_set_final_second' and wait_event_type='Lock';")==='1','final waits');change=startSession(`set statement_timeout='15s';${retire(b.tid,b.main,id('d086',29))}`,'source_set_change_second');await wait(()=>q("select count(*) from pg_stat_activity where application_name='source_set_change_second' and wait_event_type='Lock';")==='1','change waits');}finally{tournamentGate.child.stdin.end('rollback;');await tournamentGate.done;}
 const [f,c]=(await Promise.all([final.done,change.done])).map(x=>JSON.parse(x.trim().split('\n').findLast(y=>y.startsWith('{'))));
 assert.equal(f.code,'sources_not_ready',JSON.stringify(f));status(c,'event_retired');
 const extra=make(3,true),extraState=read(`select ${workspace}('${actor}','${extra.tid}');`);assert.equal(extraState?.code,'unsupported_event_set',JSON.stringify(extraState));
 return {mutationFirst:changedResult.code,unsupportedEventSet:unsupported.code,extraEventSet:extraState.code,finalFirst:f.code,subsequentRetirement:c.status};
}
