from pathlib import Path
old='native-mixed-start-ui'
new='native-mixed-bootstrap-flow'
d=Path('test-results/'+new+'-20261107')
assert not (d/'state.json').exists(), 'Never overwrite a prior fixture'
d.mkdir(exist_ok=True)
(d/'proposal-order.json').write_bytes(Path('test-results/'+old+'-20261107/proposal-order.json').read_bytes())
for part in ['runtime','setup','flow','scoring']:
    s=Path('tests/'+old+'-acceptance-local-'+part+'.mjs').read_text(encoding='utf8').replace(old,new).replace('fixture_native_mixed_start_ui','fixture_native_mixed_bootstrap_flow')
    if part=='flow':
        s=s[:s.index('const gates=')]+"\nconsole.log('PASS seed18 only; no preparation writes');\n"
    Path('tests/'+new+'-acceptance-local-'+part+'.mjs').write_text(s,encoding='utf8')
s=Path('tests/helpers/'+old+'-acceptance-db.mjs').read_text(encoding='utf8').replace(old,new).replace('fixture_native_mixed_start_ui','fixture_native_mixed_bootstrap_flow')
Path('tests/helpers/'+new+'-acceptance-db.mjs').write_text(s,encoding='utf8')
