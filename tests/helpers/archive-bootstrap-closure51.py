"""Private reviewed source/evidence packet, not a hosted installation or recovery backup."""
from pathlib import Path
import hashlib,json,zipfile
d=Path('test-results/native-mixed-bootstrap-atomic51-20261107');state=json.loads((d/'state.json').read_text());assert state['cleaned']and state['cleanupVerified']
proof=json.loads((d/'workflow-results.json').read_text());assert len(proof['results'])==30
install=json.loads((d/'closed-install-manifest.json').read_text());assert len(install['sources'])==51 and install['literalFunctionRevokes']==379
old=Path('test-results/native-mixed-preparation-only-candidate-20261107.zip');oldReceipt=json.loads(Path('test-results/native-mixed-preparation-only-candidate-receipt-20261107.json').read_text());assert hashlib.sha256(old.read_bytes()).hexdigest()==oldReceipt['sha256']
content={}
with zipfile.ZipFile(old)as z:
 for n in z.namelist():
  if n.startswith('overlay/'):content[n]=z.read(n)
assert len(content)==23
sql=(d/'closed-install.sql').read_bytes();assert hashlib.sha256(sql).hexdigest()==install['sha256'];content['database/closed-install.sql']=sql
for x in install['sources']:
 p=Path(x['file']);b=p.read_bytes();assert hashlib.sha256(b).hexdigest()==x['sha256'];content['provenance-only/'+p.name]=b
for folder in [d]:
 for p in folder.rglob('*'):
  if p.is_file()and 'schema'not in p.parts and p.suffix.lower()not in['.zip','.dump','.key','.pem','.pfx']:content[p.as_posix()]=p.read_bytes()
for n in ['docs/quality/2026-11-07-native-mixed-sql-closure51.md','docs/quality/2026-11-07-native-mixed-staging-test-plan.md','test-results/native-mixed-closure51-report-20261107.json','test-results/native-mixed-preparation-sql-dependencies-20261107.json','test-results/native-mixed-dependency-closure-cleanup-20261107.json','test-results/bootstrap-closure51-application-20261107.log','test-results/bootstrap-closure51-focused-20261107.log','test-results/bootstrap-closure51-typecheck-20261107.log','test-results/bootstrap-closure51-handoff-20261107.log','test-results/bootstrap-closure51-lint-20261107.log','test-results/bootstrap-closure51-providers-20261107.log','test-results/bootstrap-atomic-splitter-20261107.log']:
 p=Path(n);assert p.is_file();content[n]=p.read_bytes()
for pattern in ['tests/native-mixed-bootstrap-atomic51-acceptance-local-*.mjs','tests/helpers/native-mixed-bootstrap-atomic51-acceptance-db.mjs','tests/helpers/native-bootstrap-atomic51-install-local.mjs','tests/helpers/atomic_sql_source.py','tests/test_atomic_sql_source.py','tests/helpers/build-bootstrap-closure53-atomic.py','tests/helpers/prepare-bootstrap-atomic51.py','tests/helpers/inspect-bootstrap-sql-dependencies.py','tests/helpers/report-bootstrap-closure51.py','tests/helpers/archive-bootstrap-closure51.py','tests/native-mixed-dependency-closure-cleanup-local.mjs']:
 for p in Path('.').glob(pattern):content[p.as_posix()]=p.read_bytes()
for n in content:assert '.env'not in Path(n).name and Path(n).suffix.lower()not in['.dump','.key','.pem','.pfx']
manifest={'status':'LOCAL_CONSERVATIVE_51_SOURCE_CLOSURE_PASS_HOSTED_HOLD','installationArtifact':'database/closed-install.sql','provenanceNotSequentialInstall':'provenance-only/','sourceCount':51,'newFunctionsClosedBeforeCommit':379,'codeFiles':23,'codeUnchangedFrom':oldReceipt['sha256'],'hostedAuthorization':False,'databaseBackup':False,'actualBrowser':False,'signedProvider':False,'requiresOfficialAtomicMigrationTransportReview':True,'entries':[{'file':n,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}for n,b in sorted(content.items())]}
out=Path('test-results/native-mixed-preparation-closure51-20261107.zip')
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED)as z:
 for n,b in sorted(content.items()):z.writestr(n,b)
 z.writestr('MANIFEST.json',json.dumps(manifest,indent=2))
 z.writestr('READ_ME_FIRST.txt','LOCAL CANDIDATE ONLY. Not authorized for hosted use. Official migration transport must preserve a single atomic transaction and close every new function before commit. Never install provenance-only sources sequentially. Fresh recovery, restored-staging proof, exact cohort and separate authorization remain required. This is not a database backup.\n')
with zipfile.ZipFile(out)as z:
 assert z.testzip()is None
 for x in manifest['entries']:assert hashlib.sha256(z.read(x['file'])).hexdigest()==x['sha256']
receipt={'file':out.as_posix(),'bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'sources':51,'codeFiles':23,'newFunctions':379,'newTables':118,'newSequence':1,'bootstrapOperations':30,'existingFunctionOwnersACLsPreserved':781,'existingGuardBodiesChanged':2,'fiveAccountingFunctionsPreserved':True,'qConstraintsPreserved':True,'trackedContainersAbsent':30,'hostedChanges':False,'databaseBackup':False}
Path('test-results/native-mixed-preparation-closure51-receipt-20261107.json').write_text(json.dumps(receipt,indent=2),encoding='utf8');print(json.dumps(receipt))
