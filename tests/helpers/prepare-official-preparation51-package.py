"""Fill the CLI-generated migration without inventing a version or running it."""
from pathlib import Path
import hashlib,json,sys
sys.path.insert(0,str(Path(__file__).parent))
from atomic_sql_source import without_transactions,statements,code
root=Path('database/release-packages/native-preparation51');files=list((root/'supabase/migrations').glob('*_native_preparation51_closed_install.sql'));assert len(files)==1
p=files[0];assert p.stat().st_size==0,'Do not overwrite an existing prepared migration'
source=Path('test-results/native-mixed-bootstrap-atomic51-20261107/closed-install.sql');b=source.read_bytes();assert hashlib.sha256(b).hexdigest()=='41000e612ade0fc36a6374bf6806f0ac13821fe0d18d9e1c2fc48660fbb6ce88'
body,removed=without_transactions(b.decode('utf8'));assert removed=={'beginsRemoved':1,'commitsRemoved':1};assert not any(code(s).lower()in('begin;','commit;')for s in statements(body));assert body.split('-- FINAL_CLOSED_PRIVILEGES',1)[1].count('revoke all on function ')==379
header='-- Local preparation package; no hosted application or enablement authorized.\n-- The official migration runner must supply the sole transaction boundary.\n-- No explicit BEGIN/COMMIT: source bodies and final379 revokes remain intact.\n'
p.write_bytes((header+body).encode('utf8'))
manifest={'status':'CLI_GENERATED_LOCAL_MIGRATION_TRANSPORT_UNVERIFIED','version':p.name.split('_',1)[0],'name':'native_preparation51_closed_install','file':p.as_posix(),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'sourceAtomicSha256':hashlib.sha256(b).hexdigest(),'outerTransactionsRemoved':removed,'literalFunctionRevokes':379,'codeDeployment':False,'cohortOrAccessCreation':False,'hostedApplication':False,'requiresOfficialRunnerAtomicityProof':True}
(root/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
probe=list(Path('test-results/native-official-migration-20261107/transport-probe/supabase/migrations').glob('*_local_transport_probe.sql'));assert len(probe)==1 and probe[0].stat().st_size==0
probe[0].write_text('create table public.cli_atomic_probe(id integer primary key);\nalter table public.cli_atomic_probe enable row level security;\nrevoke all on public.cli_atomic_probe from public;\nselect 1/0;\n',encoding='utf8')
print(json.dumps(manifest))
