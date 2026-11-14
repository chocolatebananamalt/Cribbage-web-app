"""Independent exported-evidence oracle; no app calculator imports or DB access."""
import json
import sys
from pathlib import Path

root = Path(sys.argv[1]).resolve()
proof = json.loads((root / 'native-native_optional_final_v2.json').read_text(encoding='utf-8'))
source = proof['fundSource']
record = proof['record']
funds = source['funds']
assert funds == dict(regularReceiptsMinor=48000, regularCostMinor=5000,
                    regularFundMinor=43000, qFundMinor=17000,
                    sideFundMinor=16000, recordedReceiptsMinor=81000)
assert 48000 - 5000 == 43000
assert 43000 + 17000 + 16000 + 5000 == 81000
assert source['sanctioning']['totalMinor'] == 4800
assert proof['syntheticAssessment'] is True and proof['normalStartRpcVerified'] is False
rows = record['recipients']
assert len(rows) == 12
assert len({(row['fund_key'], row['participant_id']) for row in rows}) == 12
assert all(isinstance(row['amount_minor'], int) and row['amount_minor'] >= 0
           and row['amount_minor'] % 500 == 0 for row in rows)
assert sum(row['amount_minor'] for row in rows) == 76000
assert record['awardSet']['total_minor'] == 76000
assert record['awardSet']['award_status'] == 'recorded_unpaid'
assert record['awardSet']['money_moved'] is False
assert record['currentFundAuthority'] is False
assert proof['accepted'] == proof['reconciliation']['result']
assert proof['atomicRollback'] and proof['staleRejected'] and proof['exactReplay']
assert proof['revokedReplayDenied'] and proof['privateAclDenied']

# Derive knockout finishing groups directly from exported verified match results.
playoff = source['recipientSource']['playoff']
assert playoff['qualifierCount'] == 4
matches = {match['slot']: match for match in playoff['matches']}
assert set(matches) == {1, 2, 3}
final = matches[3]['result']
expected = {final['winnerId']: (1, 1, 17000), final['loserId']: (2, 2, 11000)}
for slot in (1, 2):
    expected[matches[slot]['result']['loserId']] = (3, 4, 7500)
regular = [row for row in rows if row['pool_kind'] == 'regular']
assert len(regular) == 4
for row in regular:
    assert (row['first_place'], row['last_place'], row['amount_minor']) == expected[row['participant_id']]
    assert row['profile_id'] is not None
assert sum(row['amount_minor'] for row in regular) == 43000

assert len(record['optionalPools']) == 3
q_schedules = []
for pool in record['optionalPools']:
    selected = [row for row in rows if row['fund_key'] == pool['fund_key']]
    assert sum(row['amount_minor'] for row in selected) == pool['fund_minor']
    assert {(row['participant_id'], row['amount_minor']) for row in selected} == {
        (row['participantId'], row['amountMinor']) for row in pool['source_rows']}
    if pool['pool_kind'] == 'q':
        q_schedules.append(sorted(row['amount_minor'] for row in selected))
    else:
        assert sorted(row['amount_minor'] for row in selected) == [1500, 3000, 5000, 6500]
assert sorted(q_schedules) == [[1000], [2500, 5500, 8000]]
assert proof['sameBusy'] == dict(status='retry_exact', code='operation_busy')
assert proof['distinctBusy'] == dict(status='retry_exact', code='event_busy')
out = dict(status='passed', independentAppImports=False, regularMinor=43000,
           qMinor=17000, sideMinor=16000, costsMinor=5000, receiptsMinor=81000,
           recipientRows=12, refundRows=0, syntheticAssessment=True,
           normalStartRpcVerified=False, providerVerified=False, moneyMoved=False)
(root / 'independent-final-oracle.json').write_text(json.dumps(out, indent=2), encoding='utf-8')
print(json.dumps(out))
