"""Document the proven whole-file closure and remaining literal schema changes."""
from pathlib import Path
import hashlib,json,re
from atomic_sql_source import statements,code
d=Path('test-results/native-mixed-bootstrap-atomic51-20261107');manifest=json.loads((d/'closed-install-manifest.json').read_text());sources=manifest['sources'];assert len(sources)==51
newtables=set()
for x in sources:newtables.update(re.findall(r'\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?((?:app|public)\.\w+)',Path(x['file']).read_bytes().decode(),re.I))
existing=[]
for x in sources:
 for s in statements(Path(x['file']).read_bytes().decode()):
  c=code(s);m=re.match(r'alter\s+table\s+(?:only\s+)?((?:app|public)\.\w+)',c,re.I)
  if m and m[1]not in newtables:existing.append({'file':Path(x['file']).name,'table':m[1],'statement':' '.join(c.split()),'sha256':hashlib.sha256(c.encode()).hexdigest()})
graph=json.loads(Path('test-results/native-mixed-preparation-sql-dependencies-20261107.json').read_text());byname={x['name']:x for x in graph['files']}
manual=['custom-pool-setup-save-v3.sql','native-mixed-own-player-bindings-v1.sql','native-mixed-paper-binding-v1.sql','reviewed-seating-trial-scope-v1.sql'];seen=set();todo=graph['roots']+manual
while todo:
 n=todo.pop()
 if n in seen:continue
 seen.add(n);todo.extend(set(byname[n]['requiresCandidateFiles'])-seen)
actual={Path(x['file']).name for x in sources};assert actual==seen,(sorted(actual-seen),sorted(seen-actual))
cut=sorted(set(byname)-actual)
result={'status':'LOCAL_VALIDATED_CONSERVATIVE_WHOLE_FILE_CLOSURE','sourceCount':51,'sourceNames':sorted(actual),'removedFrom57':cut,'manualSafetyRoots':{'custom-pool-setup-save-v3.sql':'Provides the custom Side ratio column and immutable draft guard; its owner DO requires guard_custom_side_policy_v3 from the Side bridge, which requires graduated math.','native-mixed-own-player-bindings-v1.sql':'Confinement dynamically wraps this public function by literal name.','native-mixed-paper-binding-v1.sql':'Confinement dynamically wraps this public function by literal name.','reviewed-seating-trial-scope-v1.sql':'Retains the security amendment and raw random/reviewed seating denials; do not remove a guard based on static non-use.'},'preservedAccountingFunctions':5,'remainingBaselineFunctionBodyChanges':json.loads((d/'catalog-comparison.json').read_text())['definitionChanges'],'existingLiteralTableAlterStatements':existing,'atomicSqlSha256':manifest['sha256'],'limits':['This is not a proven globally minimum object-level schema.','Unexecuted private functions remain because whole-file table/FK/trigger/collision-history dependencies are retained.','Regex graph misses dynamic SQL and column dependencies; four safety roots were explicitly reviewed.','Literal ALTER list is not a complete schema diff: dynamic DDL, triggers and metadata still require fresh restored-staging review.','No hosted state or provider session was tested.']}
Path('test-results/native-mixed-closure51-report-20261107.json').write_text(json.dumps(result,indent=2),encoding='utf8')
print(json.dumps({'sources':len(actual),'cut':cut,'existingLiteralAlterCount':len(existing),'tables':sorted({x['table']for x in existing})}))
