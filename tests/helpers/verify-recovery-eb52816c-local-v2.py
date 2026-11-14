"""Approved recovery v2: full text metadata identities, no source data changes."""
from pathlib import Path
import subprocess,json,hashlib,time,re,datetime
ROOT=Path(r'C:\Users\choco\Documents\Codex\2026-10-22\task\staging-recovery-20261107-eb52816c')
PRIVATE=ROOT/'private';LOG=PRIVATE/'restore-logs-v2';LOG.mkdir(exist_ok=True)
STATE=ROOT/'restore-state-v2.json';NAME='cribbage-recovery-eb52816c-restore-v2'
IMAGE='sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706'
SHA='b8700616e641e4b77de2fa5142127ec7fd8eba1de8dbc571185961133f35689e'
assert not STATE.exists(),'Check existing outcome before any repeat'
assert hashlib.sha256((PRIVATE/'current.dump').read_bytes()).hexdigest()==SHA
load=lambda name:json.loads((PRIVATE/name).read_text(encoding='utf-8-sig'))
roles=load('source-roles.json');members=load('source-membership-grantors.json');props=load('source-database-properties.json')[0]
schemas=load('source-schemas.json');dbacl=load('source-database-acl.json');settings=load('source-safe-database-settings.json');exts=load('source-extensions.json')
assert len(roles)==15 and all(not r['excluded_config']for r in roles)
assert all(x['safe_value']is not None for x in settings),'Unknown setting must remain private and needs review'
assert all(m['grantor']=='supabase_admin'for m in members),'Unreviewed grantor restoration'
assert props['owner']=='postgres'and props['encoding']=='UTF8'and props['datlocprovider']=='i'
assert props['datlocale']=='en-US'and props['datcollversion']==props['actual_collation_version']=='153.121'
state={'operation':'staging-recovery-20261107-eb52816c','name':NAME,'image':IMAGE,'archiveSha256':SHA,'phase':'preflight','cleanupVerified':False,'verified':False}
counter=0
def save():STATE.write_text(json.dumps(state,indent=2),encoding='utf8')
def call(args,phase,input_data=None,allow=False):
 global counter
 counter+=1;r=subprocess.run(['docker','--context','desktop-linux',*args],input=input_data,capture_output=True)
 (LOG/f'{counter:03d}-{phase}-stdout.log').write_bytes(r.stdout);(LOG/f'{counter:03d}-{phase}-stderr.log').write_bytes(r.stderr)
 if r.returncode and not allow:raise RuntimeError(f'{phase} failed, exit {r.returncode}; diagnostics retained privately')
 return r
def ident(s):assert re.fullmatch(r'[a-z_][a-z_0-9]*',s);return'"'+s+'"'
def guc(s):assert re.fullmatch(r'[A-Za-z_][A-Za-z_0-9]*(?:\.[A-Za-z_][A-Za-z_0-9]*)*',s);return s
def quote(s):return"'"+str(s).replace("'","''")+"'"
def sql(text,user='supabase_admin',db='postgres',phase='sql'):
 return call(['exec','-i',state['containerId'],'psql','-h','/tmp','-U',user,'-d',db,'-X','-qAt','-v','ON_ERROR_STOP=1'],phase,text.encode()).stdout.decode().strip()
def capture(query_file,out_file):
 q=(PRIVATE/query_file).read_text(encoding='utf8').strip().removesuffix(';')
 raw=sql("with exported as("+q+")select coalesce(jsonb_agg(to_jsonb(exported)),'[]')from exported",'postgres',phase='fingerprint')
 a=json.loads(raw);(PRIVATE/out_file).write_text(json.dumps(a,indent=2),encoding='utf8');return a
def compare(query,source,out,key):
 actual=capture(query,out);expected=load(source)
 canon=lambda a:sorted(a,key=lambda x:tuple(str(x.get(k,''))for k in key))
 if canon(actual)!=canon(expected):
  (PRIVATE/(out+'.comparison.json')).write_text(json.dumps({'match':False,'sourceRows':len(expected),'restoreRows':len(actual)},indent=2),encoding='utf8')
  raise RuntimeError('Fidelity mismatch in '+query+'; details private')
 return len(actual)
