"""Bounded local sequence catalog proof against the same closed install bytes."""
from pathlib import Path
import json
old='native-mixed-bootstrap-atomic53';new='native-mixed-bootstrap-seq53';d=Path('test-results/'+new+'-20261107');assert not(d/'state.json').exists();d.mkdir(exist_ok=True)
(d/'proposal-order.json').write_text('[]');(d/'closed-install.sql').write_bytes(Path('test-results/'+old+'-20261107/closed-install.sql').read_bytes())
query="select coalesce(jsonb_agg(jsonb_build_object('name',n.nspname||'.'||c.relname,'owner',c.relowner::regrole::text,'acl',c.relacl,'start',s.start_value,'min',s.min_value,'max',s.max_value,'increment',s.increment_by,'cycle',s.cycle,'cache',s.cache_size,'lastValue',s.last_value,'anon',has_sequence_privilege('anon',c.oid,'USAGE,SELECT,UPDATE'),'authenticated',has_sequence_privilege('authenticated',c.oid,'USAGE,SELECT,UPDATE'),'service_role',has_sequence_privilege('service_role',c.oid,'USAGE,SELECT,UPDATE'))order by n.nspname,c.relname),'[]')from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_sequences s on s.schemaname=n.nspname and s.sequencename=c.relname where c.relkind='S'and n.nspname in('app','public');"
s=Path('tests/'+old+'-acceptance-local-runtime.mjs').read_text(encoding='utf8').replace(old,new).replace('fixture_native_mixed_bootstrap_atomic53','fixture_native_mixed_bootstrap_seq53')
call="await installAtomicBootstrap({state,dir,sql:text=>sql(state,text),read:text=>JSON.parse(sql(state,text)||'null')});"
assert call in s
replacement="const sequenceQuery="+json.dumps(query)+";const sequenceBefore=JSON.parse(sql(state,sequenceQuery));sql(state,fs.readFileSync(dir+'/closed-install.sql','utf8'));const sequenceAfter=JSON.parse(sql(state,sequenceQuery));const oldNames=new Set(sequenceBefore.map(x=>x.name));assert.deepEqual(sequenceAfter.filter(x=>oldNames.has(x.name)),sequenceBefore);const added=sequenceAfter.filter(x=>!oldNames.has(x.name));assert(added.length>0);for(const r of added)for(const role of['anon','authenticated','service_role'])assert.equal(r[role],false,role+' sequence access '+r.name);fs.writeFileSync(dir+'/sequence-permissions.json',JSON.stringify({before:sequenceBefore,after:sequenceAfter,existingMetadataACLAndValuesUnchanged:true,newSequences:added.length,newApplicationPrivilegesDenied:true,hosted:false},null,2));"
s=s.replace(call,replacement)
Path('tests/'+new+'-acceptance-local-runtime.mjs').write_text(s,encoding='utf8')
print('Prepared sequence-only fixture; same closed install, no activation/cohort/grants')
