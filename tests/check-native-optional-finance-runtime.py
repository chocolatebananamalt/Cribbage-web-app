"""Independent source partition / Fraction oracle; no application imports."""
from pathlib import Path
from fractions import Fraction
import hashlib
import json
import sys

run = Path(sys.argv[1]).resolve()
native = json.loads((run / 'sql-result.json').read_text(encoding='utf-8'))['native']
result = native['callbackResult']
capture = result['source']['capture']
manifest = json.loads((run / 'source-manifest.json').read_text(encoding='utf-8'))
for row in manifest:
    assert hashlib.sha256(Path(row['file']).read_bytes()).hexdigest() == row['sha256'], row['file']
roster = capture['rosterReceiptPartitions']
side = capture['sideRecordedSources']
assert len(roster) == len(side) == 16
roster_ids = {r['receipt']['id'] for r in roster}
side_ids = {r['election']['id'] for r in side}
assert len(roster_ids) == len(side_ids) == 16 and roster_ids.isdisjoint(side_ids)
regular = q_total = 0
for row in roster:
    parts = row['source']['allocations']
    assert sum(p['amountMinor'] for p in parts) == row['receipt']['amount_minor'] == row['source']['amountMinor']
    assert len([p for p in parts if p['bucket'] == 'regular_entry']) == 1
    regular += sum(p['amountMinor'] for p in parts if p['bucket'] == 'regular_entry')
    q_total += sum(p['amountMinor'] for p in parts if p['bucket'] == 'q')
assert regular == 48000 and q_total == 17000
assert sum(row['source']['amountMinor'] for row in side) == 16000
assert sum(row['receipt']['amount_minor'] for row in roster) + 16000 == 81000
assert sum(row['amountMinor'] for row in capture['basis']['expenses']) == 5000
for pool in capture['qSource']['obligations']:
    assert pool['kind'] == 'award'
    assert sum(row['amountMinor'] for row in pool['rows']) == pool['fundMinor']
for pool in capture['sideBasis']['manifest']:
    assert sum(row['amountMinor'] for row in pool['source']['obligations']) == pool['source']['fundMinor']
weights = list(map(Fraction, [9, 6, 4, 4]))
raw = [Fraction(43000) * weight / sum(weights) / 500 for weight in weights]
rounded = [(value.numerator * 2 // value.denominator + 1) // 2 * 500 for value in raw]
assert rounded == [17000, 11000, 7500, 7500]
assert result['view']['calculatedTotalMinor'] == 43000
assert result['adjustedView']['adjustedTotalMinor'] == 44000 and result['adjustedView']['differenceMinor'] == 1000
assert result['staleSourceRollback'] and result['changedClassificationAdoptionBlocked'] and result['revokedRoleReplayDenied']
assert all(result['aclProof'].values())
assert result['envelope']['result']['version'] == 1 and result['second']['result']['version'] == 2
assert result['normalFinalizationSupported'] is False and result['moneyMoved'] is False and result['providerVerified'] is False
assert 'rosterReceiptPartitions' not in json.dumps(result['decoded'])
cleanup = json.loads((run / 'cleanup.json').read_text(encoding='utf-8'))
assert cleanup['runnerExitCode'] == 0 and cleanup['verifiedAbsentByIdAndName']
report = {'passed': True, 'sourceFiles': len(manifest), 'installedSql': 89,
          'regularReceiptsMinor': regular, 'qReceiptsMinor': q_total, 'sideReceiptsMinor': 16000,
          'costsMinor': 5000, 'regularFundMinor': 43000, 'regularBandsMinor': rounded,
          'totalProposedMinor': 76000, 'manualProposalOverByMinor': 1000, 'newFinalLiabilities': 0,
          'refunds': 0, 'bankVerified': False, 'liveSpreadsheetRecalculation': False,
          'oracle': 'Python Fraction/integer arithmetic; no app imports'}
(run / 'independent-reproducible-check.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report))
