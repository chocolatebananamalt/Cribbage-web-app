"""Read source and git metadata only. Never execute SQL or deploy."""
from pathlib import Path
import hashlib,json,re,subprocess,sys
root=Path.cwd()
proposal_names=json.loads(Path('test-results/native-mixed-bootstrap-flow-20261107/proposal-order.json').read_text())
proposal_names+=['native-mixed-pilot-confinement-v1.sql','native-mixed-pilot-director-session-v1.sql','native-mixed-pilot-preparation-v1.sql','native-mixed-pilot-draw-reservation-v1.sql','native-mixed-pilot-bootstrap-status-v1.sql','native-mixed-bootstrap-workflow-v1.sql']
schema=[]
for name in proposal_names:
 p=Path('database/proposals')/name;s=p.read_text(encoding='utf8')
 schema.append({'file':p.as_posix(),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size,'declaredTables':sorted(set(re.findall(r'create\s+table\s+(?:if\s+not\s+exists\s+)?([\w.]+)',s,re.I))),'declaredFunctionNames':sorted(set(re.findall(r'create\s+(?:or\s+replace\s+)?function\s+([\w.]+)',s,re.I)))})
roots=[]
bootstrap_only='--bootstrap-only' in sys.argv
folders=['src/app/api/v1/tournaments/[id]/rehearsal/[eventId]/bootstrap/[mode]','src/app/tournament/[tournamentId]/rehearsal-participation'] if bootstrap_only else ['src/app/api/v1/tournaments/[id]/rehearsal','src/app/tournament/[tournamentId]/rehearsal-prepare','src/app/tournament/[tournamentId]/rehearsal-participation']
for folder in folders:
 roots += [p for p in Path(folder).rglob('*') if p.suffix in ['.ts','.tsx']]
seen=set();unresolved=[]
def visit(p):
 p=p.resolve();assert p.is_relative_to(root)
 if p in seen:return
 seen.add(p)
 if p.suffix not in ['.ts','.tsx']:return
 s=p.read_text(encoding='utf8')
 for spec in re.findall(r'(?:from\s*|import\s*\(\s*|import\s*)[\'\"]([^\'\"]+)[\'\"]',s):
  if not spec.startswith('.'):continue
  base=p.parent/spec
  found=next((q for q in [base,Path(str(base)+'.ts'),Path(str(base)+'.tsx'),base/'index.ts',base/'index.tsx'] if q.is_file()),None)
  if found:visit(found)
  else:unresolved.append({'file':p.relative_to(root).as_posix(),'specifier':spec})
for p in roots:visit(p)
tree=subprocess.run(['git','ls-tree','-r','HEAD','--','src'],capture_output=True,text=True,check=True).stdout
tracked={line.split('\t',1)[1]:line.split()[2] for line in tree.splitlines()}
code=[]
for p in sorted(seen):
 n=p.relative_to(root).as_posix();b=p.read_bytes();blob=hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
 if tracked.get(n)==blob:continue
 code.append({'file':n,'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b),'status':'modified' if n in tracked else 'new'})
assert not unresolved,unresolved
result={'status':'READ_ONLY_PLANNING_NOT_RELEASE_AUTHORIZATION','baselineCommit':'ba2845a92a484ec66e360817709c5c6ed43aa296','schemaOrder':schema,'schemaFiles':len(schema),'codeImportClosure':code,'changedCodeFiles':len(code),'entrypoints':[p.as_posix() for p in roots],'limits':['Import closure is a candidate, not an isolated build proof.','Whole-file SQL dependency set is locally tested; no smaller object-level extraction is claimed.','No enablement patch, actor cohort or final hosted grant manifest is approved or installed.','No hosted database state or secrets are included.']}
Path('test-results/'+('native-mixed-bootstrap-only-inventory-20261107.json' if bootstrap_only else 'native-mixed-staging-plan-inventory-20261107.json')).write_text(json.dumps(result,indent=2),encoding='utf8')
print(json.dumps({'schemaFiles':len(schema),'changedCodeFiles':len(code),'unresolvedImports':len(unresolved),'schemaBytes':sum(x['bytes'] for x in schema),'codeBytes':sum(x['bytes'] for x in code)}))
