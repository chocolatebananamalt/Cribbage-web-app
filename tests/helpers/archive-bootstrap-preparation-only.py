"""Freeze tested preparation-only overlay and schema candidate, never hosted data."""
from pathlib import Path
import hashlib,json,zipfile
root=Path.cwd();d=Path('test-results/native-mixed-bootstrap-min3-20261107')
state=json.loads((d/'state.json').read_text());assert state['cleaned'] and state['cleanupVerified']
proof=json.loads((d/'workflow-results.json').read_text());assert len(proof['results'])==30
assert any('all five published accounting' in x for x in proof['checks'])
assert any('disabled throughout' in x for x in proof['checks'])
isolated=Path('test-results/native-bootstrap-isolated-20261107');overlay=json.loads((isolated/'overlay-manifest.json').read_text());app=Path(overlay['appLocation']).resolve();assert app.is_relative_to(root.parent)
verification=json.loads((isolated/'verification.json').read_text());assert verification['changedFiles']==23 and not verification['unrelatedTrackedFileChanges']
schema=json.loads((d/'derived-schema-manifest.json').read_text());entries=[]
for i in overlay['files']:
 p=app/i['file'];sha=hashlib.sha256(p.read_bytes()).hexdigest();expected=overlay['enablement']['afterSha256'] if i['file']==overlay['enablement']['file'] else i['sha256'];assert sha==expected;entries.append({'file':str(p),'archive':'overlay/'+i['file'],'sha256':sha,'kind':'code'})
for i in schema['files']:
 p=Path(i['file']);assert hashlib.sha256(p.read_bytes()).hexdigest()==i['sha256'];entries.append({'file':str(p),'archive':'schema/'+Path(i['source']).name,'sha256':i['sha256'],'kind':'sql'})
addons=['native-mixed-pilot-confinement-v1.sql','native-mixed-pilot-director-session-v1.sql','native-mixed-pilot-preparation-v1.sql','native-mixed-pilot-draw-reservation-v1.sql','native-mixed-pilot-bootstrap-status-v1.sql','native-mixed-bootstrap-workflow-v1.sql']
for n in addons:
 p=Path('database/proposals')/n;entries.append({'file':str(p),'archive':'schema/'+n,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'kind':'sql'})
for folder in [d,isolated]:
 for p in folder.rglob('*'):
  if p.is_file() and p.suffix not in ['.zip','.dump','.key','.pem','.pfx'] and 'schema' not in p.parts:
   entries.append({'file':str(p),'archive':'evidence/'+p.as_posix(),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'kind':'evidence'})
for n in ['docs/quality/2026-11-07-native-mixed-preparation-only-package.md','docs/quality/2026-11-07-native-mixed-staging-test-plan.md','test-results/native-mixed-bootstrap-only-inventory-20261107.json','test-results/bootstrap-min-application-20261107.log','test-results/bootstrap-min-focused-20261107.log','test-results/bootstrap-min-typecheck-20261107.log','test-results/bootstrap-min-lint-20261107.log','test-results/native-mixed-preparation-only-cleanup-20261107.json']:
 p=Path(n);assert p.is_file();entries.append({'file':str(p),'archive':p.as_posix(),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'kind':'evidence'})
for pattern in ['tests/native-mixed-bootstrap-min3-acceptance-local-*.mjs','tests/helpers/native-mixed-bootstrap-min3-acceptance-db.mjs','tests/helpers/prepare-bootstrap-*.py','tests/helpers/verify-bootstrap-isolated-source.mjs','tests/helpers/archive-bootstrap-preparation-only.py','tests/native-mixed-preparation-only-*.mjs','tests/native-mixed-bootstrap-*test.mjs','tests/helpers/bootstrap-workflow-example.mjs']:
 for p in Path('.').glob(pattern):
  entries.append({'file':str(p),'archive':p.as_posix(),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'kind':'evidence'})
assert len([x for x in entries if x['kind']=='code'])==23 and len([x for x in entries if x['kind']=='sql'])==57
manifest={'status':'LOCAL_PREPARATION_ONLY_PASS_HOSTED_RELEASE_HOLD','baseline':overlay['baseline'],'entries':entries,'schemaOrder':[Path(x['source']).name for x in schema['files']]+addons,'removedAccountingDefinitions':schema['removed'],'newEntry':'/tournament/<tid>/rehearsal-participation/<eid>/director','productionGateRemainsFalse':True,'candidateBootstrapGateEnabled':True,'drawStartScoringFinanceDisabled':True,'hostedChanges':False,'databaseBackup':False,'actualBrowser':False,'signedProvider':False}
out=Path('test-results/native-mixed-preparation-only-candidate-20261107.zip')
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
 for i in entries:z.write(i['file'],i['archive'])
 z.writestr('MANIFEST.json',json.dumps(manifest,indent=2))
with zipfile.ZipFile(out) as z:
 assert z.testzip() is None
 for i in entries:assert hashlib.sha256(z.read(i['archive'])).hexdigest()==i['sha256']
receipt={'file':out.as_posix(),'bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'codeFiles':23,'sqlFiles':57,'bootstrapOperations':30,'fiveExistingAccountingFunctionsUnchanged':True,'hostedChanges':False,'databaseBackup':False,'actualBrowser':False,'signedProvider':False}
Path('test-results/native-mixed-preparation-only-candidate-receipt-20261107.json').write_text(json.dumps(receipt,indent=2),encoding='utf8')
print(json.dumps(receipt))
