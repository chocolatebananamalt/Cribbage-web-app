// Run ONLY inside the reviewed no-network/no-port/no-mount temporary container.
import {prepareSideRecipientV3,verifySideRecipientV3}from'./side-recipient-v3-sql-acceptance.mjs';import {preparePrizeAccountingFixtureV8,verifyPrizeAccountingV8}from'./prize-accounting-v8-sql-acceptance.mjs';import {makeSeventeenMainFixture}from'./fixtures/seventeen-main-foundation.mjs';import {verifyNewAwardDenominationGuards}from'./new-award-denomination-sql-acceptance.mjs';import {verifyGraduatedQAmountsV4}from'./graduated-q-v4-sql-acceptance.mjs';import {verifyRegularPrizeRoundingSqlV3}from'./regular-prize-rounding-v3-sql-acceptance.mjs';import {verifyGraduatedPoolAmountsV2Sql}from'./graduated-pool-amounts-v2-sql-acceptance.mjs';import {spawn}from'node:child_process';import fs from 'node:fs';import crypto from 'node:crypto';import {spawnSync}from'node:child_process';
import {verifyFiveQualifierPlayoffV4,fivePlayoffLocalSqlAdapter}from'./five-qualifier-playoff-sql-acceptance.mjs';
import {makeAccWeightedMainFixture}from'./fixtures/acc-weighted-main-foundation.mjs';
if(process.argv.length!==5||process.argv[2]!=='--isolated-container'||process.argv[3]!=='--container-id'||!/^[a-f0-9]{64}$/.test(process.argv[4]))throw Error('Exact disposable container identity required');
const name='cribbage-v8-compat-local',db='fixture_v8_compat';
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
 for(let n=237;n<=265;n++){
  const file=fs.readdirSync('database/migrations').find(f=>f.startsWith(String(n).padStart(4,'0')+'_'));if(!file)throw Error('Missing migration '+n);
  const bytes=fs.readFileSync('database/migrations/'+file);console.log('APPLY LOCAL',file,bytes.length,crypto.createHash('sha256').update(bytes).digest('hex'));
  sql('set role postgres;'+bytes.toString('utf8'),db);
 }
 const q=query=>sql("set role postgres;set request.jwt.claim.role='service_role';set request.jwt.claims='{\"role\":\"service_role\"}';"+query,db).trim();
 const hasQ=process.env.SIDE_ONLY!=='1';const f=preparePrizeAccountingFixtureV8(hasQ?makeAccWeightedMainFixture():makeSeventeenMainFixture({withQ:false}));
 if(hasQ)f.publishPoliciesSql=f.publishPoliciesSql.replaceAll('save_q_operating_policy_v3','save_q_operating_policy_v4').replaceAll('acc-weighted-largest-remainder-5usd-v1','graduated-acc-weighted-largest-remainder-5usd-v2');
 q(f.setupSql);if(hasQ)q(f.publishPoliciesSql);q(f.financeSql);q(f.seatingAttendanceSql);q(f.publishSql);
 const read=query=>JSON.parse(q(query).split('\n').filter(Boolean).at(-1)),json=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb",op=n=>'b2650000-0000-4000-8000-'+String(n).padStart(12,'0');
 q(f.startSql);q(f.scoreSql);q(f.finalizeSql);
 const pw=read(`select public.get_standard_singles_playoff_outcome_workspace_v4('${f.actor}','${f.tid}','${f.eid}');`),ids=pw.qualifiers.map(x=>x.participantId);
 const series=[[ids[3],ids[4]],[ids[0],ids[3]],[ids[1],ids[2]],[ids[0],ids[1]]].map(([winnerId,loserId])=>({winnerId,loserId,evidenceNote:'TEST ONLY synthetic playoff'}));
 const po=read(`select public.record_standard_singles_playoff_outcomes_v4('${f.actor}','${f.tid}','${f.eid}',${json({qualificationResultVersionId:pw.qualificationResultVersionId,expectedVersion:0,sourceDigest:pw.sourceDigest,series,reason:'TEST ONLY combined event playoff',reviewed:true})},'${op(4)}');`);if(po.status!=='playoff_outcomes_recorded_v4')throw Error(JSON.stringify(po));
 const compat=await verifyPrizeAccountingV8({sql:q,fixture:f,down:true});fs.writeFileSync('test-results/'+(hasQ?'q-only':'no-q')+'-v8-after-0265-result.json',JSON.stringify({status:'PASS',hasQ,checks:compat.checks,finalResult:compat.finalResult,originalIdentitySha256:compat.originalIdentitySha256},null,2));console.log('PASS ordinary '+(hasQ?'Q-only':'no-Q')+' v8 after0265',JSON.stringify(compat.checks));
 const startSession=query=>{const p=spawn('docker',['--context','desktop-linux','exec','-i',name,'psql','-h','/tmp','-X','-qAt','-U','supabase_admin','-d',db,'-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']});let out='',err='';p.stdout.on('data',x=>out+=x);p.stderr.on('data',x=>err+=x);const done=new Promise((resolve,reject)=>{p.on('error',reject);p.on('close',code=>code===0?resolve(out.trim()):reject(Error(err)));});p.stdin.end(query);return{done,out:()=>out};};

}finally{docker(['exec',name,'dropdb','-h','/tmp','-U','supabase_admin','--if-exists',db]);console.log('CLEANUP disposable Side recipient database removed');}
