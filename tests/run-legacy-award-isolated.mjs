// Run ONLY inside the reviewed no-network/no-port/no-mount temporary container.
import assert from 'node:assert/strict';import {captureLegacyAwardRecovery,verifyLegacyAwardRecovery}from'./legacy-award-recovery-sql-acceptance.mjs';import {quote}from'./fixtures/q-review-foundation.mjs';import {preparePrizeAccountingFixtureV8,verifyPrizeAccountingV8}from'./prize-accounting-v8-sql-acceptance.mjs';import {makeSeventeenMainFixture}from'./fixtures/seventeen-main-foundation.mjs';import {verifyNewAwardDenominationGuards}from'./new-award-denomination-sql-acceptance.mjs';import {verifyGraduatedQAmountsV4}from'./graduated-q-v4-sql-acceptance.mjs';import {verifyRegularPrizeRoundingSqlV3}from'./regular-prize-rounding-v3-sql-acceptance.mjs';import {verifyGraduatedPoolAmountsV2Sql}from'./graduated-pool-amounts-v2-sql-acceptance.mjs';import fs from 'node:fs';import crypto from 'node:crypto';import {spawnSync}from'node:child_process';
import {verifyFiveQualifierPlayoffV4,fivePlayoffLocalSqlAdapter}from'./five-qualifier-playoff-sql-acceptance.mjs';
import {makeAccWeightedMainFixture}from'./fixtures/acc-weighted-main-foundation.mjs';
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
 for(let n=237;n<=259;n++){
  const file=fs.readdirSync('database/migrations').find(f=>f.startsWith(String(n).padStart(4,'0')+'_'));if(!file)throw Error('Missing migration '+n);
  const bytes=fs.readFileSync('database/migrations/'+file);console.log('APPLY LOCAL',file,bytes.length,crypto.createHash('sha256').update(bytes).digest('hex'));
  sql('set role postgres;'+bytes.toString('utf8'),db);
 }
 const adapter=fivePlayoffLocalSqlAdapter(),q=adapter.sql,captures=[];
 for(const version of ['v6','v7']){
  const f=makeSeventeenMainFixture({withQ:version==='v6'}),prefix=version==='v6'?'b626':'b627',op=n=>`${prefix}0000-0000-4000-8000-${String(n).padStart(12,'0')}`;
  for(const phase of ['setupSql','financeSql','seatingAttendanceSql','publishSql','startSql','scoreSql','finalizeSql']){console.log('LEGACY',version,phase);q(f[phase]);}
  await verifyFiveQualifierPlayoffV4({...adapter,actor:f.actor,tid:f.tid,eid:f.eid});
  for(const [n,amount,category] of [[1,5100,'sanctioning'],[2,10200,'meals'],[3,5100,'hall_rental'],[4,2550,'cards']]){const r=JSON.parse(q(`select set_config('request.jwt.claim.sub','${f.actor}',false);select public.record_tournament_expense('${f.tid}',${amount},'USD','TEST ONLY ${category}','${op(n)}');`).split('\n').at(-1));assert.equal(r.status,'expense_recorded');}
  if(version==='v6'){const x=JSON.parse(q(`select public.get_q_obligation_review_workspace_v2('${f.actor}','${f.tid}');`));assert.deepEqual(x.blockers,[]);const r=JSON.parse(q(`select public.record_q_obligation_review_v2('${f.actor}','${f.tid}',${quote(JSON.stringify({expectedVersion:0,sourceDigest:x.sourceDigest,reason:'TEST ONLY legacy recovery',reviewed:true}))},'${op(10)}');`));assert.equal(r.status,'q_obligations_recorded_v2');}
  const name=version==='v6'?'q':'no_q';const w=JSON.parse(q(`select public.get_${name}_accounting_workspace_${version}('${f.actor}','${f.tid}','${f.eid}');`));assert.deepEqual(w.blockers,[]);assert.deepEqual(w.regularSchedule.awards.map(x=>x.totalAwardMinor),[9351,7012,4675,4675,2337]);
  const request={expectedVersion:0,sourceDigest:w.sourceDigest,scheduleVersionId:w.regularSchedule.scheduleVersionId,reason:'TEST ONLY legacy cent accounting draft',expenseClassifications:w.facts.expenseEvidence.map(e=>({expenseEventId:e.expenseEventId,category:e.description.replace('TEST ONLY ',''),evidenceReference:'TEST ONLY synthetic expense'})),reviewed:true,...(version==='v6'?{qReviewId:w.qReview.id}:{})};
  const accepted=JSON.parse(q(`select public.save_${name}_accounting_draft_${version}('${f.actor}','${f.tid}','${f.eid}',${quote(JSON.stringify(request))},'${op(20)}');`));assert.equal(accepted.status,`${name}_accounting_draft_saved_${version}`);
  captures.push({version,capture:captureLegacyAwardRecovery(q,{version,actorId:f.actor,tournamentId:f.tid,eventId:f.eid,acceptedOperationId:op(20),acceptedRequest:request,acceptedResponse:accepted},{database:db}),op});
 }
 for(const n of [260,261,262]){const file=fs.readdirSync('database/migrations').find(x=>x.startsWith(String(n).padStart(4,'0')+'_'));const bytes=fs.readFileSync('database/migrations/'+file);console.log('APPLY LOCAL',file,bytes.length,crypto.createHash('sha256').update(bytes).digest('hex'));sql('set role postgres;'+bytes.toString('utf8'),db);}
 for(const c of captures){console.log('VERIFY LEGACY',c.version);verifyLegacyAwardRecovery(q,c.capture,{freshOperationId:c.op(21),finalOperationId:c.op(22)});}
 console.log('PASS v6/v7 genuine legacy cents, durable reject and exact replay');
}finally{docker(['exec',name,'dropdb','-h','/tmp','-U','supabase_admin','--if-exists',db]);console.log('CLEANUP disposable five-dollar database removed');}


