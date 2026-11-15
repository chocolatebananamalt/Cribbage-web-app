"""Independent Fraction oracle. Does not import application code or rounding helpers."""
from fractions import Fraction
from pathlib import Path
from collections import Counter
import json

proof=json.loads(Path('test-results/workbook-satellite-comparison-local.json').read_text())
assert proof['liveSpreadsheetRecalculation'] is False
counts=Counter()
for row in proof['rows']:
    i,r=row['input'],row['result']
    n,e,ratio,f=i['entrantCount'],i['feeMinor'],i['ratio'],i['fundMinor']
    p=(n+ratio-1)//ratio
    code=None
    if i['rankingState']=='unresolved_ties': code='unresolved_ties'
    elif p==1: code='one_recipient_undefined'
    elif p>30: code='source_row_limit'
    else:
        tri=p*(p+1)//2
        b=Fraction(5*e,4)
        linear=Fraction(f,tri)>5000
        if not linear and f<b*p: code='fund_below_source_baseline'
        else:
            raw=([Fraction((p-rank+1)*f,tri) for rank in range(1,p+1)] if linear else
                 [b+(f-b*p)*Fraction(p-rank,p*(p-1)//2) for rank in range(1,p+1)])
            assert sum(raw)==f
            nearest=[int(a/Fraction(500)+Fraction(1,2))*500 for a in raw]
            if sum(nearest)>2**53-1 or max(nearest)>2**53-1: code='unsafe_result'
            else:
                m=r['sourceModel']
                assert m['recipientCount']==p and m['fundMinor']==f
                assert m['branch']==('descending_linear' if linear else 'entry_125pct_baseline')
                assert Fraction(int(m['baselineMinor']['numeratorMinor']),int(m['baselineMinor']['denominator']))==b
                assert [Fraction(int(x['numeratorMinor']),int(x['denominator'])) for x in m['rawAwards']]==raw
                assert m['reconstructedNearestAwardsMinor']==nearest
                assert m['reconstructedNearestDifferenceMinor']==sum(nearest)-f
                if f%500: code='fund_not_multiple_of_5'
                else:
                    floors=[int(a//500)*500 for a in raw]
                    missing=(f-sum(floors))//500
                    order=sorted(range(p),key=lambda j:(-(raw[j]-floors[j]),j))
                    awards=[a+500*(j in order[:missing]) for j,a in enumerate(floors)]
                    if min(awards)==0: code='zero_rounded_award_unresolved'
                    elif not linear and min(awards)<b: code='rounded_baseline_unresolved'
                    else:
                        assert r['status']=='comparison' and r['awardsMinor']==awards
                        assert sum(awards)==f and all(a>0 and a%500==0 for a in awards)
                        assert awards==sorted(awards,reverse=True)
    if code:
        assert r['status']=='blocked' and r['code']==code,(i,r,code)
        assert 'awardsMinor' not in r
        counts[code]+=1
    else: counts['comparison']+=1
    assert r['testOnly'] and not r['moneyMoved'] and not r['recipientSelectionPerformed'] and not r['operationalPolicyAdopted']
result=dict(passed=True,cases=len(proof['rows']),outcomes=dict(counts),appImports=False,
            liveSpreadsheetRecalculation=False,hostedChanges=False,operationalPolicyAdopted=False)
Path('test-results/workbook-satellite-comparison-independent.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result))
