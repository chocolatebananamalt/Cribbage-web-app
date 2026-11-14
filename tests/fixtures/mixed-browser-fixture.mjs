// Bounded LOCAL protocol proof. No network, ports, mounts or hosted operations.
import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {spawnSync,spawn}from'node:child_process';
import {eighteenFixture}from'../eighteen-qualifying-local-acceptance.mjs';
import {isUuid}from'../../src/lib/api/validation.ts';
const name='cribbage-mixed-browser-local',image='sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706';
function docker(args,input,allowed=false){const r=spawnSync('docker',['--context','desktop-linux',...args],{input,encoding:Buffer.isBuffer(input)?undefined:'utf8',maxBuffer:64*1024*1024});if(r.status!==0&&!allowed)throw Error(String(r.stderr||r.stdout));return r;}
export async function withMixedBrowserFixture(run){
assert.equal(docker(['ps','-aq','--filter',`name=^/${name}$`]).stdout.trim(),'','Existing task container: inspect before reuse');
let cid;
try{
 const startup="initdb -D /tmp/mixed-pgdata -U supabase_admin --auth=trust --no-locale --encoding=UTF8 >/tmp/mixed-init.log 2>&1 && exec postgres -D /tmp/mixed-pgdata -k /tmp -c listen_addresses='' -c shared_preload_libraries=pg_stat_statements";
 cid=docker(['run','-d','--pull=never','--name',name,'--label',`codex.fixture=${name}`,'--network','none','--cap-drop=ALL','--security-opt=no-new-privileges','--user','postgres','--entrypoint','/bin/sh',image,'-c',startup]).stdout.trim();assert.match(cid,/^[a-f0-9]{64}$/);
 const inspect=()=>{const m=JSON.parse(docker(['inspect',cid]).stdout)[0];assert.equal(m.Id,cid);assert.equal(m.Config.Labels['codex.fixture'],name);assert.equal(m.Image,image);assert.equal(m.HostConfig.NetworkMode,'none');assert.equal(m.Mounts.length,0);assert.equal(Object.keys(m.HostConfig.PortBindings??{}).length,0);assert.equal(m.HostConfig.Privileged,false);return m;};inspect();
 let ready=false;for(let n=0;n<60;n++){if(docker(['exec',cid,'pg_isready','-h','/tmp','-U','supabase_admin'],undefined,true).status===0){ready=true;break;}await new Promise(r=>setTimeout(r,500));}assert.ok(ready);
 const db='fixture_mixed_browser',raw=q=>docker(['exec','-i',cid,'psql','-h','/tmp','-U','supabase_admin','-d',db,'-X','-qAt','-v','ON_ERROR_STOP=1'],q).stdout;
 const admin=q=>docker(['exec','-i',cid,'psql','-h','/tmp','-U','supabase_admin','-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1'],q).stdout;
 const baseline=fs.readFileSync('../cribbage-isolated-db-20261023/empty-post-0236-baseline.dump');assert.equal(crypto.createHash('sha256').update(baseline).digest('hex'),'e0590cbc594af424f3bfd0066ca046ad2a6b0c972d8ce92bb170d9c8e3c92cdc');
 const toc=String(docker(['exec','-i',cid,'pg_restore','--list'],baseline).stdout);const owners=[...new Set(toc.split('\n').filter(l=>!l.startsWith(';')).map(l=>l.trim().split(/\s+/).at(-1)).filter(x=>x?.startsWith('supabase_')||['postgres','pgbouncer'].includes(x)))];
 for(const owner of new Set([...owners,'anon','authenticated','service_role','authenticator','dashboard_user','pgbouncer'])){assert.match(owner,/^(?:postgres|pgbouncer|anon|authenticated|service_role|authenticator|dashboard_user|supabase_[a-z_]+)$/);admin(`do $$begin if not exists(select 1 from pg_roles where rolname='${owner}')then create role ${owner} ${owner==='postgres'?'superuser':'nologin'};end if;end$$;`);}
 docker(['exec',cid,'createdb','-h','/tmp','-U','supabase_admin','-O','postgres','--template=template0',db]);docker(['exec','-i',cid,'pg_restore','-h','/tmp','--exit-on-error','-U','supabase_admin','-d',db],baseline);
 const apply=n=>{const file=fs.readdirSync('database/migrations').find(f=>f.startsWith(String(n).padStart(4,'0')+'_'));assert.ok(file);raw('set role postgres;'+fs.readFileSync('database/migrations/'+file,'utf8'));};
 for(let n=237;n<=266;n++)apply(n);
 const f=eighteenFixture(),digital=[1,2,3,5,7,9],keep=new Set(digital.map(n=>f.rid(n)));
 f.setupSql=f.setupSql.replace("'Synthetic Qualification'","'TEST ONLY Mixed Protocol'").replace(`'digital','${f.actor}'`,`case when n in(${digital})then'digital'else'paper'end,'${f.actor}'`);
 const profileExpr=`('${f.uid(1).slice(0,24)}'||lpad(n::text,12,'0'))::uuid`;
 assert.ok(f.setupSql.includes(profileExpr));f.setupSql=f.setupSql.replace(profileExpr,`case when n in(${digital})then ${profileExpr} else null end`);
 f.setupSql=f.setupSql.replace(/insert into app\.roster_account_links[\s\S]*?;/g,s=>[...keep].some(id=>s.includes(id))?s:'');
 const q=(query,actor=f.actor,role='service_role')=>raw(`set role ${role==='authenticated'?'authenticated':'postgres'};set request.jwt.claim.role='${role}';set request.jwt.claim.sub='${actor}';set request.jwt.claims='{"role":"${role}","sub":"${actor}"}';`+query).trim();
 q(f.setupSql);
 for(let n=267;n<=292;n++)apply(n);
 for(const phase of['financeSql','seatingAttendanceSql','publishSql','startSql'])q(f[phase]);
 const proposal=fs.readFileSync('database/proposals/synthetic-mixed-evidence-v1.sql','utf8');assert.equal(crypto.createHash('sha256').update(proposal).digest('hex'),'f8248a1afb60e62a563fcd0369e085c115333b6f1631a4c1d7ea774202f112a3');q(proposal);const additive=fs.readFileSync('database/proposals/synthetic-mixed-evidence-v2.sql','utf8');q(additive);q(fs.readFileSync('database/proposals/synthetic-mixed-api-capability-v1.sql','utf8'));console.log('PASS local mixed/browser fixture schema installed');
 const read=(query,actor=f.actor,role='service_role')=>{const line=q(query,actor,role).split('\n').filter(Boolean).at(-1);return line==='t'?true:line==='f'?false:line===undefined?null:JSON.parse(line);};
 const startSession=(query,actor=f.actor,role='service_role',tag='mixed18-race')=>{const child=spawn('docker',['--context','desktop-linux','exec','-i',cid,'psql','-h','/tmp','-U','supabase_admin','-d',db,'-X','-qAt','-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']});let out='',err='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);const done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>code===0?resolve(out):reject(Error(err)));});child.stdin.end(`set role ${role==='authenticated'?'authenticated':'postgres'};set request.jwt.claim.role='${role}';set request.jwt.claim.sub='${actor}';set request.jwt.claims='{"role":"${role}","sub":"${actor}"}';set application_name='${tag}';`+query);return{done,out:()=>out};};
 const rpcDefinitions={
  get_synthetic_mixed_capability_v2:['service_role',[['p_actor_id','uuid'],['p_tournament_id','uuid'],['p_event_id','uuid']]],
  get_own_synthetic_mixed_hybrid_v1:['authenticated',[['tid','uuid'],['eid','uuid'],['gid','uuid']]],
  attest_synthetic_mixed_hybrid_v1:['authenticated',[['p_tournament_id','uuid'],['p_event_id','uuid'],['p_request','jsonb'],['p_operation_id','uuid']]],
  get_synthetic_mixed_workspace_v1:['service_role',[['actor','uuid'],['tid','uuid']]],
  get_paper_game_completion_workspace_v1:['service_role',[['p_actor_id','uuid'],['p_tournament_id','uuid']]],
  get_hybrid_game_workspace_v1:['service_role',[['p_actor_id','uuid'],['p_tournament_id','uuid']]],
  capture_synthetic_mixed_paper_v1:['service_role',[['actor','uuid'],['tid','uuid'],['eid','uuid'],['request','jsonb'],['operation','uuid']]],
  review_synthetic_mixed_paper_v1:['service_role',[['actor','uuid'],['tid','uuid'],['eid','uuid'],['request','jsonb'],['operation','uuid']]],
  capture_synthetic_mixed_hybrid_v1:['service_role',[['actor','uuid'],['tid','uuid'],['eid','uuid'],['request','jsonb'],['operation','uuid']]],
  review_synthetic_mixed_hybrid_v1:['service_role',[['actor','uuid'],['tid','uuid'],['eid','uuid'],['request','jsonb'],['operation','uuid']]],
  get_game_play_gate_v1:['authenticated',[['p_game_id','uuid']]],
  submit_game_score:['authenticated',[['p_game_id','uuid'],['p_submission_id','uuid'],['p_submission_slot','smallint'],['p_winner_side','text'],['p_margin','integer'],['p_idempotency_key','uuid']]],
  confirm_game_score:['authenticated',[['p_game_id','uuid'],['p_submission_id','uuid'],['p_idempotency_key','uuid']]],
  issue_offline_submission_capability_v1:['service_role',[['p_actor_id','uuid'],['p_session_binding_id','uuid'],['p_game_id','uuid'],['p_capability_id','uuid'],['p_device_key_id','uuid'],['p_public_jwk','public_jwk']]],
  get_offline_submission_capability_v1:['service_role',[['p_actor_id','uuid'],['p_session_binding_id','uuid'],['p_capability_id','uuid'],['p_queue_id','uuid']]],
  replay_offline_submission_v1:['service_role',[['p_actor_id','uuid'],['p_session_binding_id','uuid'],['p_queue_id','uuid'],['p_client_operation_id','uuid'],['p_capability_id','uuid'],['p_device_key_id','uuid'],['p_tournament_id','uuid'],['p_event_id','uuid'],['p_game_id','uuid'],['p_assigned_side','text'],['p_expected_game_version','integer'],['p_submission_id','uuid'],['p_submission_slot','smallint'],['p_winner_side','text'],['p_margin','integer'],['p_payload_digest','sha256'],['p_signature','signature']]],
  record_offline_submission_rejection_v1:['service_role',[['p_actor_id','uuid'],['p_session_binding_id','uuid'],['p_queue_id','uuid'],['p_client_operation_id','uuid'],['p_capability_id','uuid'],['p_device_key_id','uuid'],['p_tournament_id','uuid'],['p_event_id','uuid'],['p_game_id','uuid'],['p_submission_id','uuid'],['p_payload_digest','sha256'],['p_signature','signature'],['p_reason_code','rejection_reason']]],
 };
 const literal=(value,type)=>{
  if(type==='uuid'&&!isUuid(value))throw Error('Invalid fixture UUID');
  if(['integer','smallint'].includes(type)){if(!Number.isSafeInteger(value))throw Error('Invalid fixture integer');return `${value}::${type}`;}
  if(type==='boolean'){if(typeof value!=='boolean')throw Error('Invalid fixture boolean');return value?'true':'false';}
  if(type==='public_jwk'){
   if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='crv,ext,key_ops,kty,x,y'||value.kty!=='EC'||value.crv!=='P-256'||value.ext!==true
    ||!Array.isArray(value.key_ops)||value.key_ops.length!==1||value.key_ops[0]!=='verify'||![value.x,value.y].every(v=>typeof v==='string'&&/^[A-Za-z0-9_-]{40,60}$/.test(v)))throw Error('Invalid fixture public JWK');
   type='jsonb';
  }
  if(type==='jsonb'){if(!value||typeof value!=='object'||Array.isArray(value)||JSON.stringify(value).length>4096)throw Error('Invalid fixture JSON');value=JSON.stringify(value);}
  else if(type==='text'&&!['a','b'].includes(value))throw Error('Invalid fixture winner');
  else if(type==='sha256'){if(typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value))throw Error('Invalid fixture digest');type='text';}
  else if(type==='signature'){if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,256}$/.test(value))throw Error('Invalid fixture signature');type='text';}
  else if(type==='rejection_reason'){if(!['capability_unavailable','scope_mismatch','invalid_signature'].includes(value))throw Error('Invalid fixture rejection reason');type='text';}
  return "'"+String(value).replaceAll("'","''")+"'::"+type;
 };
 const rpc=async(name,args,actorId,role)=>{try{const definition=rpcDefinitions[name];if(!definition||role!==definition[0]||!isUuid(actorId)||!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).sort().join(',')!==definition[1].map(v=>v[0]).sort().join(','))throw Error('Unsupported isolated fixture RPC');for(const key of ['actor','p_actor_id'])if(key in args&&args[key].toLowerCase()!==actorId.toLowerCase())throw Error('Fixture actor mismatch');const values=definition[1].map(([key,type])=>`${key}=>${literal(args[key],type)}`).join(',');const response=read(`set role ${role};select to_jsonb(public.${name}(${values}));`,actorId,role);return{data:response,error:null};}catch(error){return{data:null,error:{message:String(error.message)}};}};
 q("insert into app.synthetic_mixed_deployments_v1 values('nnhcnvksxgxnpvdqjgpg','LOCAL isolated browser fixture only');");
 q(`select app.enroll_synthetic_mixed_fixture_v2('${f.tid}','${f.eid}','nnhcnvksxgxnpvdqjgpg','LOCAL browser fixture; no human auth-provider acceptance');`);
 const bindId=n=>`a2970000-0000-4000-8000-${String(n).padStart(12,'0')}`,checkers=[1,3,5].map(n=>f.uid(n));
 for(const[i,n]of[1,3,5].entries()){q(`insert into app.tournament_roles(tournament_id,profile_id,role)values('${f.tid}','${f.uid(n)}','cross_checker');${i===0?`insert into app.tournament_roles(tournament_id,profile_id,role)values('${f.tid}','${f.uid(n)}','co_director');`:''}`);assert.equal(read(`select public.bind_paper_official_identity_v1('${f.actor}','${f.tid}','${bindId(i)}','${f.uid(n)}','roster_entry','${f.rid(n)}',0,'${bindId(10+i)}');`).status,'bound');}
 const people=read(`select jsonb_agg(jsonb_build_object('participantId',p.id,'profileId',p.profile_id,'mode',r.scorecard_type,'tournamentPlayerId',s.verification_id)order by p.id)from app.event_participants p join app.tournament_roster_entries r on r.id=p.roster_entry_id join app.initial_seating_assignments s on s.tournament_id=p.tournament_id and s.roster_entry_id=p.roster_entry_id where p.event_id='${f.eid}';`);
 const games=read(`select jsonb_agg(jsonb_build_object('gameId',g.id,'gameNumber',r.round_number,'pairing',m.pairing,'a',g.side_a_participant_id,'b',g.side_b_participant_id,'digitalProfileId',m.digital_profile_id,'digitalParticipantId',m.digital_participant_id)order by r.round_number,g.side_a_table_seat_snapshot)from app.canonical_games g join app.rounds r on r.id=g.round_id join app.synthetic_mixed_games_v1 m on m.game_id=g.id where g.event_id='${f.eid}';`);
 q(games.filter(g=>g.gameNumber===1&&g.pairing!=='DD').map(g=>`select app.prepare_synthetic_mixed_artifact_v1('${g.gameId}','a',40);`).join(''));
 assert.equal(read(`select count(*)from app.score_submissions where event_id='${f.eid}';`),0);assert.equal(read(`select count(*)from app.card_scorelines where event_id='${f.eid}';`),0);
 const result=await run({fixture:f,q,read,rpc,startSession,games,people,checkers,containerId:cid});inspect();return result;
}finally{if(cid){const m=JSON.parse(docker(['inspect',cid]).stdout)[0];assert.equal(m.Id,cid);assert.equal(m.Config.Labels['codex.fixture'],name);docker(['rm','-f',cid]);assert.equal(docker(['ps','-aq','--filter',`id=${cid}`]).stdout.trim(),'');console.log('CLEANUP exact task container removed; absence verified');}}

}
