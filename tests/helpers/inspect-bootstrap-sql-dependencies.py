"""Conservative source-reference graph, diagnostic only (not a SQL parser)."""
from pathlib import Path
import hashlib,json,re
d=json.loads(Path('test-results/native-mixed-bootstrap-min3-20261107/derived-schema-manifest.json').read_text())
files={Path(x['source']).name:Path(x['file']) for x in d['files']}
for n in ['native-mixed-pilot-confinement-v1.sql','native-mixed-pilot-director-session-v1.sql','native-mixed-pilot-preparation-v1.sql','native-mixed-pilot-draw-reservation-v1.sql','native-mixed-pilot-bootstrap-status-v1.sql','native-mixed-bootstrap-workflow-v1.sql']:files[n]=Path('database/proposals')/n
text={n:p.read_bytes().decode('utf8') for n,p in files.items()}
decl={n:set(re.findall(r'\bcreate\s+(?:or\s+replace\s+)?(?:function|table(?:\s+if\s+not\s+exists)?)\s+((?:app|public)\.[a-zA-Z0-9_]+)',s,re.I)) for n,s in text.items()}
providers={}
for n,names in decl.items():
 for name in names:providers.setdefault(name,set()).add(n)
refs={n:set(re.findall(r'\b(?:app|public)\.[a-zA-Z0-9_]+',s)) for n,s in text.items()}
edges={n:{p for name in names for p in providers.get(name,set()) if p!=n} for n,names in refs.items()}
roots=['native-mixed-bootstrap-workflow-v1.sql','native-mixed-pilot-confinement-v1.sql','event-settings-operational-activation-v1.sql','event-settings-workspace-v3.sql','event-rule-context-v1.sql']
seen=set();todo=roots[:]
while todo:
 n=todo.pop()
 if n in seen:continue
 seen.add(n);todo.extend(edges[n]-seen)
removed=['native-mixed-pilot-director-session-v1.sql','native-mixed-pilot-preparation-v1.sql','native-mixed-pilot-draw-reservation-v1.sql','native-mixed-pilot-bootstrap-status-v1.sql']
incoming={n:[{'file':other,'symbols':sorted(refs[other]&decl[n])} for other in files if other!=n and refs[other]&decl[n]] for n in removed}
result={'status':'SOURCE_DIAGNOSTIC_NOT_RUNTIME_PROOF','roots':roots,'closure':sorted(seen),'outsideGraphClosure':sorted(set(files)-seen),'proposedConservativeWholeFileCuts':removed,'incomingToCuts':incoming,'files':[{'name':n,'file':str(files[n]),'sha256':hashlib.sha256(files[n].read_bytes()).hexdigest(),'declares':sorted(decl[n]),'requiresCandidateFiles':sorted(edges[n]),'externalOrDynamicReferences':sorted(refs[n]-providers.keys())} for n in files],'limits':['Regex references include comments and dead branches; not a sound object-level SQL closure.','New-column ALTER, trigger safety, dynamic SQL, ACLs and function-body validation need explicit review and runtime.','Do not drop a guard, table or writer merely because this graph does not resolve it.']}
Path('test-results/native-mixed-preparation-sql-dependencies-20261107.json').write_text(json.dumps(result,indent=2),encoding='utf8')
print(json.dumps({'total':len(files),'graphClosure':len(seen),'outside':result['outsideGraphClosure'],'incomingToCuts':incoming}))