def schema_key(x):return(x['grantor'],x['grantee'],x['privilege'])
try:
 context=json.loads(call(['context','inspect','desktop-linux'],'context').stdout)
 assert context[0]['Endpoints']['docker']['Host']=='npipe:////./pipe/dockerDesktopLinuxEngine'
 assert not call(['ps','-aq','--filter',f'name=^/{NAME}$'],'existing').stdout.strip()
 state['creationAttempted']=True;save()
 startup="initdb -D /tmp/recovery-pgdata -U supabase_admin --auth=trust --no-locale --encoding=UTF8 >/tmp/init.log 2>&1 && exec postgres -D /tmp/recovery-pgdata -k /tmp -c listen_addresses='' -c shared_preload_libraries=pg_stat_statements"
 cid=call(['run','-d','--pull=never','--name',NAME,'--label','codex.recovery=staging-recovery-20261107-eb52816c','--network','none','--log-driver','none','--cap-drop','ALL','--security-opt','no-new-privileges','--user','postgres','--mount',f'type=bind,source={PRIVATE},target=/backup,readonly','--entrypoint','/bin/sh',IMAGE,'-c',startup],'create').stdout.decode().strip()
 state['containerId']=cid;state['phase']='created';save()
 m=json.loads(call(['inspect',cid],'inspect').stdout)[0]
 assert m['Image']==IMAGE and m['Name']=='/'+NAME and m['Config']['Labels']['codex.recovery']==state['operation']
 assert m['HostConfig']['NetworkMode']=='none'and not m['HostConfig']['PortBindings']and not m['HostConfig']['Privileged']
 assert m['HostConfig']['CapDrop']==['ALL']and'no-new-privileges'in m['HostConfig']['SecurityOpt']
 assert len(m['Mounts'])==1 and m['Mounts'][0]['Destination']=='/backup'and not m['Mounts'][0]['RW']
 for _ in range(60):
  if call(['exec',cid,'pg_isready','-h','/tmp','-U','supabase_admin'],'ready',allow=True).returncode==0:break
  time.sleep(.3)
 else:raise RuntimeError('Local restore server not ready')
 flags=[('rolsuper','SUPERUSER'),('rolinherit','INHERIT'),('rolcreaterole','CREATEROLE'),('rolcreatedb','CREATEDB'),('rolcanlogin','LOGIN'),('rolreplication','REPLICATION'),('rolbypassrls','BYPASSRLS')]
 bootstrap='begin;'
 for r in roles:
  n=ident(r['rolname']);bootstrap+=f'do $$begin if not exists(select 1 from pg_roles where rolname={quote(r["rolname"])})then create role {n} nologin;end if;end$$;'
  bootstrap+='alter role '+n+' '+' '.join((''if r[k]else'NO')+f for k,f in flags)+f' connection limit {int(r["rolconnlimit"])};alter role {n} reset all;'
  if r['rolvaliduntil']is not None:bootstrap+=f'alter role {n} valid until {quote(r["rolvaliduntil"])};'
  for c in r['rolconfig']or[]:
   k,v=c.split('=',1);bootstrap+=f'select set_config({quote(k)},{quote(v)},true);alter role {n} set {ident(k)} from current;'
 for r in members:bootstrap+=f'grant {ident(r["role_name"])} to {ident(r["member_name"])} with admin {str(r["admin_option"]).lower()},inherit {str(r["inherit_option"]).lower()},set {str(r["set_option"]).lower()} granted by supabase_admin;'
 bootstrap+='commit;';(PRIVATE/'local-role-bootstrap.sql').write_text(bootstrap,encoding='utf8');sql(bootstrap,db='template1',phase='roles')
 # Keep source's database name so catalog fingerprints need no catalog-name rewrite.
 sql('alter database postgres rename to initdb_postgres;',db='template1',phase='preserve-initdb')
 create=f"create database postgres owner postgres template template0 encoding 'UTF8' locale_provider icu icu_locale {quote(props['datlocale'])} lc_collate {quote(props['datcollate'])} lc_ctype {quote(props['datctype'])};"
 sql(create,db='template1',phase='database')
 sql('alter role postgres superuser;',db='template1',phase='temporary-local-restore-role');state['temporaryPostgresSuperuser']=True;state['phase']='restoring';save()
 call(['exec',cid,'pg_restore','-h','/tmp','-U','supabase_admin','-d','postgres','--single-transaction','--exit-on-error','--use-list=/backup/archive-toc-vault.list','/backup/current.dump'],'vault-schema')
 vault=next(e for e in exts if e['extname']=='supabase_vault');assert vault['owner']=='supabase_admin'and vault['schema']=='vault'
 sql('create extension if not exists supabase_vault with schema vault version '+quote(vault['extversion'])+';',phase='vault-extension')
 call(['exec',cid,'pg_restore','-h','/tmp','-U','postgres','-d','postgres','--single-transaction','--exit-on-error','--use-list=/backup/archive-toc-remaining.list','/backup/current.dump'],'full-restore')
 sql('alter role postgres nosuperuser;',db='template1',phase='source-role-restored');state['temporaryPostgresSuperuser']=False;state['phase']='supplements';save()
 # pg_dump without --create omits database grants/settings. Apply source-confirmed values locally.
 supplement='revoke all privileges on database postgres from public;'
 for a in dbacl:
  assert a['privilege']in('CREATE','CONNECT','TEMPORARY');grantee='PUBLIC'if a['grantee']=='PUBLIC'else ident(a['grantee'])
  supplement+=f'set role {ident(a["grantor"])};grant {a["privilege"]} on database postgres to {grantee}'+(' with grant option'if a['grantable']else'')+';reset role;'
 for s in settings:
  if s['role_name']=='ALL':supplement+=f'alter database postgres set {guc(s["setting_name"])} to {quote(s["safe_value"])};'
  else:supplement+=f'alter role {ident(s["role_name"])} in database postgres set {guc(s["setting_name"])} to {quote(s["safe_value"])};'
 (PRIVATE/'local-database-supplement.sql').write_text(supplement,encoding='utf8');sql(supplement,phase='database-supplement')
 restored_schemas=capture('schemas.sql','restored-schemas-before-supplement.json');by_name={x['nspname']:x for x in restored_schemas};schema_sql=''
 for s in schemas:
  local=by_name[s['nspname']];assert local['owner']==s['owner'],'Schema owner mismatch'
  want={schema_key(x):x['grantable']for x in s['acl']};have={schema_key(x):x['grantable']for x in local['acl']}
  assert not(set(have)-set(want)),'Unexpected restored schema grant requires review'
  for k,g in want.items():
   if k in have and have[k]==g:continue
   assert k not in have or(g and not have[k]),'Unexpected grant-option narrowing'
   grantor,grantee,priv=k;assert priv in('CREATE','USAGE');target='PUBLIC'if grantee=='PUBLIC'else ident(grantee)
   schema_sql+=f'set role {ident(grantor)};grant {priv} on schema {ident(s["nspname"])} to {target}'+(' with grant option'if g else'')+';reset role;'
 if schema_sql:sql(schema_sql,phase='schema-supplement')
 (PRIVATE/'local-schema-supplement.sql').write_text(schema_sql,encoding='utf8');state['phase']='comparing';save()
 counts={}
 for query,source,out,key in [('table-fingerprints.sql','source-table-fingerprints.json','restored-table-fingerprints.json',['table_schema','table_name']),('security-compact.sql','source-security-compact.json','restored-security-compact.json',['kind']),('additional-full-identity.sql','source-additional-full-identity.json','restored-additional-full-identity.json',['kind']),('column-acls.sql','source-column-acls.json','restored-column-acls.json',[]),('exact-sequences.sql','source-exact-sequences.json','restored-exact-sequences.json',['schemaname','sequencename']),('database-properties.sql','source-database-properties.json','restored-database-properties.json',[]),('database-settings.sql','source-database-settings.json','restored-database-settings.json',['role_name','setting_name']),('membership-grantors.sql','source-membership-grantors.json','restored-membership-grantors.json',['role_name','member_name','grantor'])]:
  counts[query]=compare(query,source,out,key);print('PASS',query,counts[query],flush=True)
 actual_roles=capture('roles.sql','restored-roles.json')
 def normalized_roles(a):
  a=json.loads(json.dumps(a))
  for r in a:
   r['rolconfig']=[c.replace('idle_in_transaction_session_timeout=60000','idle_in_transaction_session_timeout=1min')for c in r['rolconfig']or[]]
  return sorted(a,key=lambda r:r['rolname'])
 assert normalized_roles(actual_roles)==normalized_roles(roles),'Role fidelity mismatch; details private'
 counts['roles.sql']=len(roles)
 history=json.loads(sql("select jsonb_build_object('count',count(*),'latest',max(version),'candidatePresent',bool_or(version='20261107090229'))from supabase_migrations.schema_migrations",user='postgres',phase='history'))
 assert history=={'count':292,'latest':'20261104095946','candidatePresent':False}
 assert hashlib.sha256((PRIVATE/'current.dump').read_bytes()).hexdigest()==SHA
 state.update({'verified':True,'phase':'verified','counts':counts,'history':history,'normalizations':['logical column order/dtd identifiers after dropped slots','equivalent idle timeout 60000ms/1min','sorted/default ACL representations'],'hostedChanges':False,'candidateApplied':False});save();print('PASS complete covered isolated logical restore; no candidate applied',flush=True)
