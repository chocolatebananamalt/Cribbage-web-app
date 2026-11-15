import hashlib,json,sys
from pathlib import Path
root=Path(__file__).resolve().parents[1];run=Path(sys.argv[1]).resolve()
trace=json.loads((run/'trace.json').read_text(encoding='utf-8-sig'));checked=[]
for entry in trace:
 if 'file' not in entry or 'sha256' not in entry:continue
 matches=[p for p in (root/'database').rglob(entry['file']) if p.is_file()];assert len(matches)==1,entry['file']
 p=matches[0];digest=hashlib.sha256(p.read_bytes()).hexdigest();assert digest==entry['sha256'].lower(),str(p)
 checked.append({'file':str(p.relative_to(root)).replace('\\','/'),'sha256':digest})
assert any(p['file'].endswith('native-recorded-fund-review-source-v1.sql') for p in checked)
receipt={'passed':True,'scope':'installed disposable-local SQL byte comparison','runtimeDirectory':str(run),'hostedChanges':False,'files':checked}
(root/'test-results/expense-fund-review-source-integrity.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8');print(json.dumps({'passed':True,'files':len(checked)}))
