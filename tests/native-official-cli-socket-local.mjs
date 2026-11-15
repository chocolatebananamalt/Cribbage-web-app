// Official CLI in the same disposable network-none container; Unix socket only.
import fs from'node:fs';import assert from'node:assert/strict';import crypto from'node:crypto';import{spawnSync}from'node:child_process';
const dir='test-results/native-official-linux-cli-debian-20261107',name='cribbage-official-cli-socket-debian-20261107',image='postgres@sha256:665dc7b37ac52a17e298511414c21d23ffa4e6a6ef6225b3e5d59c7afb35e994',archive='test-results/native-official-linux-cli-20261107/supabase_2.121.0_linux_amd64.tar.gz';
fs.mkdirSync(dir,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');assert.equal(sha(fs.readFileSync(archive)),'4b481189efbdc57cf2d37bdee5f1a0d29574314398564b32a6dfb76c0fcf275f');
function docker(args,input,allow=false){const r=spawnSync('docker',['--context','desktop-linux',...args],{input,encoding:'utf8',windowsHide:true,maxBuffer:32e6});if(!allow)assert.equal(r.status,0,r.stderr);return r;}
assert.equal(docker(['ps','-aq','--filter',`name=^/${name}$`]).stdout.trim(),'');let cid;const report={image,localOnly:true,network:'none',ports:0,hostMounts:0,persistentVolumes:0,tmpfsMounts:1,cliVersion:'2.121.0',archiveSha256:sha(fs.readFileSync(archive)),checks:[]};
const save=()=>fs.writeFileSync(dir+'/socket-report.json',JSON.stringify(report,null,2));
try{
 cid=docker(['run','-d','--pull=never','--name',name,'--label',`codex.fixture=${name}`,'--network','none','--tmpfs','/var/lib/postgresql/data:rw,noexec,nosuid','--cap-drop=ALL','--security-opt=no-new-privileges','--user','postgres','--entrypoint','/bin/sh',image,'-c',"initdb -D /tmp/cli-pg -U postgres --auth=trust --no-locale --encoding=UTF8 >/tmp/init.log 2>&1 && exec postgres -D /tmp/cli-pg -k /tmp -c listen_addresses=''"]).stdout.trim();report.containerId=cid;save();
 const meta=JSON.parse(docker(['inspect',cid]).stdout)[0];assert.equal(meta.HostConfig.NetworkMode,'none');assert.equal(meta.Mounts.length,0);assert.equal(meta.HostConfig.Tmpfs['/var/lib/postgresql/data'],'rw,noexec,nosuid');assert.equal(Object.keys(meta.HostConfig.PortBindings??{}).length,0);
 let ready=false;for(let i=0;i<50;i++){if(docker(['exec',cid,'pg_isready','-h','/tmp','-U','postgres'],undefined,true).status===0){ready=true;break;}await new Promise(r=>setTimeout(r,300));}assert(ready);
 const exec=(args,input,allow=false)=>docker(['exec','-i',cid,...args],input,allow);
 const sql=s=>exec(['psql','-h','/tmp','-U','postgres','-d','fixture_cli_probe','-X','-qAt','-v','ON_ERROR_STOP=1'],s).stdout.trim();
 exec(['createdb','-h','/tmp','-U','postgres','fixture_cli_probe']);exec(['mkdir','-p','/tmp/official-cli','/tmp/cli-project/supabase/migrations']);
 docker(['cp',archive,`${cid}:/tmp/official-cli/archive.tar.gz`]);exec(['tar','-xzf','/tmp/official-cli/archive.tar.gz','-C','/tmp/official-cli']);
 const listing=exec(['find','/tmp/official-cli','-maxdepth','2','-type','f']).stdout;fs.writeFileSync(dir+'/archive-files.log',listing);
 const cli='/tmp/official-cli/supabase';const cmd=args=>exec(['env','SUPABASE_HOME=/tmp/cli-home',cli,...args],undefined,true);
 let r=cmd(['--version']);fs.writeFileSync(dir+'/linux-version.log',r.stdout+r.stderr);assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/2\.121\.0/);
 r=cmd(['telemetry','disable']);assert.equal(r.status,0,r.stderr);
 const write=(f,s)=>exec(['sh','-c',`cat > /tmp/cli-project/supabase/migrations/${f}`],s);
 const up=label=>{const r=cmd(['migration','up','--db-url','postgresql://postgres@localhost/fixture_cli_probe?host=%2Ftmp&sslmode=disable','--workdir','/tmp/cli-project','--yes','--agent','yes']);fs.writeFileSync(dir+'/'+label+'.log',r.stdout+r.stderr);return r;};
 const first='20261107090229_local_transport_probe.sql';write(first,'create table public.cli_atomic_probe(id integer primary key);\nselect 1/0;\n');
 r=up('failure');assert.notEqual(r.status,0);assert.match(r.stdout+r.stderr,/division by zero/);assert.equal(sql("select to_regclass('public.cli_atomic_probe') is null"),'t');assert.equal(sql('select count(*)from supabase_migrations.schema_migrations'),'0');report.checks.push('SQL failure rolls back DDL and history');save();
 write(first,'create table public.cli_atomic_probe(id integer primary key);\nalter table public.cli_atomic_probe enable row level security;\nrevoke all on public.cli_atomic_probe from public;\n');r=up('success');assert.equal(r.status,0,r.stdout+r.stderr);assert.equal(sql('select count(*)from supabase_migrations.schema_migrations'),'1');report.checks.push('corrected migration succeeds once');
 write('20261107090230_history_failure_probe.sql','create table public.cli_history_atomic_probe(id integer primary key);\n');
 sql("create function public.reject_test_history()returns trigger language plpgsql as $$begin if new.version='20261107090230' then raise exception 'intentional_local_history_failure';end if;return new;end$$;create trigger test_history_failure before insert on supabase_migrations.schema_migrations for each row execute function public.reject_test_history();");
 r=up('history-failure');assert.notEqual(r.status,0);assert.match(r.stdout+r.stderr,/intentional_local_history_failure/);assert.equal(sql("select to_regclass('public.cli_history_atomic_probe') is null"),'t');assert.equal(sql('select count(*)from supabase_migrations.schema_migrations'),'1');report.checks.push('history insert failure also rolls back DDL');
 sql('drop trigger test_history_failure on supabase_migrations.schema_migrations;drop function public.reject_test_history();');r=up('history-retry');assert.equal(r.status,0,r.stdout+r.stderr);r=up('repeat');assert.equal(r.status,0,r.stdout+r.stderr);assert.equal(sql('select count(*)from supabase_migrations.schema_migrations'),'2');report.checks.push('identical retry succeeds and repeat is no-op');report.passed=true;save();console.log(JSON.stringify(report));
}catch(e){report.passed=false;report.error=String(e.stack??e);save();throw e;}
finally{if(cid){docker(['rm','-fv',cid]);assert.equal(docker(['ps','-aq','--filter',`id=${cid}`]).stdout.trim(),'');assert.equal(docker(['ps','-aq','--filter',`name=^/${name}$`]).stdout.trim(),'');report.cleanupVerified=true;save();}}
