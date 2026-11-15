// Local fictional PostgreSQL only. Always remove the owned container/network.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
const dir='test-results/native-mixed-official-cli-20261107',runtime='tests/native-mixed-official-cli-runtime.mjs',cli=path.resolve('../local-db-tools/supabase-2.121.0/supabase.exe'),home=path.resolve('test-results/native-official-migration-20261107/cli-home');
const env={...process.env,SUPABASE_HOME:home};
const run=(exe,args,opts={})=>spawnSync(exe,args,{encoding:'utf8',windowsHide:true,maxBuffer:64e6,...opts});
const docker=(args,input)=>{const r=run('docker',['--context','desktop-linux',...args],{input});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
function phase(action){const r=run(process.execPath,[runtime,action]);fs.writeFileSync(`${dir}/${action}.log`,r.stdout+'\n'+r.stderr);assert.equal(r.status,0,`${action}: ${r.stderr}`);}
let failure;
try{
 phase('create');phase('install');
 const {state,sql,read}=await import('./helpers/native-mixed-official-cli-db.mjs');
 const report={localOnly:true,port:state.loopbackPort,cliVersion:'2.121.0',checks:[]};
 sql('alter role postgres login;create database fixture_cli_probe owner postgres;','postgres');
 const project=path.resolve('test-results/native-official-migration-20261107/transport-probe');
 const migration=path.join(project,'supabase/migrations/20261107090229_local_transport_probe.sql');
 const uri=`postgresql://postgres@127.0.0.1:${state.loopbackPort}/fixture_cli_probe?sslmode=disable`;
 assert(uri.startsWith(`postgresql://postgres@127.0.0.1:${state.loopbackPort}/fixture_cli_probe?`));
 function up(label){const r=run(cli,['migration','up','--db-url',uri,'--workdir',project,'--yes','--agent','yes'],{env});fs.writeFileSync(`${dir}/${label}.log`,r.stdout+'\n'+r.stderr);return r;}
 let r=up('probe-failure');assert.notEqual(r.status,0);assert.match(r.stdout+r.stderr,/division by zero/);assert.equal(sql("select to_regclass('public.cli_atomic_probe') is null",'fixture_cli_probe'),'t');
 const history=read("select coalesce(jsonb_agg(to_jsonb(t)),'[]')from supabase_migrations.schema_migrations t",'fixture_cli_probe');assert.equal(history.length,0);report.checks.push('failed DDL and migration history both rolled back');
 fs.writeFileSync(migration,'create table public.cli_atomic_probe(id integer primary key);\nalter table public.cli_atomic_probe enable row level security;\nrevoke all on public.cli_atomic_probe from public;\n');
 r=up('probe-success');assert.equal(r.status,0,r.stdout+r.stderr);assert.equal(sql("select count(*)from supabase_migrations.schema_migrations where version='20261107090229'",'fixture_cli_probe'),'1');
 r=up('probe-repeat');assert.equal(r.status,0,r.stdout+r.stderr);assert.equal(sql('select count(*)from supabase_migrations.schema_migrations','fixture_cli_probe'),'1');report.checks.push('successful migration tracked once; repeat is no-op');
 fs.writeFileSync(`${dir}/transport-report.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}catch(e){failure=e;fs.writeFileSync(`${dir}/failure.txt`,String(e.stack??e));}
finally{
 const statePath=`${dir}/state.json`;
 if(fs.existsSync(statePath)){const s=JSON.parse(fs.readFileSync(statePath));if(!s.cleaned)phase('cleanup');}
 else if(fs.existsSync(`${dir}/network-state.json`)){const n=JSON.parse(fs.readFileSync(`${dir}/network-state.json`));const m=JSON.parse(docker(['network','inspect',n.networkId]))[0];assert.equal(m.Internal,true);assert.equal(m.Labels['codex.fixture'],n.label);assert.equal(Object.keys(m.Containers).length,0);docker(['network','rm',n.networkId]);}
}
if(failure)throw failure;
