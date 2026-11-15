import importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('atomic_sql_source',Path(__file__).parent/'helpers/atomic_sql_source.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class AtomicSQL(unittest.TestCase):
    def test_bodies_and_quotes(self):
        body="create function app.x()returns void language plpgsql as $outer$begin perform 'commit;'; perform $inner$begin;$inner$;end$outer$;"
        source='-- header\r\nbegin;'+body+"select E'escaped\\\';begin;', 'it''s;commit;', \"a;b\";/*a;/*b;*/c;*/commit;-- tail"
        out,counts=m.without_transactions(source);self.assertIn(body,out);self.assertEqual(counts,{'beginsRemoved':1,'commitsRemoved':1});self.assertEqual(''.join(m.statements(source)),source)
    def test_errors(self):
        for s in ["begin;select 'bad;commit;",'begin;/* missing','begin;do $$ missing','begin;select 1;']:
            with self.assertRaises(ValueError):m.without_transactions(s)
    def test_all_candidate_files_preserve_dollar_bodies(self):
        import json,re
        d=json.loads(Path('test-results/native-mixed-bootstrap-min3-20261107/derived-schema-manifest.json').read_text())
        files=[Path(x['file']) for x in d['files']]+[Path('database/proposals')/n for n in ['native-mixed-pilot-confinement-v1.sql','native-mixed-bootstrap-workflow-v1.sql']]
        self.assertEqual(len(files),53)
        for p in files:
            s=p.read_bytes().decode();out,c=m.without_transactions(s)
            before=[x for x in m.statements(s)if m.code(x).lower()not in('begin;','commit;')]
            self.assertEqual(out,''.join(before),p.name);self.assertGreater(c['beginsRemoved'],0)
if __name__=='__main__':unittest.main()
