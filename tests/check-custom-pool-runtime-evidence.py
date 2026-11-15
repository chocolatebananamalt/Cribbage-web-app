"""Independent integer/Fraction reconstruction of exported fictional Q evidence.

No app calculator imports, database, network, provider or money action.
"""
from pathlib import Path
from fractions import Fraction
import json, sys

r=Path(sys.argv[1]).resolve()
assert r.parent==Path('test-results').resolve()
x=json.loads((r/'q-q_review.json').read_text(encoding='utf-8'))
review=x['review'];source=review['source'];w=source['manifest']['operatingWorkspace']
policy=next(p for p in w['policies'] if p['method']=='q-custom-graduated-policy-v5')
pool=policy['poolVersionId'];ratio=policy['ratio'];contributors=[];fund=0
for entry in w['membership']['entries']:
    choice=next(p for p in entry['pools'] if p['poolVersionId']==pool)
    if choice['elected']:
        assert entry['allocationCurrent'] and choice['prePlayElected'] and choice['paidEntryEligible']
        assert choice['amountAllocatedMinor']==choice['amountOwedMinor']
        assert choice['consentReference'].startswith('Q policy '+policy['id']+':')
        contributors.append(entry['participantId']);fund+=choice['amountAllocatedMinor']
assert len(contributors)==len(set(contributors))==16 and fund==16000 and ratio==7
cards=sorted((c for c in w['cards'] if c['participantId'] in contributors),key=lambda c:(-c['gamePoints'],-c['gamesWon'],-c['plusPoints']))
count=(len(contributors)+ratio-1)//ratio
assert count==3
# Approved linear graduated weights, exact $5 units, largest remainder with
# higher finishing rank as tie priority. Independent of the application code.
weights=list(range(count,0,-1));units=fund//500
raw=[Fraction(units*v,sum(weights)) for v in weights];awards=[v.numerator//v.denominator for v in raw]
remaining=units-sum(awards)
for i in sorted(range(count),key=lambda i:(-(raw[i]-awards[i]),i))[:remaining]:awards[i]+=1
awards=[v*500 for v in awards]
obligation=next(o for o in source['obligations'] if o['poolVersionId']==pool)
assert obligation['kind']=='award' and obligation['status']=='unpaid' and obligation['fundMinor']==fund
assert [v['amountMinor'] for v in obligation['rows']]==awards==[8000,5500,2500]
assert [v['participantId'] for v in obligation['rows']]==[v['participantId'] for v in cards[:count]]
assert sum(awards)==fund and all(a>0 and a%500==0 for a in awards)
other=[o for o in source['obligations'] if o['poolVersionId']!=pool]
assert len(other)==1 and other[0]['kind']=='award' and other[0]['fundMinor']==1000
assert other[0]['rows'][0]['participantId']=='f2430000-0000-4000-8000-000000000001'
assert all(o['kind']=='award' for o in source['obligations'])
assert source['manifest']['refundPolicy']=='no-pool-refunds-v1'
assert sum(v['amountMinor'] for v in other[0]['rows'])==1000
assert review['result']['status']=='q_obligations_recorded_v2' and review['current']['current'] is True
result={'passed':True,'kind':'independent-exported-custom-q-review-reconstruction','paidContributors':16,'ratio':ratio,'customFundMinor':fund,'customAwardMinor':awards,'exactRecipientRank':True,'equalQAwardMinor':1000,'noPoolRefunds':True,'v6FinalVerified':False,'providerVerified':False,'moneyMoved':False}
if (r/'sql-result.json').exists():
    final=json.loads((r/'sql-result.json').read_text(encoding='utf-8'))['qAccounting']
    facts=final['finalized']['workspace']['facts']
    assert facts['baseIncomeMinor']==48000 and facts['qIncomeMinor']==17000
    assert facts['receiptTotalMinor']==65000 and facts['expenseTotalMinor']==20500 and facts['regularAwardMinor']==27500
    assert facts['receiptTotalMinor']-facts['expenseTotalMinor']==facts['regularAwardMinor']+17000==44500
    assert final['final']['status']=='q_accounting_finalized_unpaid_v6'
    assert final['finalized']['workspace']['finalization']['status']=='unpaid'
    assert final['moneyMoved'] is False and final['providerVerified'] is False
    result.update(v6FinalVerified=True,receiptMinor=65000,expenseMinor=20500,regularAwardMinor=27500,totalUnpaidLiabilityMinor=44500)
(r/'root-custom-q-evidence-check.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result))
