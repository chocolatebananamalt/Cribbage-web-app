// Reproduce captured nonsecret attributes in the owned fictional cluster only.
import fs from'node:fs';import assert from'node:assert/strict';import crypto from'node:crypto';import{spawnSync}from'node:child_process';
const file='test-results/native-staging-metadata-20261107.json',bytes=fs.readFileSync(file),source=JSON.parse(bytes);
assert.equal(source.project.id,'nnhcnvksxgxnpvdqjgpg');
const ident=s=>{assert.match(s,/^[a-z_][a-z_0-9]*$/);return'"'+s+'"';},q=s=>"'"+s.replaceAll("'","''")+"'";
const roleQuery="select jsonb_agg(jsonb_build_object('name',rolname,'super',rolsuper,'inherit',rolinherit,'createRole',rolcreaterole,'createDB',rolcreatedb,'canLogin',rolcanlogin,'replication',rolreplication,'bypassRLS',rolbypassrls,'config',rolconfig)order by rolname)from pg_roles where rolname in('postgres','supabase_admin','anon','authenticated','service_role','authenticator','supabase_privileged_role')";
const memberQuery="select jsonb_agg(jsonb_build_object('role',r.rolname,'member',u.rolname,'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option)order by r.rolname)from pg_auth_members m join pg_roles r on r.oid=m.roleid join pg_roles u on u.oid=m.member where u.rolname='postgres'";
export function applyCapturedStagingRoles({sql,read,dir,state}){
 assert.equal(state.name,'cribbage-native-mixed-official-role51-20261107');assert.equal(state.db,'fixture_native_mixed_official_role51');
 assert(!fs.existsSync(dir+'/captured-roles-proof.json'),'Do not repeat an uncertain role setup');
 const expected=source.roles.roles;assert.equal(expected.find(x=>x.name==='postgres').super,false);
 const allowedConfig=new Set(['search_path','statement_timeout','lock_timeout','session_preload_libraries','log_statement']);let commands='begin;';
 for(const r of expected){const name=ident(r.name);commands+=`do $$begin if not exists(select1 from pg_roles where rolname=${q(r.name)})then create role ${name} nologin;end if;end$$;`.replace('select1','select 1');
  const flags=[['super','SUPERUSER'],['inherit','INHERIT'],['createRole','CREATEROLE'],['createDB','CREATEDB'],['canLogin','LOGIN'],['replication','REPLICATION'],['bypassRLS','BYPASSRLS']].map(([key,flag])=>(r[key]?'':'NO')+flag).join(' ');commands+=`alter role ${name} ${flags};alter role ${name} reset all;`;
  for(const setting of r.config??[]){const at=setting.indexOf('=');assert(at>0);const key=setting.slice(0,at),value=setting.slice(at+1);assert(allowedConfig.has(key),'Unknown setting needs review before copying');commands+=`select set_config(${q(key)},${q(value)},true);alter role ${name} set ${ident(key)} from current;`;}
 }
 const current=read(memberQuery)??[],wanted=new Set(source.roles.postgresMemberships.map(x=>x.role));for(const m of current)if(!wanted.has(m.role))commands+=`revoke ${ident(m.role)} from postgres;`;
 for(const m of source.roles.postgresMemberships){assert.equal(m.member,'postgres');commands+=`grant ${ident(m.role)} to postgres with admin ${m.admin},inherit ${m.inherit},set ${m.set};`;}
 commands+='commit;';sql(commands);assert.deepEqual(read(roleQuery),expected);assert.deepEqual(read(memberQuery),source.roles.postgresMemberships);
 const schema=read("select jsonb_agg(jsonb_build_object('schema',nspname,'postgresUsage',has_schema_privilege('postgres',oid,'USAGE'),'postgresCreate',has_schema_privilege('postgres',oid,'CREATE'))order by nspname)from pg_namespace where nspname in('app','public','auth','extensions')");
 for(const row of schema){const e=source.roles.schemaPrivileges.find(x=>x.schema===row.schema);assert(e);assert.equal(row.postgresUsage,e.postgresUsage);assert.equal(row.postgresCreate,e.postgresCreate);}
 const proof={capturedMetadataSha256:crypto.createHash('sha256').update(bytes).digest('hex'),roles:read(roleQuery),postgresMemberships:read(memberQuery),schemaPrivileges:schema,localOnly:true,providerHooksReplicated:false,hostedExport:false};fs.writeFileSync(dir+'/captured-roles-proof.json',JSON.stringify(proof,null,2));
 return assertCapturedRolePosture({read,dir,state,label:'before'});
}
export function assertCapturedRolePosture({read,dir,state,label}){
 assert.deepEqual(read(roleQuery),source.roles.roles);assert.deepEqual(read(memberQuery),source.roles.postgresMemberships);
 const text="select jsonb_build_object('currentUser',current_user,'sessionUser',session_user,'isSuper',(select rolsuper from pg_roles where rolname=current_user),'searchPath',current_setting('search_path'),'roleSetting',current_setting('role'))";
 const r=spawnSync('docker',['--context','desktop-linux','exec','-i',state.containerId,'psql','-h','/tmp','-U','postgres','-d',state.db,'-X','-qAt','-v','ON_ERROR_STOP=1'],{input:text,encoding:'utf8',windowsHide:true,maxBuffer:1e6});assert.equal(r.status,0,r.stderr);const p=JSON.parse(r.stdout);assert.equal(p.currentUser,'postgres');assert.equal(p.sessionUser,'postgres');assert.equal(p.isSuper,false);assert.equal(p.roleSetting,'none');fs.writeFileSync(dir+`/postgres-session-${label}.json`,JSON.stringify(p,null,2));return p;
}
