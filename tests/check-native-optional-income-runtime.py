"""Independent evidence arithmetic, lineage and old-zero upgrade oracle."""
import json
import sys
from pathlib import Path

run = Path(sys.argv[1])
proof = json.loads((run / 'native-income_complete_v3.json').read_text(encoding='utf-8'))
stages = proof['evidence']
assert len(stages) == 4
expected = [10000, 15000, 0, 20000]
for index, stage in enumerate(stages):
    projection = stage['projection']
    assert projection['complete'] is True
    assert projection['headVersion'] == index+1
    assert projection['activeMinor'] == expected[index]
    assert len(projection['records']) == index+1
    assert stage['accepted'] == stage['reconciliation']['result']
    assert stage['accepted']['moneyMoved'] is False
    funds = stage['fundSource']['funds']
    assert funds['nativeReceiptsMinor'] == 81000
    assert funds['recordedIncomeMinor'] == expected[index]
    assert funds['recordedReceiptsMinor'] == 81000+expected[index]
    assert funds['regularFundMinor'] == 48000-5000+expected[index]
    assert funds['qFundMinor'] == 17000 and funds['sideFundMinor'] == 16000
    assert stage['review']['reviewStatus'] == ('reviewed_zero' if index == 2 else 'recorded_complete')

records = stages[-1]['projection']['records']
assert [row['amount_minor'] for row in records] == expected
assert [row['voided'] for row in records] == [False, False, True, False]
assert records[0]['income_id'] == records[1]['income_id'] == records[2]['income_id']
assert records[3]['income_id'] != records[0]['income_id']
assert records[0]['prior_record_id'] is None and records[3]['prior_record_id'] is None
assert records[1]['prior_record_id'] == records[0]['record_id']
assert records[2]['prior_record_id'] == records[1]['record_id']
assert len({row['physical_evidence_id'] for row in records}) == 2
assert sum(row['amount_minor'] for row in records) != 20000  # Never sum corrections as cash.
assert proof['counts'] == dict(incomeRecords=4, roots=2)
for key in ['noRefunds', 'atomicIncomeRollback', 'orphanRootRejected', 'crossDomainRejected',
            'postFinalIncomeRejected', 'incomeConcurrentWriterProof', 'revokedIncomeReplayDenied']:
    assert proof[key] is True

final = proof['final']
assert final['accepted']['totalMinor'] == 96000
assert final['accepted']['awardStatus'] == 'recorded_unpaid'
assert final['accepted']['moneyMoved'] is False
rows = final['record']['recipients']
assert len(rows) == 12
assert sum(row['amount_minor'] for row in rows) == 96000
assert sorted(row['amount_minor'] for row in rows if row['pool_kind'] == 'regular') == [11000, 11000, 16500, 24500]
assert sorted(row['amount_minor'] for row in rows if row['pool_kind'] == 'q') == [1000, 2500, 5500, 8000]
assert sorted(row['amount_minor'] for row in rows if row['pool_kind'] == 'side') == [1500, 3000, 5000, 6500]
assert 96000+5000 == 81000+20000
assert all(row['amount_minor'] % 500 == 0 for row in rows)
assert final['record']['awardSet']['source_capture'] == final['finalSource']
assert final['finalSource']['fundSource'] == final['fundSource']
upgrade = json.loads((run / 'native-income_upgrade_exact_v3.json').read_text(encoding='utf-8'))
assert upgrade['before'] == upgrade['after']
assert upgrade['exactOldZeroHash'] and upgrade['exactOldReplay']
result = dict(passed=True, independentAppImports=False, incomeVersions=4, physicalRoots=2,
              activeIncomeMinor=20000, nativeReceiptsMinor=81000, costsMinor=5000,
              unpaidAwardsMinor=96000, awardRows=12, oldZeroExact=True,
              noRefunds=True, moneyMoved=False, providerVerified=False)
(run / 'independent-income-oracle.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps(result))
