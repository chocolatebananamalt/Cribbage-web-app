"""Private source and fictional evidence only; not a database backup."""
from pathlib import Path
import hashlib,json,zipfile
with zipfile.ZipFile('test-results/native-mixed-start-ui-checkpoint-20261107.zip') as prior:
    names=set(prior.namelist())
for pattern in ['src/lib/seating/native-mixed-bootstrap*','src/lib/api/native-mixed-bootstrap*','src/components/native-mixed-bootstrap*','tests/native-mixed-bootstrap*','tests/helpers/*bootstrap*','database/proposals/native-mixed-bootstrap*','test-results/bootstrap-workflow-*','test-results/native-mixed-bootstrap-cleanup*']:
    names.update(p.as_posix() for p in Path('.').glob(pattern) if p.is_file())
for folder in ['test-results/native-mixed-bootstrap-flow-20261107','src/app/api/v1/tournaments/[id]/rehearsal','src/app/tournament/[tournamentId]/rehearsal-participation']:
    names.update(p.as_posix() for p in Path(folder).rglob('*') if p.is_file())
names.update(['docs/quality/2026-11-07-native-mixed-bootstrap-workflow.md','src/components/native-mixed-preparation-screen-v1.tsx','tests/supabase-auth-semantics.test.mjs','tests/rpc-argument-names-match-migrations.test.mjs','PROJECT_STATUS.md','docs/operations/DURABLE_PROJECT_MEMORY.md'])
files=sorted(n for n in names if Path(n).is_file() and Path(n).suffix.lower()!='.zip' and not n.startswith('test-results/native-mixed-bootstrap-checkpoint'))
for n in files:
    assert '.env' not in Path(n).name
    assert Path(n).suffix.lower() not in ['.dump','.key','.pem','.pfx']
manifest=[{'file':n,'sha256':hashlib.sha256(Path(n).read_bytes()).hexdigest()} for n in files]
out=Path('test-results/native-mixed-bootstrap-checkpoint-20261107.zip')
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
    for i in manifest:z.write(i['file'],i['file'])
    z.writestr('CHECKPOINT_MANIFEST.json',json.dumps(manifest,indent=2))
with zipfile.ZipFile(out) as z:
    assert z.testzip() is None
    for i in manifest:assert hashlib.sha256(z.read(i['file'])).hexdigest()==i['sha256']
r={'file':out.as_posix(),'files':len(files),'bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'status':'LOCAL_BOOTSTRAP_PASS_RELEASE_HOLD','databaseBackup':False,'bootstrapAcceptedOperations':30,'newFull108ScoringRun':False,'signedJWT':False,'actualBrowser':False,'independentContainerAbsence':23}
Path('test-results/native-mixed-bootstrap-checkpoint-receipt-20261107.json').write_text(json.dumps(r,indent=2),encoding='utf8')
print(json.dumps(r))
