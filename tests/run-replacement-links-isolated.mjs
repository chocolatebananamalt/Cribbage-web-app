// Isolated synthetic evidence SQL runner. No hosted service access.
import {verifySimulatedLinks,verifySimulationEnrollmentRace}from'./simulated-player-links-sql-acceptance.mjs';
import fs from 'node:fs';import crypto from 'node:crypto';import {spawnSync,spawn}from'node:child_process';
if(process.argv.length!==5||process.argv[2]!=='--isolated-container'||process.argv[3]!=='--container-id'||!/^[a-f0-9]{64}$/.test(process.argv[4]))throw Error('Exact disposable container identity required');
const name='cribbage-replacement-links-local';let db='fixture_replacement_links';const mainDb=db;const createdDbs=[db];
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
 for(let n=237;n<=271;n++){
  const file=fs.readdirSync('database/migrations').find(f=>f.startsWith(String(n).padStart(4,'0')+'_'));if(!file)throw Error('Missing migration '+n);
  const bytes=fs.readFileSync('database/migrations/'+file);console.log('APPLY LOCAL',file,bytes.length,crypto.createHash('sha256').update(bytes).digest('hex'));
  sql('set role postgres;'+bytes.toString('utf8'),db);
 }
 const q=query=>sql("set role postgres;set request.jwt.claim.role='service_role';set request.jwt.claims='{\"role\":\"service_role\"}';"+query,db).trim();
 const read=query=>{const v=q(query).split('\n').filter(Boolean).at(-1);return v===undefined?null:v==='t'?true:v==='f'?false:JSON.parse(v);};
 const startSession=(query,tag)=>{const child=spawn('docker',['--context','desktop-linux','exec','-i',name,'psql','-h','/tmp','-X','-qAt','-U','supabase_admin','-d',db,'-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']});let out='',err='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);const done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>code===0?resolve(out):reject(Error(err)));});child.stdin.end(`set role postgres;set request.jwt.claim.role='service_role';set request.jwt.claims='{\"role\":\"service_role\"}';set application_name='${tag}';`+query);return{done,out:()=>out};};
 const emptyDb='fixture_replacement_empty';sql(`create database ${emptyDb} with template ${mainDb} owner postgres`);createdDbs.push(emptyDb);
 const original=await verifySimulatedLinks({sql:q,read,startSession});
 const protectedRows=()=>read("select jsonb_build_object('links',(select md5(jsonb_agg(to_jsonb(x)order by id)::text)from app.roster_account_links x),'provenance',(select md5(jsonb_agg(to_jsonb(x)order by link_id)::text)from app.simulated_player_link_provenance_v1 x),'scope',(select md5(jsonb_agg(to_jsonb(x)order by tournament_id)::text)from app.simulated_player_link_scopes_v1 x),'receipts',(select md5(jsonb_agg(to_jsonb(x)order by id)::text)from app.operation_receipts x))");
 const prior=protectedRows(),migration=fs.readFileSync('database/migrations/0272_replacement_simulated_links_v1.sql','utf8');q(migration);
 if(JSON.stringify(prior)!==JSON.stringify(protectedRows()))throw Error('Existing simulation history changed');
 if(read("select public.get_simulated_player_link_scope_v1('de0f27a1-60d0-4449-af83-fdf360a9bc08','3c58ef91-010c-4769-af20-5cfa2ffe98a9')")!==true)throw Error('Original scope lost');
 console.log('PASS0272 preserves accepted original links/provenance/receipts/scope');
 db=emptyDb;q(migration);
 const replacement='fd0589d0-31e7-4921-b793-1beec2431337',old='3c58ef91-010c-4769-af20-5cfa2ffe98a9';
 const transform=s=>s.replaceAll(old,replacement);
 const adapted={sql:s=>q(transform(s)),read:s=>read(transform(s)),startSession:(s,tag)=>startSession(transform(s),tag)};
 const races=[];
 for(const order of ['enrollment-first','link-first']){const clone='fixture_replacement_'+order.replace('-','_');sql(`create database ${clone} with template ${emptyDb} owner postgres`);createdDbs.push(clone);db=clone;races.push(await verifySimulationEnrollmentRace(adapted,order));}
 db=emptyDb;const replacementResult=await verifySimulatedLinks(adapted);
 const third='b2720000-0000-4000-8000-000000000999',operator='de0f27a1-60d0-4449-af83-fdf360a9bc08';
 let blocked=false;try{q(`begin;insert into app.tournaments(id,director_profile_id,name,status)values('${third}','${operator}','LOCAL unrelated','draft');insert into app.simulated_player_link_scopes_v1(tournament_id,project_ref,operator_profile_id,authorization_reference)values('${third}','nnhcnvksxgxnpvdqjgpg','${operator}','LOCAL TEST must reject');commit;`);}catch(error){if(!/check constraint/.test(String(error)))throw error;blocked=true;}if(!blocked)throw Error('Third fixture allowed');
 q(`insert into app.tournament_roles(tournament_id,profile_id,role)values('${replacement}','b2700000-0000-4000-8000-000000000099','co_director');`);
 if(read(`select public.get_simulated_player_link_scope_v1('b2700000-0000-4000-8000-000000000099','${replacement}')`)!==false)throw Error('Third official profile allowed');
 console.log('PASS exact third-fixture rejection and third-profile denial even with co-director role');

 const result={passed:true,original,replacement:replacementResult,races,originalHistoryPreserved:true};
 fs.writeFileSync('test-results/replacement-links-sql-result.json',JSON.stringify(result,null,2));console.log('PASS synthetic evidence',JSON.stringify(result));
}finally{for(const cleanupDb of createdDbs)docker(['exec',name,'dropdb','-h','/tmp','-U','supabase_admin','--if-exists',cleanupDb]);console.log('CLEANUP disposable synthetic evidence database removed');}
