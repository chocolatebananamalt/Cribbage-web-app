// Read-only catalog of the single already-authorized, nonce-owned local fixture.
import fs from'node:fs';import path from'node:path';import assert from'node:assert/strict';import{spawnSync}from'node:child_process';
const dir=path.resolve(process.argv[2]??'');assert(dir.startsWith(path.resolve('test-results')+path.sep));
const scope=JSON.parse(fs.readFileSync(path.join(dir,'scope.json'),'utf8'));
const fixture=JSON.parse(fs.readFileSync(path.join(dir,'container.json'),'utf8'));
const docker='C:\\Users\\choco\\AppData\\Local\\Programs\\DockerDesktop\\resources\\bin\\docker.exe';
const context=spawnSync(docker,['context','inspect','desktop-linux'],{encoding:'utf8'});assert.equal(context.status,0);assert.equal(JSON.parse(context.stdout)[0].Endpoints.docker.Host,'npipe:////./pipe/dockerDesktopLinuxEngine');
function call(args,input){const r=spawnSync(docker,['--context','desktop-linux',...args],{input,encoding:'utf8',maxBuffer:8*1024*1024});assert.equal(r.status,0,r.stderr);return r.stdout;}
const m=JSON.parse(call(['inspect',fixture.containerId]))[0];
assert.equal(m.Id,fixture.containerId);assert.equal(m.Name,'/cribbage-mixed-main-finance-current-20261105');assert.equal(m.Config.Labels['codex.fixture'],fixture.name);assert.equal(m.Config.Labels['codex.run-id'],scope.runNonce);
assert.equal(m.Image,fixture.image);assert.equal(m.HostConfig.NetworkMode,'none');assert.equal(m.Mounts.length,0);assert.equal(Object.keys(m.HostConfig.PortBindings??{}).length,0);
const result=JSON.parse(call(['exec','-i',m.Id,'psql','-h','/tmp','-X','-qAt','-U','supabase_admin','-d','fixture_mixed_main_finance','-v','ON_ERROR_STOP=1'],`begin read only;set role postgres;set statement_timeout='5s';select jsonb_build_object('database',current_database(),'socket',inet_server_addr()is null,
 'tables',(select jsonb_agg(jsonb_build_object('name',c.relname,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,
 'anon',has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),'authenticated',has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),'service',has_table_privilege('service_role',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))order by c.relname)from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='app'and c.relkind='r'and c.relname like'synthetic_mixed_%'),
 'routines',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'signature',p.oid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),'pinned',coalesce(p.proconfig @> array['search_path=""'],false),
 'anon',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated',has_function_privilege('authenticated',p.oid,'EXECUTE'),'service',has_function_privilege('service_role',p.oid,'EXECUTE'))order by n.nspname,p.proname)from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('app','public')and p.proname like'%synthetic_mixed%'));commit;`).trim());
assert.equal(result.database,'fixture_mixed_main_finance');assert.equal(result.socket,true);assert(result.tables.length>=10);assert(result.routines.length>=10);
for(const row of result.tables){assert.equal(row.owner,'postgres');assert(row.rls&&row.forceRls);assert.equal(row.anon,false);assert.equal(row.authenticated,false);assert.equal(row.service,false);}
const own=new Set(['get_own_synthetic_mixed_hybrid_v1','attest_synthetic_mixed_hybrid_v1']);
for(const row of result.routines){assert.equal(row.owner,'postgres');assert(row.pinned,row.signature);assert.equal(row.anon,false);assert.equal(row.authenticated,row.schema==='public'&&own.has(row.name));assert.equal(row.service,row.schema==='public'&&!own.has(row.name));}
fs.writeFileSync(path.join(dir,'independent-catalog.json'),JSON.stringify({...result,passed:true,readOnly:true,hosted:false},null,2));
console.log(JSON.stringify({passed:true,tables:result.tables.length,routines:result.routines.length,readOnly:true,hosted:false}));
