"""Private local-only candidate acceptance on the verified actual-history restore.

Called by the dedicated restore driver. Never connects to a hosted database.
All SQL results/logs remain inside the protected recovery directory.
"""
import hashlib,json,re
from pathlib import Path

def verify_candidate(ns):
 sql,call,state,save=ns['sql'],ns['call'],ns['state'],ns['save']
 private,log=ns['PRIVATE'],ns['LOG']
 repo=Path(__file__).resolve().parents[2]
 manifest=json.loads((repo/'database/release-packages/native-preparation51/manifest.json').read_text())
 candidate=(repo/manifest['file']).read_bytes()
 assert hashlib.sha256(candidate).hexdigest()==manifest['sha256']=='22f9145694802d79d13d50ab36d52e8dc030b1f86649b9cb8a5f2fe733187f58'
 archive=repo/'test-results/native-official-linux-cli-20261107/supabase_2.121.0_linux_amd64.tar.gz'
 assert hashlib.sha256(archive.read_bytes()).hexdigest()=='4b481189efbdc57cf2d37bdee5f1a0d29574314398564b32a6dfb76c0fcf275f'
 image='postgres@sha256:665dc7b37ac52a17e298511414c21d23ffa4e6a6ef6225b3e5d59c7afb35e994'
 name='cribbage-recovery-eb52816c-candidate-cli';cid=None
 report={'localOnly':True,'hostedChanges':False,'candidateSha256':manifest['sha256'],'transport':'native psql --single-transaction ON_ERROR_STOP, exact official-CLI-produced history','checks':[]}
 def read(q):return json.loads(sql(q,user='postgres',phase='candidate-read'))
 def q(s):return "'"+s.replace("'","''")+"'"
 def ident(s):return '"'+s.replace('"','""')+'"'
 def persist():
  (log/'candidate-report.json').write_text(json.dumps(report,indent=2),encoding='utf8')
  state['candidateTest']=report;save()
 funcs_q="select coalesce(jsonb_agg(jsonb_build_object('signature',n.nspname||'.'||p.proname||'('||oidvectortypes(p.proargtypes)||')','definition',pg_get_functiondef(p.oid),'owner',p.proowner::regrole::text,'acl',p.proacl)order by n.nspname,p.proname,p.oid),'[]')from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('app','public')"
 history_q="select coalesce(jsonb_agg(to_jsonb(t)order by version),'[]')from supabase_migrations.schema_migrations t"
 table_q="select coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'owner',c.relowner::regrole::text,'acl',c.relacl,'rls',c.relrowsecurity,'force',c.relforcerowsecurity,'columns',(select jsonb_agg(a.attname order by a.attnum)from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped))order by n.nspname,c.relname),'[]')from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in('r','p')and n.nspname not like'pg_%'and n.nspname<>'information_schema'"
 seq_q=(private/'exact-sequences.sql').read_text().strip().removesuffix(';')
 def sequences():return read('with s as('+seq_q+")select coalesce(jsonb_agg(to_jsonb(s)order by schemaname,sequencename),'[]')from s")
 def fingerprints(tables,exclude_history=False):
  values=[]
  for t in tables:
   if exclude_history and t['schema']=='supabase_migrations'and t['name']=='schema_migrations':continue
   cols=','.join(ident(c)for c in t['columns'])
   query="select count(*)as rows,md5(coalesce(string_agg(md5(to_jsonb(t)::text),''order by md5(to_jsonb(t)::text)),''))as hash from(select "+cols+' from '+ident(t['schema'])+'.'+ident(t['name'])+')t'
   values.append('('+q(t['schema']+'.'+t['name'])+',query_to_xml('+q(query)+",false,true,'')::text)")
  return read("select jsonb_agg(jsonb_build_object('table',name,'aggregate',aggregate)order by name)from(values"+','.join(values)+')v(name,aggregate)')

 before_funcs=read(funcs_q);before_history=read(history_q);before_tables=read(table_q);before_seq=sequences()
 assert len(before_funcs)==781 and len(before_history)==292
 assert not any(x['version']==manifest['version']for x in before_history)
 before_rows=fingerprints(before_tables,True)
 role_q="select jsonb_build_object('current',current_user,'session',session_user,'super',(select rolsuper from pg_roles where rolname=current_user),'role',current_setting('role'))"
 assert read(role_q)=={'current':'postgres','session':'postgres','super':False,'role':'none'}
 report['baseline']={'functions':len(before_funcs),'history':len(before_history),'tables':len(before_tables),'originalColumnFingerprints':len(before_rows),'actualNonSuperuserSession':True}
 persist()
 try:
  ledger=(private/'native-psql-history-insert.sql').read_bytes()
  expected_entry=None
  for f in sorted((private/'candidate-restore-logs-v1').glob('*candidate-read-stdout.log')):
   try:rows=json.loads(f.read_text(encoding='utf-8'))
   except (ValueError,UnicodeError):continue
   if isinstance(rows,list)and len(rows)==293 and all(isinstance(x,dict)and 'version'in x for x in rows):
    expected_entry=next((x for x in rows if x['version']==manifest['version']),None)
    if expected_entry:break
  assert expected_entry and len(expected_entry['statements'])==1213
  expected_ledger=("\ninsert into supabase_migrations.schema_migrations(version,name,statements) values("+q(expected_entry['version'])+','+q(expected_entry['name'])+',array['+','.join(q(x)for x in expected_entry['statements'])+']::text[]);\n').encode()
  assert ledger==expected_ledger
  current=[b'']
  def candidate_file(b):current[0]=b
  def up():
   existing=read(history_q)
   if any(x['version']==manifest['version']for x in existing):
    assert next(x for x in existing if x['version']==manifest['version'])==expected_entry
    import subprocess
    return subprocess.CompletedProcess([],0,b'',b'')
   return call(['exec','-i',state['containerId'],'psql','-h','/tmp','-U','postgres','-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1','--single-transaction','-f','-'],'native-psql',current[0]+ledger,True)
  candidate_file(candidate+b'\nselect 1/0;\n');failed=up()
  assert failed.returncode!=0 and b'division by zero'in(failed.stdout+failed.stderr)
  assert read(funcs_q)==before_funcs and read(history_q)==before_history and read(table_q)==before_tables and sequences()==before_seq
  assert fingerprints(before_tables,True)==before_rows
  for query,source,key in [('security-compact.sql','source-security-compact.json',['kind']),('additional-full-identity.sql','source-additional-full-identity.json',['kind']),('column-acls.sql','source-column-acls.json',[])]:
   ns['compare'](query,source,'candidate-rollback-'+source,key)
  report['checks'].append('full injected SQL failure rolls back catalog/data/sequences and all292 actual history rows');persist()
  candidate_file(candidate)
  assert hashlib.sha256(current[0]).hexdigest()==manifest['sha256']
  installed=up();assert installed.returncode==0,'Exact candidate installation failed; diagnostics private'
  after_funcs=read(funcs_q);old={f['signature']:f for f in before_funcs};new=[f for f in after_funcs if f['signature']not in old]
  assert len(new)==379 and len(after_funcs)==1160
  changed=[]
  for f in after_funcs:
   if f['signature']not in old:continue
   b=old[f['signature']];assert f['owner']==b['owner']and f['acl']==b['acl']
   if f['definition']!=b['definition']:changed.append(f['signature'])
  assert set(changed)=={'app.require_event_prize_activation_pins_v1()','app.bind_prize_schedule_on_activation_v1()'}
  assert fingerprints(before_tables,True)==before_rows
  after_history=read(history_q);assert len(after_history)==293
  assert [r for r in after_history if r['version']!=manifest['version']]==before_history
  entry=next(r for r in after_history if r['version']==manifest['version']);assert entry['name']==manifest['name']and len(entry['statements'])>0
  after_tables=read(table_q);table_map={(t['schema'],t['name']):t for t in after_tables};new_tables=[t for t in after_tables if(t['schema'],t['name'])not in{(t['schema'],t['name'])for t in before_tables}]
  assert len(new_tables)==118 and all(t['rls']for t in new_tables)
  for t in before_tables:
   a=table_map[t['schema'],t['name']]
   assert all(a[k]==t[k]for k in ['owner','acl','rls','force'])
   assert set(t['columns'])<=set(a['columns'])
  sigs=','.join(q(f['signature'])for f in new)
  grants=read("select jsonb_build_object('functions',count(*),'allowed',count(*)filter(where has_function_privilege('anon',sig,'EXECUTE')or has_function_privilege('authenticated',sig,'EXECUTE')or has_function_privilege('service_role',sig,'EXECUTE')))from unnest(array["+sigs+"]::text[])sig")
  assert grants=={'functions':379,'allowed':0}
  names=','.join(q(t['schema']+'.'+t['name'])for t in new_tables)
  allowed=read("select count(*)from unnest(array["+names+"]::text[])t cross join(values('anon'),('authenticated'),('service_role'))r(role)where has_table_privilege(r.role,t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')or has_any_column_privilege(r.role,t,'SELECT,INSERT,UPDATE,REFERENCES')")
  assert allowed==0
  after_seq=sequences();old_seq={(s['schemaname'],s['sequencename'])for s in before_seq}
  assert [s for s in after_seq if(s['schemaname'],s['sequencename'])in old_seq]==before_seq
  added_seq=[s for s in after_seq if(s['schemaname'],s['sequencename'])not in old_seq];assert len(added_seq)==1
  for s in added_seq:
   assert read('select count(*)from(values(\'anon\'),(\'authenticated\'),(\'service_role\'))r(role)where has_sequence_privilege(role,'+q(s['schemaname']+'.'+s['sequencename'])+",'USAGE,SELECT,UPDATE')")==0
  # No writes through the user's old setup payload: preserve real rows, do not impersonate.
  assert up().returncode==0 and read(history_q)==after_history
  assert fingerprints(before_tables,True)==before_rows and read(role_q)=={'current':'postgres','session':'postgres','super':False,'role':'none'}
  report.update({'passed':True,'historyBefore':292,'historyAfter':293,'oldHistoryExact':True,'repeatNoOp':True,'oldRowsExact':True,'newFunctions':379,'newRLSTables':118,'effectiveTableColumnDenials':354,'newSequenceDenied':True,'existingFunctionChanges':changed,'legacyWriterExecution':'not run against private user records; separate fictional acceptance evidence remains','postCommitRollback':'not attempted; injected pre-commit rollback only'})
  report['checks'].append('exact candidate installs once;293 ledger entries;292 old rows exact;repeat no-op;all original data preserved;closed access and role posture retained');persist()
  print('PASS native psql single-transaction candidate: rollback, install, preservation, history-aware retry',flush=True)
 except Exception as e:
  report['failure']=str(e);persist();raise
 finally:
  if cid:
   m=json.loads(call(['inspect',cid],'cli-cleanup-inspect').stdout)[0]
   assert m['Name']=='/'+name and m['Config']['Labels']['codex.recovery']==state['operation']and m['HostConfig']['NetworkMode']=='none'
   call(['rm','-fv',cid],'cli-remove');assert not call(['ps','-aq','--filter','id='+cid],'cli-removed').stdout.strip()
   report['cliCleanupVerified']=True;persist()
  elif state.get('cliCreationAttempted'):
   ids=call(['ps','-aq','--filter',f'name=^/{name}$'],'cli-uncertain').stdout.decode().strip()
   if ids:
    m=json.loads(call(['inspect',ids],'cli-uncertain-inspect').stdout)[0]
    assert m['Name']=='/'+name and m['Config']['Labels']['codex.recovery']==state['operation']and m['HostConfig']['NetworkMode']=='none'
    call(['rm','-fv',ids],'cli-uncertain-remove')
    assert not call(['ps','-aq','--filter',f'name=^/{name}$'],'cli-uncertain-removed').stdout.strip()
   report['cliCleanupVerified']=True;persist()