except Exception as e:
 state['failure']=str(e);state['phase']='failed';save();print('FAILED',str(e),flush=True);raise
finally:
 if state.get('containerId'):
  cid=state['containerId']
  if state.get('temporaryPostgresSuperuser'):
   try:sql('alter role postgres nosuperuser;',db='template1',phase='demote-finally');state['temporaryPostgresSuperuser']=False
   except Exception:state['demotionBeforeRemovalUnverified']=True
  m=json.loads(call(['inspect',cid],'cleanup-inspect').stdout)[0];assert m['Name']=='/'+NAME and m['Config']['Labels']['codex.recovery']==state['operation']and m['HostConfig']['NetworkMode']=='none'
  call(['rm','-fv',cid],'remove');assert not call(['ps','-aq','--filter','id='+cid],'removed').stdout.strip();state['cleanupVerified']=True;save();print('CLEANUP VERIFIED',flush=True)
 elif state.get('creationAttempted'):
  ids=call(['ps','-aq','--filter',f'name=^/{NAME}$'],'uncertain-create').stdout.decode().strip()
  if ids:
   assert re.fullmatch(r'[a-f0-9]{12,64}',ids)
   m=json.loads(call(['inspect',ids],'uncertain-inspect').stdout)[0]
   assert m['Name']=='/'+NAME and m['Image']==IMAGE and m['Config']['Labels']['codex.recovery']==state['operation']and m['HostConfig']['NetworkMode']=='none'
   call(['rm','-fv',ids],'uncertain-remove');assert not call(['ps','-aq','--filter',f'name=^/{NAME}$'],'uncertain-removed').stdout.strip()
  state['cleanupVerified']=True;save()
