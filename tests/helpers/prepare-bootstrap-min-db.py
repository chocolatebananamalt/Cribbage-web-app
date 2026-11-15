"""Derive local candidate SQL while retaining the five published accounting functions."""
from pathlib import Path
import hashlib,json,re
old='native-mixed-bootstrap-flow';new='native-mixed-bootstrap-min3'
d=Path('test-results/'+new+'-20261107');assert not (d/'state.json').exists();d.mkdir(exist_ok=True)
order=json.loads(Path('test-results/'+old+'-20261107/proposal-order.json').read_text());(d/'proposal-order.json').write_text(json.dumps(order),encoding='utf8')
names={'app.calculate_q_obligations_v2','app.prize_accounting_source_v9','app.q_obligation_sources_v2','app.side_pool_graduated_source_v2','public.get_q_operating_workspace_v2'}
pattern=re.compile(r'^create\s+or\s+replace\s+function\s+('+ '|'.join(re.escape(n) for n in sorted(names))+r')\s*\(',re.I|re.M)
derived=[];removed=[];(d/'schema').mkdir(exist_ok=True)
for f in order:
 src=Path('database/proposals')/f;s=src.read_bytes().decode('utf8');parts=[];at=0
 for m in pattern.finditer(s):
  opening=re.search(r'\bas\s*(\$[A-Za-z_0-9]*\$)',s[m.end():],re.I);assert opening,f
  body_start=m.end()+opening.end();tag=opening.group(1);body_end=s.index(tag,body_start)+len(tag)
  ending=re.match(r'\s*;',s[body_end:]);assert ending,f
  end=body_end+ending.end();statement=s[m.start():end]
  parts += [s[at:m.start()],'-- Preparation-only package: published '+m.group(1)+' retained unchanged.\n']
  removed.append({'file':src.as_posix(),'function':m.group(1),'statementSha256':hashlib.sha256(statement.encode()).hexdigest()});at=end
 parts.append(s[at:]);dest=d/'schema'/f;dest.write_bytes(''.join(parts).encode('utf8'));derived.append({'source':src.as_posix(),'sourceSha256':hashlib.sha256(src.read_bytes()).hexdigest(),'file':dest.as_posix(),'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()})
assert len(removed)==8 and {x['function'] for x in removed}==names
(d/'derived-schema-manifest.json').write_text(json.dumps({'removed':removed,'files':derived,'status':'LOCAL_TEST_CANDIDATE_NOT_HOSTED'},indent=2),encoding='utf8')
for part in ['runtime','setup','flow','scoring','author','run']:
 s=Path('tests/'+old+'-acceptance-local-'+part+'.mjs').read_text(encoding='utf8').replace(old,new).replace('fixture_native_mixed_bootstrap_flow','fixture_'+new.replace('-','_'))
 if part=='runtime':
  s=s.replace("...order.map(f=>'database/proposals/'+f)","...order.map(f=>dir+'/schema/'+f)")
  s=s.replace("state.compatibilitySeed=seedCompatibility", "state.accountingBefore=JSON.parse(sql(state,\"select coalesce(jsonb_agg(jsonb_build_object('name',n.nspname||'.'||p.proname,'arguments',pg_get_function_identity_arguments(p.oid),'definition',pg_get_functiondef(p.oid),'owner',p.proowner::regrole::text,'acl',p.proacl)order by n.nspname,p.proname,p.oid),'[]')from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname||'.'||p.proname in('app.calculate_q_obligations_v2','app.prize_accounting_source_v9','app.q_obligation_sources_v2','app.side_pool_graduated_source_v2','public.get_q_operating_workspace_v2');\"));state.compatibilitySeed=seedCompatibility")
 if part=='author':
  s=s.replace('tid,sql,read,json,quote,claims}', 'tid,sql,read,json,quote,claims,state}')
  s=s.replace("try{\n const d=", "try{\n const held=()=>read(\"select jsonb_build_object('draw',app.native_mixed_simulation_publication_enabled_v1(),'start',app.native_mixed_simulation_start_enabled_v1(),'scoring',app.native_mixed_game_writer_enabled_v1(),'gameTransport',app.native_mixed_game_transport_enabled_v1(),'operationalActivation',app.event_settings_operational_activation_enabled_v1());\");assert.deepEqual(held(),{draw:false,start:false,scoring:false,gameTransport:false,operationalActivation:false});\n const d=")
  s=s.replace("fs.writeFileSync(dir+'/workflow-results.json'", "assert.deepEqual(held(),{draw:false,start:false,scoring:false,gameTransport:false,operationalActivation:false});checks.push('draw, Start, scoring, game transport and operational activation remained disabled throughout preparation');fs.writeFileSync(dir+'/workflow-results.json'")
  s=s.replace("verifyCompatibility(sql,dir,true);", "assert.deepEqual(read(\"select coalesce(jsonb_agg(jsonb_build_object('name',n.nspname||'.'||p.proname,'arguments',pg_get_function_identity_arguments(p.oid),'definition',pg_get_functiondef(p.oid),'owner',p.proowner::regrole::text,'acl',p.proacl)order by n.nspname,p.proname,p.oid),'[]')from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname||'.'||p.proname in('app.calculate_q_obligations_v2','app.prize_accounting_source_v9','app.q_obligation_sources_v2','app.side_pool_graduated_source_v2','public.get_q_operating_workspace_v2');\"),state.accountingBefore);checks.push('all five published accounting definitions, signatures, owners and ACLs unchanged');verifyCompatibility(sql,dir,true);")
 if part=='run':
  s=s.replace('const manifest=files.map', "files.push(...fs.readdirSync(dir+'/schema').map(f=>dir+'/schema/'+f),dir+'/derived-schema-manifest.json',...['native-mixed-pilot-confinement-v1.sql','native-mixed-pilot-director-session-v1.sql','native-mixed-pilot-preparation-v1.sql','native-mixed-pilot-draw-reservation-v1.sql','native-mixed-pilot-bootstrap-status-v1.sql'].map(f=>'database/proposals/'+f));const manifest=files.map")
 Path('tests/'+new+'-acceptance-local-'+part+'.mjs').write_text(s,encoding='utf8')
s=Path('tests/helpers/'+old+'-acceptance-db.mjs').read_text(encoding='utf8').replace(old,new).replace('fixture_native_mixed_bootstrap_flow','fixture_'+new.replace('-','_'));Path('tests/helpers/'+new+'-acceptance-db.mjs').write_text(s,encoding='utf8')
print(json.dumps({'derivedFiles':len(derived),'removedDefinitions':len(removed),'retainedFunctionNames':len(names)}))
