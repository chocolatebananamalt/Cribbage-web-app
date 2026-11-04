// Run ONLY inside the reviewed no-network/no-port/no-mount temporary container.
import fs from 'node:fs';import crypto from 'node:crypto';import {spawnSync}from'node:child_process';
import assert from 'node:assert/strict';import {verifyOddFieldBeforePublication,verifyOddFieldAfterPublication,verifyOddFieldPlayerCards}from'./odd-field-makeup-sql-acceptance.mjs';
import {verifySeventeenAccounting}from'./five-main-accounting-sql-acceptance.mjs';
import {resolveSeventeenSeedTie}from'./five-qualifier-tie-sql-acceptance.mjs';
import {verifyNoQAccountingV7}from'./no-q-accounting-v7-sql-acceptance.mjs';
import {isNoQAccountingWorkspace}from'../src/lib/api/no-q-accounting-v7.ts';
import {makeSeventeenMainFixture}from'./fixtures/seventeen-main-foundation.mjs';
import {verifyFiveQualifierPlayoffV4,fivePlayoffLocalSqlAdapter}from'./five-qualifier-playoff-sql-acceptance.mjs';
if(process.argv.length!==5||process.argv[2]!=='--isolated-container'||process.argv[3]!=='--container-id'||!/^[a-f0-9]{64}$/.test(process.argv[4]))throw Error('Exact disposable container identity required');
const name='cribbage-qaccounting-local',db='fixture_qaccounting';
function docker(args,input){const r=spawnSync('docker',['--context','desktop-linux',...args],{input,encoding:Buffer.isBuffer(input)?undefined:'utf8',maxBuffer:64*1024*1024});if(r.status!==0)throw Error(String(r.stderr));return String(r.stdout);}
const meta=JSON.parse(docker(['inspect',name]))[0];
if(meta.Id!==process.argv[4]||meta.State.Status!=='running'||meta.Config.Labels['codex.fixture']!==name||meta.Image!=='sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706'||meta.HostConfig.NetworkMode!=='none'||Object.keys(meta.HostConfig.PortBindings??{}).length||meta.HostConfig.Binds?.length||meta.Mounts.length||meta.HostConfig.Privileged)throw Error('Disposable isolation mismatch');
const sql=(q,d='postgres')=>docker(['exec','-i',name,'psql','-h','/tmp','-X','-qAt','-U','supabase_admin','-d',d,'-v','ON_ERROR_STOP=1'],q);
const baseline=fs.readFileSync('../cribbage-isolated-db-20261023/empty-post-0236-baseline.dump');if(crypto.createHash('sha256').update(baseline).digest('hex')!=='e0590cbc594af424f3bfd0066ca046ad2a6b0c972d8ce92bb170d9c8e3c92cdc')throw Error('Baseline mismatch');
if(sql(`select count(*)from pg_database where datname='${db}'`).trim()!=='0')throw Error('Existing database; inspect before reset');
const toc=docker(['exec','-i',name,'pg_restore','--list'],baseline);
const owners=[...new Set(toc.split('\n').filter(l=>!l.startsWith(';')).map(l=>l.trim().split(/\s+/).at(-1)).filter(x=>x?.startsWith('supabase_')||['postgres','pgbouncer'].includes(x)))];
for(const owner of [...new Set([...owners,'anon','authenticated','service_role','authenticator','dashboard_user','pgbouncer'])]){if(!/^(?:postgres|pgbouncer|anon|authenticated|service_role|authenticator|dashboard_user|supabase_[a-z_]+)$/.test(owner))throw Error('Invalid role');sql(`do $$begin if not exists(select 1 from pg_roles where rolname='${owner}')then create role ${owner} ${owner==='postgres'?'superuser':'nologin'};end if;end$$;`);}
docker(['exec',name,'createdb','-h','/tmp','-U','supabase_admin','-O','postgres','--template=template0',db]);
try{
 docker(['exec','-i',name,'pg_restore','-h','/tmp','--exit-on-error','-U','supabase_admin','-d',db],baseline);
 for(let n=237;n<=254;n++){
  const file=fs.readdirSync('database/migrations').find(f=>f.startsWith(String(n).padStart(4,'0')+'_'));if(!file)throw Error('Missing migration '+n);
  const bytes=fs.readFileSync('database/migrations/'+file);console.log('APPLY LOCAL',file,bytes.length,crypto.createHash('sha256').update(bytes).digest('hex'));
  sql('set role postgres;'+bytes.toString('utf8'),db);
 }
 const f=makeSeventeenMainFixture();
 for(const phase of ['setupSql','financeSql','seatingAttendanceSql','publishSql','startSql','scoreSql','finalizeSql']){
  console.log('BEGIN seventeen',phase);if(phase==='scoreSql')verifyOddFieldPlayerCards({sql:fivePlayoffLocalSqlAdapter().sql,fixture:f,complete:false});if(phase==='publishSql')verifyOddFieldBeforePublication({sql:fivePlayoffLocalSqlAdapter().sql,fixture:f});sql(f[phase],db);if(phase==='publishSql')verifyOddFieldAfterPublication({sql:fivePlayoffLocalSqlAdapter().sql,fixture:f});if(phase==='scoreSql')verifyOddFieldPlayerCards({sql:fivePlayoffLocalSqlAdapter().sql,fixture:f,complete:true});console.log('PASS seventeen',phase);
 }
 const adapter=fivePlayoffLocalSqlAdapter();
 const proof=await verifyFiveQualifierPlayoffV4({...adapter,actor:f.actor,tid:f.tid,eid:f.eid});
 const accountingChecks=await verifySeventeenAccounting({...adapter,fixture:f});
 fs.writeFileSync('test-results/seventeen-main-sql-result.json',JSON.stringify({status:'PASS',proof,accountingChecks},null,2));
 console.log('PASS seventeen published102 real qualifying games and source-bound five-qualifier playoff');
 if(process.env.FIVE_MAIN_CARD_READERS_ONLY!=='1'){
 const noQ=makeSeventeenMainFixture({withQ:false});
 for(const phase of ['setupSql','financeSql','seatingAttendanceSql','publishSql','startSql','scoreSql','finalizeSql']){
  console.log('BEGIN no-Q seventeen',phase);sql(noQ[phase],db);console.log('PASS no-Q seventeen',phase);
 }
 const noQProof=await verifyFiveQualifierPlayoffV4({...adapter,actor:noQ.actor,tid:noQ.tid,eid:noQ.eid});
 const noQAccounting=await verifyNoQAccountingV7({...adapter,actor:noQ.actor,tid:noQ.tid,eid:noQ.eid,checker:noQ.actor.slice(0,-12)+'000000000007'});
 assert.ok(isNoQAccountingWorkspace(noQAccounting.workspace,noQ.tid,noQ.eid),'Actual no-Q v7 workspace violates application contract');
 fs.writeFileSync('test-results/no-q-seventeen-main-sql-result.json',JSON.stringify({status:'PASS',proof:noQProof,accounting:noQAccounting},null,2));
 console.log('PASS optional Q distinction: separate genuine no-Q102-game five-qualifier Main finalized unpaid without any Q reviews');
 const preserved=()=>sql(`select jsonb_build_object('qFinal',(select to_jsonb(t)from app.q_accounting_finals_v6 t where tournament_id='${f.tid}'),'noQFinal',(select to_jsonb(t)from app.no_q_accounting_finals_v7 t where tournament_id='${noQ.tid}'),'qRows',(select jsonb_agg(to_jsonb(t)order by ranking_ordinal)from app.qualification_result_rows t where tournament_id='${f.tid}'),'noQRows',(select jsonb_agg(to_jsonb(t)order by ranking_ordinal)from app.qualification_result_rows t where tournament_id='${noQ.tid}'));`,db);
 const beforeLegacy=preserved();
 for(const testFile of ['tests/q-obligation-v2-sql-acceptance.mjs','tests/q-accounting-v6-sql-acceptance.mjs']){
  const result=spawnSync(process.execPath,['--experimental-strip-types',testFile],{encoding:'utf8',env:{...process.env,QV2_CONTAINER:name,QV2_DATABASE:db,Q_BRIDGE_CONTAINER:name,Q_BRIDGE_DATABASE:db},maxBuffer:32*1024*1024});
  if(result.status!==0)throw Error(result.stderr+'\n'+result.stdout);console.log(result.stdout);
 }
 assert.equal(preserved(),beforeLegacy,'Existing five-player qualification/finals changed during legacy regressions');
 console.log('PASS legacy four-qualifier Q review/accounting regressions preserve both new qualification/final histories byte-for-byte');
 const tied=makeSeventeenMainFixture({withQ:false,topSeedTie:true});
 for(const phase of ['setupSql','financeSql','seatingAttendanceSql','publishSql','startSql','scoreSql']){console.log('BEGIN tied seventeen',phase);sql(tied[phase],db);console.log('PASS tied seventeen',phase);}
 const tieProof=resolveSeventeenSeedTie({sql:adapter.sql,fixture:tied});
 const tiedBracket=await verifyFiveQualifierPlayoffV4({...adapter,actor:tied.actor,tid:tied.tid,eid:tied.eid});
 const tiedAccounting=await verifyNoQAccountingV7({...adapter,actor:tied.actor,tid:tied.tid,eid:tied.eid,checker:tied.actor.slice(0,-12)+'000000000007'});
 assert.ok(isNoQAccountingWorkspace(tiedAccounting.workspace,tied.tid,tied.eid));
 fs.writeFileSync('test-results/tied-seventeen-main-sql-result.json',JSON.stringify({status:'PASS',tieProof,bracket:tiedBracket,accounting:tiedAccounting},null,2));
 console.log('PASS resolved five-qualifier tie flows through canonical bye MRP and no-Q unpaid final accounting without changing original card totals');
 }



}finally{docker(['exec',name,'dropdb','-h','/tmp','-U','supabase_admin','--if-exists',db]);console.log('CLEANUP disposable five Main database removed');}
