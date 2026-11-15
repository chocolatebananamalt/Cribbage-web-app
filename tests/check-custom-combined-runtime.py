"""Independent integer/Fraction oracle; no application calculation imports."""
from fractions import Fraction
from pathlib import Path
import json
import sys

def graduated(count, ratio, fee):
    places = (count + ratio - 1) // ratio
    weights = list(range(places, 0, -1))
    units = count * fee // 500
    raw = [Fraction(units * weight, sum(weights)) for weight in weights]
    rounded = [int(value) for value in raw]
    for index in sorted(range(places), key=lambda n: (-(raw[n] - rounded[n]), n))[:units-sum(rounded)]:
        rounded[index] += 1
    return [value * 500 for value in rounded]

def objects(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from objects(child)
    elif isinstance(value, list):
        for child in value:
            yield from objects(child)

root = Path(sys.argv[1]).resolve()
data = json.loads((root / 'sql-result.json').read_text(encoding='utf-8'))
all_objects = list(objects(data['combined']))
workspaces = [value for value in all_objects if isinstance(value.get('finalization'), dict)
              and value['finalization'].get('status') == 'unpaid' and value['finalization'].get('current') is True]
assert workspaces, 'No current unpaid final workspace'
workspace = workspaces[-1]
assert workspace['blockers'] == []
facts = workspace['facts']
for key, value in {'baseIncomeMinor':48000,'qIncomeMinor':17000,'sideIncomeMinor':16000,
                   'receiptTotalMinor':81000,'expenseTotalMinor':5000,'regularAwardMinor':43000}.items():
    assert facts[key] == value, (key, facts[key], value)
assert graduated(16,7,1000) == [8000,5500,2500]
assert graduated(16,5,1000) == [6500,5000,3000,1500]
q_pools = workspace['qReview']['obligations']
assert len(q_pools) == 2 and all(pool['kind'] == 'award' for pool in q_pools)
q_custom = next(pool for pool in q_pools if pool['fundMinor'] == 16000)
assert [row['amountMinor'] for row in q_custom['rows']] == graduated(16,7,1000)
assert [row['participantId'][-12:] for row in q_custom['rows']] == [f'{n:012}' for n in [2,1,4]]
q_equal = next(pool for pool in q_pools if pool['fundMinor'] == 1000)
assert [row['amountMinor'] for row in q_equal['rows']] == [1000]
assert q_equal['rows'][0]['participantId'].endswith('000000000001')
side_reviews = workspace['sideReviews']
assert len(side_reviews) == 1
side_rows = side_reviews[0]['obligations']
assert [row['amountMinor'] for row in side_rows] == graduated(16,5,1000)
assert [row['participantId'][-12:] for row in side_rows] == [f'{n:012}' for n in [2,1,4,3]]
assert all(row['status']=='unpaid' for row in side_rows)
assert sum(row['amountMinor'] for pool in q_pools for row in pool['rows']) == 17000
assert sum(row['amountMinor'] for row in side_rows) == 16000
assert 81000 - 5000 == 43000 + 17000 + 16000
assert facts['expenseTotalMinor'] == 4800 + 200, 'Sanctioning coverage exactly once'
regular = workspace['draft']['awards']
assert [row['totalAwardMinor'] for row in regular] == [15500,11500,8000,8000]
assert regular[2]['bandStart'] == regular[3]['bandStart'] == 3
assert regular[2]['bandEnd'] == regular[3]['bandEnd'] == 4
assert sum(row['totalAwardMinor'] for row in regular) == 43000
assert json.loads((root/'cleanup.json').read_text(encoding='utf-8'))['verifiedAbsentByIdAndName'] is True
report={'passed':True,'oracle':'Python Fraction/integer arithmetic; no app imports',
        'customQ':graduated(16,7,1000),'customSide':graduated(16,5,1000),
        'receiptsMinor':81000,'costsMinor':5000,'regularFundMinor':43000,
        'qFundMinor':17000,'sideFundMinor':16000,'unpaidAwardsMinor':76000,
        'refunds':0,'actualMoneyMoved':False,'providerVerified':False}
(root/'independent-numeric-check.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report))
