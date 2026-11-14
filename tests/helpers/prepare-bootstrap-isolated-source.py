"""Extract published code plus exact 23-file bootstrap overlay. No git writes."""
from pathlib import Path
import hashlib,io,json,subprocess,zipfile
root=Path.cwd();out=root/'test-results/native-bootstrap-isolated-20261107/app'
assert not out.exists(),'Never overwrite a prior isolated build'
out.mkdir(parents=True)
raw=subprocess.run(['git','archive','--format=zip','ba2845a92a484ec66e360817709c5c6ed43aa296'],capture_output=True,check=True).stdout
with zipfile.ZipFile(io.BytesIO(raw)) as z:
 for i in z.infolist():
  dest=(out/i.filename).resolve();assert dest.is_relative_to(out)
  if i.is_dir():dest.mkdir(parents=True,exist_ok=True)
  else:dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(z.read(i))
d=json.loads(Path('test-results/native-mixed-bootstrap-only-inventory-20261107.json').read_text());manifest=[]
for i in d['codeImportClosure']:
 p=Path(i['file']);b=p.read_bytes();assert hashlib.sha256(b).hexdigest()==i['sha256'];dest=out/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(b);manifest.append(i)
# Explicit isolated-only enablement. Original workspace flags remain false.
p=out/'src/lib/seating/native-mixed-bootstrap-workflow-v1.ts';s=p.read_text(encoding='utf8');assert s.count('bootstrapWorkflowEnabled=()=>false')==1;s=s.replace('bootstrapWorkflowEnabled=()=>false','bootstrapWorkflowEnabled=()=>true');p.write_text(s,encoding='utf8')
enablement={'file':p.relative_to(out).as_posix(),'beforeSha256':next(i['sha256'] for i in manifest if i['file']==p.relative_to(out).as_posix()),'afterSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'change':'bootstrapWorkflowEnabled false to true in isolated copy only'}
Path('test-results/native-bootstrap-isolated-20261107/overlay-manifest.json').write_text(json.dumps({'baseline':d['baselineCommit'],'files':manifest,'enablement':enablement,'hosted':False,'fixture':False},indent=2),encoding='utf8')
print(json.dumps({'app':str(out),'changedFiles':len(manifest),'enablement':enablement}))
