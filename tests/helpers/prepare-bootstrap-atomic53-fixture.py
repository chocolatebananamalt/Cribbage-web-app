"""One approved isolated atomic-install and preparation acceptance fixture."""
from pathlib import Path
import json
old='native-mixed-bootstrap-closure53';new='native-mixed-bootstrap-atomic53';d=Path('test-results/'+new+'-20261107');assert not(d/'state.json').exists();assert(d/'closed-install.sql').is_file()
(d/'schema').mkdir(exist_ok=True)
for p in Path('test-results/'+old+'-20261107/schema').glob('*.sql'):(d/'schema'/p.name).write_bytes(p.read_bytes())
(d/'proposal-order.json').write_text('[]',encoding='utf8')
(d/'derived-schema-manifest.json').write_bytes(Path('test-results/'+old+'-20261107/derived-schema-manifest.json').read_bytes())
for part in ['runtime','setup','flow','scoring','author','run']:
 s=Path('tests/'+old+'-acceptance-local-'+part+'.mjs').read_text(encoding='utf8').replace(old,new).replace('fixture_native_mixed_bootstrap_closure53','fixture_native_mixed_bootstrap_atomic53')
 if part=='runtime':
  s="import{installAtomicBootstrap}from'./helpers/native-bootstrap-atomic-install-local.mjs';\n"+s
  a=s.index('if(state.applied.length===56&&!state.compatibilitySeeded)');b=s.index('const bytes=',a);seed=s[a:b].replace('if(state.applied.length===56&&!state.compatibilitySeeded)','if(!state.compatibilitySeeded)')
  anchor='  verifyLegacyWriter(text=>sql(state,text),dir);'
  assert anchor in s
  insert=seed+"\nstate.inFlight={file:'atomic53-closed-install',sha256:hash(fs.readFileSync(dir+'/closed-install.sql'))};save(state);await installAtomicBootstrap({state,dir,sql:text=>sql(state,text),read:text=>JSON.parse(sql(state,text)||'null')});state.applied.push(state.inFlight);state.inFlight=null;state.atomicInstallVerified=true;save(state);\n"
  s=s.replace(anchor,insert+anchor)
 if part=='author':
  lines=s.splitlines(keepends=True);matches=[i for i,l in enumerate(lines)if l.startswith('for(const f of[')];assert len(matches)==1;lines[matches[0]]='// Atomic runtime already installed both confinement and bootstrap.\n';s=''.join(lines)
 if part=='run':
  s=s.replace('const manifest=files.map',"files.push(dir+'/closed-install.sql',dir+'/closed-install-manifest.json','tests/helpers/native-bootstrap-atomic-install-local.mjs');const manifest=files.map")
 Path('tests/'+new+'-acceptance-local-'+part+'.mjs').write_text(s,encoding='utf8')
s=Path('tests/helpers/'+old+'-acceptance-db.mjs').read_text(encoding='utf8').replace(old,new).replace('fixture_native_mixed_bootstrap_closure53','fixture_native_mixed_bootstrap_atomic53');Path('tests/helpers/'+new+'-acceptance-db.mjs').write_text(s,encoding='utf8')
print('Prepared atomic53 fixture: baseline0292, transactional rollback/visibility proof, then 30 prep operations')
