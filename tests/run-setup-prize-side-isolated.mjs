// Isolated synthetic evidence SQL runner. No hosted service access.
import {verifySetupPrizeSide}from'./setup-prize-side-sql-acceptance.mjs';
import fs from 'node:fs';import crypto from 'node:crypto';import {spawnSync,spawn}from'node:child_process';
if(process.argv.length!==5||process.argv[2]!=='--isolated-container'||process.argv[3]!=='--container-id'||!/^[a-f0-9]{64}$/.test(process.argv[4]))throw Error('Exact disposable container identity required');
const name='cribbage-setup-prize-local',db='fixture_setup_prize_side';
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
 for(let n=237;n<=267;n++){
  const file=fs.readdirSync('database/migrations').find(f=>f.startsWith(String(n).padStart(4,'0')+'_'));if(!file)throw Error('Missing migration '+n);
  const bytes=fs.readFileSync('database/migrations/'+file);console.log('APPLY LOCAL',file,bytes.length,crypto.createHash('sha256').update(bytes).digest('hex'));
  sql('set role postgres;'+bytes.toString('utf8'),db);
 }
 const q=query=>sql("set role postgres;set request.jwt.claim.sub='a2680000-0000-4000-8000-000000000001';set request.jwt.claim.role='service_role';set request.jwt.claims='{\"role\":\"service_role\"}';"+query,db).trim();
 const read=query=>{const v=q(query).split('\n').filter(Boolean).at(-1);return v===undefined?null:v==='t'?true:v==='f'?false:JSON.parse(v);};
 const startSession=(query,tag)=>{const child=spawn('docker',['--context','desktop-linux','exec','-i',name,'psql','-h','/tmp','-X','-qAt','-U','supabase_admin','-d',db,'-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']});let out='',err='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);const done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>code===0?resolve(out):reject(Error(err)));});child.stdin.end(`set role postgres;set request.jwt.claim.sub='a2680000-0000-4000-8000-000000000001';set request.jwt.claim.role='service_role';set request.jwt.claims='{\"role\":\"service_role\"}';set application_name='${tag}';`+query);return{done,out:()=>out};};
 const legacy=await verifySetupPrizeSide({sql:q,read,startSession,prepareLegacy:true});
 const protectedTables=['tournament_setup_revisions','tournament_setup_event_versions','tournament_setup_activations','setup_prize_schedule_versions_v1','event_prize_schedule_bindings_v1','operation_receipts','roster_payment_events','q_pool_membership_versions_v1','q_pool_allocation_versions_v1','event_side_pool_election_versions','event_side_pool_team_election_versions'];
 const historySql='select jsonb_build_object('+protectedTables.map(t=>`'${t}',(select md5(coalesce(jsonb_agg(to_jsonb(x)order by id)::text,''))from app.${t} x)`).join(',')+');';
 const history=read(historySql);
 const aclSql="select jsonb_agg(jsonb_build_array(oid::regprocedure::text,proacl::text)order by oid)from pg_proc where oid in('public.save_setup_prize_schedule_v1(uuid,uuid,uuid,jsonb,uuid)'::regprocedure,'app.setup_prize_schedule_workspace_v1(uuid,uuid,uuid)'::regprocedure,'app.bind_prize_schedule_on_activation_v1()'::regprocedure,'public.set_event_side_pool_election_v1(uuid,uuid,uuid,uuid,uuid,uuid,boolean,integer,text,text,text,uuid)'::regprocedure,'public.set_event_side_pool_team_election_v1(uuid,uuid,uuid,uuid,uuid,uuid,boolean,integer,text,text,text,uuid)'::regprocedure);";
 const acl=read(aclSql);
 const migration=fs.readFileSync('database/migrations/0268_setup_prize_side_declaration_v1.sql');console.log('APPLY LOCAL 0268',crypto.createHash('sha256').update(migration).digest('hex'));q(migration.toString('utf8'));
 if(JSON.stringify(read(historySql))!==JSON.stringify(history))throw Error('Migration changed existing immutable history');
 if(JSON.stringify(read(aclSql))!==JSON.stringify(acl))throw Error('Migration changed function identity/privileges');
 const result=await verifySetupPrizeSide({sql:q,read,startSession,legacy});
 result.checks.unshift('all protected history fingerprints and five existing function identities/ACLs unchanged by268');
 fs.writeFileSync('test-results/setup-prize-side-sql-result.json',JSON.stringify(result,null,2));console.log('PASS synthetic evidence',JSON.stringify(result));
}finally{docker(['exec',name,'dropdb','-h','/tmp','-U','supabase_admin','--if-exists',db]);console.log('CLEANUP disposable synthetic evidence database removed');}
