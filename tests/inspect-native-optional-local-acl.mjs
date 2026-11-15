// Read-only catalog inspection of one existing, exact disposable local fixture.
import fs from'node:fs';import path from'node:path';import assert from'node:assert/strict';import{spawnSync}from'node:child_process';
const dir=path.resolve(process.argv[2]??'');assert(dir.startsWith(path.resolve('test-results')+path.sep));
const fixture=JSON.parse(fs.readFileSync(path.join(dir,'container.json'),'utf8'));
const docker='C:\\Users\\choco\\AppData\\Local\\Programs\\DockerDesktop\\resources\\bin\\docker.exe';
const host=spawnSync(docker,['context','inspect','desktop-linux'],{encoding:'utf8'});assert.equal(host.status,0);assert.equal(JSON.parse(host.stdout)[0].Endpoints.docker.Host,'npipe:////./pipe/dockerDesktopLinuxEngine');
const call=(args,input)=>{const result=spawnSync(docker,['--context','desktop-linux',...args],{input,encoding:'utf8',maxBuffer:8*1024*1024});assert.equal(result.status,0,result.stderr);return result.stdout;};
const current=JSON.parse(call(['inspect',fixture.containerId]))[0];
assert.equal(current.Id,fixture.containerId);assert.equal(current.Name,'/cribbage-native-optional-final-v2-20261105');assert.equal(current.Config.Labels['codex.fixture'],'cribbage-native-optional-final-v2-20261105');assert.equal(current.Image,'sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706');assert.equal(current.HostConfig.NetworkMode,'none');assert.equal(current.Mounts.length,0);assert.equal(Object.keys(current.HostConfig.PortBindings??{}).length,0);assert.equal(current.State.Status,'running');
const output=call(['exec','-i',fixture.containerId,'psql','-h','/tmp','-X','-qAt','-U','supabase_admin','-d','fixture_native_optional_final_v2','-v','ON_ERROR_STOP=1'],`set role postgres;set statement_timeout='5s';
 select jsonb_build_object('database',current_database(),'socket',inet_server_addr()is null,
 'tables',(select jsonb_agg(jsonb_build_object('name',c.relname,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,
 'anon',has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),
 'authenticated',has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),
 'service',has_table_privilege('service_role',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))order by c.relname)
 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='app'and c.relkind='r'and c.relname like'native_optional_%'),
 'routines',(select jsonb_agg(jsonb_build_object('name',p.oid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),'searchPathPinned',coalesce(p.proconfig @> array['search_path=""'],false),
 'anon',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated',has_function_privilege('authenticated',p.oid,'EXECUTE'),'service',has_function_privilege('service_role',p.oid,'EXECUTE'))order by p.oid::regprocedure::text)
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app'and p.proname like'%native_optional_%'));`);
const result=JSON.parse(output.trim());assert.equal(result.database,'fixture_native_optional_final_v2');assert.equal(result.socket,true);assert.equal(result.tables.length,18);assert(result.routines.length>=20);
for(const table of result.tables){assert.equal(table.owner,'postgres');assert.equal(table.rls,true);assert.equal(table.forceRls,true);assert.equal(table.anon,false);assert.equal(table.authenticated,false);assert.equal(table.service,false);}
for(const routine of result.routines){assert.equal(routine.owner,'postgres');assert.equal(routine.searchPathPinned,true,routine.name);assert.equal(routine.anon,false);assert.equal(routine.authenticated,false);assert.equal(routine.service,false);}
fs.writeFileSync(path.join(dir,'independent-acl-catalog.json'),JSON.stringify({...result,passed:true,readOnlyCatalog:true,hosted:false},null,2));console.log(JSON.stringify({passed:true,tables:result.tables.length,routines:result.routines.length,hosted:false}));
