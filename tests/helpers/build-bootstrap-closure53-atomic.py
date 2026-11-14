"""Compile exact source bodies into one closed transaction. Never execute it here."""
from pathlib import Path
import hashlib,json
from atomic_sql_source import without_transactions,statements,code
d=Path('test-results/native-mixed-bootstrap-closure53-20261107');state=json.loads((d/'state.json').read_text())
assert state['cleaned'] and state['cleanupVerified'],'Require completed and removed source-proof fixture'
assert len(json.loads((d/'workflow-results.json').read_text())['results'])==30
source=json.loads((d/'derived-schema-manifest.json').read_text());files=[Path(x['file'])for x in source['files']]+[Path('database/proposals')/n for n in ['native-mixed-pilot-confinement-v1.sql','native-mixed-bootstrap-workflow-v1.sql']]
assert len(files)==53
out=Path('test-results/native-mixed-bootstrap-atomic53-20261107');out.mkdir(exist_ok=True);parts=['begin;\nset local lock_timeout=\'5s\';\nset local statement_timeout=\'120s\';\n'];manifest=[]
for p in files:
 s=p.read_bytes().decode('utf8');body,counts=without_transactions(s)
 assert not any('concurrently' in code(x).lower().split() for x in statements(body))
 parts += ['\n-- Frozen source '+p.name+'\n',body,'\n'];manifest.append({'file':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),**counts})
revoke=(d/'new-function-revokes.sql').read_bytes().decode('utf8');assert revoke.count('revoke all on function ')==393
parts+=['\n-- FINAL_CLOSED_PRIVILEGES\n',revoke,'\ncommit;\n'];sql=''.join(parts)
assert sum(code(x).lower()=='begin;'for x in statements(sql))==1
assert sum(code(x).lower()=='commit;'for x in statements(sql))==1
p=out/'closed-install.sql';p.write_bytes(sql.encode('utf8'))
(out/'closed-install-manifest.json').write_text(json.dumps({'status':'LOCAL_ATOMIC_INSTALL_CANDIDATE_NOT_HOSTED','sources':manifest,'file':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'literalFunctionRevokes':393,'transientGrantWindowPreventedBySingleTransaction':True,'requiresRuntimeAcceptance':True},indent=2),encoding='utf8')
print(json.dumps({'sources':len(files),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'closedBeforeCommit':True}))
