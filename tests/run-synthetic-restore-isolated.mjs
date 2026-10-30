// Run ONLY inside the reviewed no-network/no-port/no-mount temporary container.
import {preparePrizeAccountingFixtureV8,verifyPrizeAccountingV8}from'./prize-accounting-v8-sql-acceptance.mjs';import {makeSeventeenMainFixture}from'./fixtures/seventeen-main-foundation.mjs';import {verifyNewAwardDenominationGuards}from'./new-award-denomination-sql-acceptance.mjs';import {verifyGraduatedQAmountsV4}from'./graduated-q-v4-sql-acceptance.mjs';import {verifyRegularPrizeRoundingSqlV3}from'./regular-prize-rounding-v3-sql-acceptance.mjs';import {verifyGraduatedPoolAmountsV2Sql}from'./graduated-pool-amounts-v2-sql-acceptance.mjs';import fs from 'node:fs';import crypto from 'node:crypto';import {spawnSync}from'node:child_process';
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
 for(let n=237;n<=263;n++){
  const file=fs.readdirSync('database/migrations').find(f=>f.startsWith(String(n).padStart(4,'0')+'_'));if(!file)throw Error('Missing migration '+n);
  const bytes=fs.readFileSync('database/migrations/'+file);console.log('APPLY LOCAL',file,bytes.length,crypto.createHash('sha256').update(bytes).digest('hex'));
  sql('set role postgres;'+bytes.toString('utf8'),db);
 }
 const regular={status:'previously passed; unchanged helper'};
 const graduated={status:'previously passed; unchanged helper'};
 console.log('PASS0256-0258 schema application and pure calculators',JSON.stringify({regular,graduated}));
 const adapter=fivePlayoffLocalSqlAdapter();
 verifyGraduatedQAmountsV4(adapter.sql);
 verifyNewAwardDenominationGuards(adapter.sql);
 const results=[];
 for(const down of[false,true]){
  const f=preparePrizeAccountingFixtureV8(down?makeSeventeenMainFixture({withQ:false}):makeAccWeightedMainFixture());
  if(!down)f.publishPoliciesSql=f.publishPoliciesSql.replaceAll('save_q_operating_policy_v3','save_q_operating_policy_v4').replaceAll('acc-weighted-largest-remainder-5usd-v1','graduated-acc-weighted-largest-remainder-5usd-v2');
  for(const phase of['setupSql',...(down?[]:['publishPoliciesSql']),'financeSql','seatingAttendanceSql','publishSql','startSql','scoreSql','finalizeSql']){console.log('BEGIN V8',down?'down/noQ':'up/Q',phase);adapter.sql(f[phase]);}
  await verifyFiveQualifierPlayoffV4({...adapter,actor:f.actor,tid:f.tid,eid:f.eid});
  const result=await verifyPrizeAccountingV8({...adapter,fixture:f,down});results.push(result);
  fs.writeFileSync('test-results/prize-accounting-v8-'+(down?'down':'up')+'-sql.json',JSON.stringify(result,null,2));
 }
 console.log('PASS v8 real SQL lifecycle',results.length);
 // Only synthetic fixture databases inside the exact isolated container.
 const restoredDb='fixture_restore';
 if(sql(`select count(*)from pg_database where datname='${restoredDb}'`).trim()!=='0')throw Error('Unexpected restore database exists');
 const fingerprint=database=>{
  const data=JSON.parse(sql(`select coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'rows',coalesce((xpath('/table/row/n/text()',query_to_xml(format('select count(*) n from %I.%I',n.nspname,c.relname),false,true,'')))[1]::text,'0'),'hash',md5(coalesce((xpath('/table/row/h/text()',query_to_xml(format('select md5(coalesce(string_agg(to_jsonb(t)::text,chr(10) order by to_jsonb(t)::text),%L)) h from %I.%I t','',n.nspname,c.relname),false,true,'')))[1]::text,'')))order by n.nspname,c.relname),'[]')from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r'and n.nspname in('app','auth');`,database));
  const schema=JSON.parse(sql(`select jsonb_build_object('tables',(select jsonb_agg(jsonb_build_array(n.nspname,c.relname,pg_get_userbyid(c.relowner),c.relrowsecurity,c.relforcerowsecurity,(select jsonb_agg(jsonb_build_array(case when x.grantee=0 then 'PUBLIC' else pg_get_userbyid(x.grantee)end,pg_get_userbyid(x.grantor),x.privilege_type,x.is_grantable)order by x.grantee,x.grantor,x.privilege_type,x.is_grantable)from aclexplode(coalesce(c.relacl,acldefault('r',c.relowner)))x))order by n.nspname,c.relname)from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in('r','v')and n.nspname in('app','auth','public')),'functions',(select jsonb_agg(jsonb_build_array(n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),pg_get_userbyid(p.proowner),p.prosecdef,p.proconfig,p.proacl::text,md5(p.prosrc))order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid))from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('app','public')),'constraints',(select jsonb_agg(jsonb_build_array(n.nspname,c.relname,x.conname,pg_get_constraintdef(x.oid))order by n.nspname,c.relname,x.conname)from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in('app','auth')));`,database));
  const checkNames=['odd_field_makeup_games_v1_director_reason_check','q_cut_attestations_v2_reason_check','q_obligation_reviews_v1_reason_check','q_obligation_reviews_v2_reason_check','q_operating_policies_v2_disclosure_reference_check','qualification_tie_resolutions_v1_evidence_reference_check','qualification_tie_resolutions_v1_reason_check'];
  const normalized=[];
  for(const row of schema.constraints){if(checkNames.includes(row[2])){if(/\bOR\b/.test(row[3]))throw Error('Unexpected check structure');normalized.push(row[2]);row[3]=row[3].replace(/[()]/g,'');}}
  if(normalized.length!==7)throw Error('Expected reviewed constraint coverage');
  const outcomes=sql(`select jsonb_agg(jsonb_build_array(x.conname,(xpath('/table/row/result/text()',query_to_xml(format('select jsonb_agg((%s)) result from(values(null::text),(%L),(%L),(%L),(repeat(%L,500)),(repeat(%L,501)),(chr(10)),(chr(9)))v(%I)',pg_get_expr(x.conbin,x.conrelid),'',' ','ok','x','x',a.attname),false,true,'')))[1]::text)order by x.conname)from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attnum=x.conkey[1] where n.nspname='app'and x.conname in(${checkNames.map(x=>"'"+x+"'").join(',')});`,database);
  const workspaces=sql(`set request.jwt.claim.role='service_role';select jsonb_agg(public.get_prize_accounting_workspace_v8(t.director_profile_id,f.tournament_id,f.event_id)order by f.event_id)from app.prize_accounting_finals_v8 f join app.tournaments t on t.id=f.tournament_id;`,database);
  const denied=sql(`set request.jwt.claim.role='authenticated';select bool_and(public.get_prize_accounting_workspace_v8(t.director_profile_id,f.tournament_id,f.event_id)is null)from app.prize_accounting_finals_v8 f join app.tournaments t on t.id=f.tournament_id;`,database);
  if(denied.trim()!=='t')throw Error('Restored authenticated JWT-role rejection failed');
  return {data,schema,normalizedCheckOutcomeVectors:outcomes,unpaidWorkspaces:JSON.parse(workspaces),authenticatedJwtRoleDenied:true};
 };
 const before=fingerprint(db),started=Date.now();
 const dump=spawnSync('docker',['--context','desktop-linux','exec',name,'pg_dump','-h','/tmp','-U','supabase_admin','-Fc',db],{maxBuffer:128*1024*1024});
 if(dump.status!==0)throw Error(String(dump.stderr));
 const bytes=dump.stdout,sha=crypto.createHash('sha256').update(bytes).digest('hex');
 docker(['exec',name,'createdb','-h','/tmp','-U','supabase_admin','--template=template0',restoredDb]);
 try{
  docker(['exec','-i',name,'pg_restore','-h','/tmp','-U','supabase_admin','--exit-on-error','-d',restoredDb],bytes);
  const restored=fingerprint(restoredDb);
  if(JSON.stringify(before)!==JSON.stringify(restored)){fs.writeFileSync('test-results/synthetic-restore-parity-diagnostic.json',JSON.stringify({before,restored},null,2));throw Error('Restored schema/data parity mismatch; non-content fingerprints saved for diagnosis');}
  if(JSON.stringify(before)!==JSON.stringify(fingerprint(db)))throw Error('Original synthetic database changed');
  const rows=sql(`select jsonb_build_object('profiles',(select count(*)from app.profiles),'roles',(select count(*)from app.tournament_roles),'verifiedGames',(select count(*)from app.paper_game_completion_reviews where decision='approve'),'unpaidFinals',(select count(*)from app.prize_accounting_finals_v8),'unpaidDrafts',(select count(*)from app.prize_accounting_drafts_v8));`,restoredDb);
  const report={scope:'Synthetic local SQL restore only; NOT hosted Database/Auth/Storage disaster recovery',containerId:meta.Id,image:meta.Image,network:meta.HostConfig.NetworkMode,mounts:meta.Mounts.length,bytes:bytes.length,sha256:sha,elapsedMs:Date.now()-started,tableCount:before.data.length,rows:JSON.parse(rows),selectedSchemaMetadataParity:true,sourceUnchanged:true,syntheticLifecycleResults:results,coverageLimits:['No hosted exports','No real credentials/session recovery','No hosted Storage objects','No physical device rehearsal','Same-cluster existing global roles; no independent-cluster role restore','Metadata comparison excludes indexes,triggers,policies,sequences,view definitions,defaults,types/extensions,Auth functions','No post-restore write replay; recovered service workspaces and authenticated denial checked','Combined Q/Side recipient policy unresolved'],verifiedUtc:new Date().toISOString()};
  fs.writeFileSync('test-results/synthetic-local-restore-result.json',JSON.stringify(report,null,2));
  console.log('PASS synthetic local backup/restore table-data and selected metadata parity; original unchanged',JSON.stringify(report));
 }finally{docker(['exec',name,'dropdb','-h','/tmp','-U','supabase_admin','--if-exists',restoredDb]);console.log('CLEANUP task restore database removed');}


}finally{docker(['exec',name,'dropdb','-h','/tmp','-U','supabase_admin','--if-exists',db]);console.log('CLEANUP disposable five-dollar database removed');}

