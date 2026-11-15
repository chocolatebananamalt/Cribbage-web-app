"""Private source and fictional-evidence checkpoint; never a database backup."""
from pathlib import Path
import hashlib
import json
import zipfile

root = Path.cwd()
with zipfile.ZipFile(root / 'test-results/native-mixed-pilot-populated-checkpoint-20261107.zip') as previous:
    names = set(previous.namelist())
patterns = [
    'database/proposals/native-mixed-pilot-*.sql',
    'src/lib/api/native-mixed*pilot*', 'src/lib/api/native-mixed-director-http*',
    'src/lib/seating/native-mixed-pilot-preparation*',
    'src/components/native-mixed-preparation*',
    'tests/native-mixed-pilot-prep*', 'tests/native-mixed-pilot-director*test.mjs',
    'tests/native-mixed-preparation*', 'tests/helpers/native-mixed-pilot-prep*',
    'tests/helpers/native-mixed-draw-reservation*',
    'tests/helpers/render-native-mixed-preparation*',
    'tests/helpers/archive-native-mixed-preparation*',
    'test-results/native-mixed-preparation*20261107*',
]
for pattern in patterns:
    names.update(p.as_posix() for p in Path('.').glob(pattern) if p.is_file())
for folder in [
    'src/app/api/v1/tournaments/[id]/rehearsal',
    'src/app/tournament/[tournamentId]/rehearsal-prepare',
    'test-results/native-mixed-pilot-prep1082-20261107',
    'test-results/native-mixed-pilot-prepguard-20261107',
]:
    names.update(p.as_posix() for p in Path(folder).rglob('*') if p.is_file())
names.update([
    'tests/supabase-auth-semantics.test.mjs',
    'tests/rpc-argument-names-match-migrations.test.mjs',
    'docs/quality/2026-11-07-native-mixed-preparation-fresh-review.md',
    'PROJECT_STATUS.md', 'docs/operations/DURABLE_PROJECT_MEMORY.md',
])
files = sorted(name for name in names if Path(name).is_file() and not name.startswith('test-results/native-mixed-preparation-checkpoint'))
for name in files:
    assert Path(name).suffix.lower() not in {'.dump', '.pem', '.key', '.zip'}
    assert '.env' not in Path(name).name
manifest = [{'file': name, 'sha256': hashlib.sha256(Path(name).read_bytes()).hexdigest()} for name in files]
out = Path('test-results/native-mixed-preparation-checkpoint-20261107.zip')
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as archive:
    for item in manifest:
        archive.write(item['file'], item['file'])
    archive.writestr('CHECKPOINT_MANIFEST.json', json.dumps(manifest, indent=2))
with zipfile.ZipFile(out) as archive:
    assert archive.testzip() is None
    for item in manifest:
        assert hashlib.sha256(archive.read(item['file'])).hexdigest() == item['sha256']
receipt = {'file': out.as_posix(), 'files': len(files), 'bytes': out.stat().st_size,
           'sha256': hashlib.sha256(out.read_bytes()).hexdigest(),
           'status': 'LOCAL_PASS_RELEASE_HOLD', 'databaseBackup': False,
           'runtimeFull108': 'pre-tightening frozen source',
           'currentSqlGuardRuntime': True, 'independentContainerAbsence': 19}
Path('test-results/native-mixed-preparation-checkpoint-receipt-20261107.json').write_text(json.dumps(receipt, indent=2), encoding='utf8')
print(json.dumps(receipt))
