"""Independent source-script recomputation, not a fresh database query or live play.
The frozen helper asserts SQL scorecard totals against its raw expected rows;
this oracle independently derives those rows and checks captured actual pairs.
"""
from pathlib import Path
from collections import Counter
import json
import sys

run=Path(sys.argv[1])
result=json.loads((run/'result.json').read_text())
start=json.loads((run/'normal-start.json').read_text())
finish=json.loads((run/'qualifying-finish.json').read_text())
scope=json.loads((run/'scope.json').read_text())
assert scope['participants']==18 and scope['digital']==6 and scope['paper']==12
people=start['capture']['participants']
by_seat={p['tournamentPlayerId']:p for p in people}
seat=lambda n:chr(65+(n-1)//4)+'-'+str((n-1)%4+1)
ring=list(range(1,19))
initial={}
for board in range(9):
    initial[ring[board]]=2*board+1
    initial[ring[17-board]]=2*board+2
rows={p['participantId']:dict(participantId=p['participantId'],tournamentPlayerId=p['tournamentPlayerId'],
    recordedGames=0,wins=0,gamePoints=0,positiveSpreadPoints=0,negativeSpreadPoints=0,netSpreadPoints=0) for p in people}
margins=[1,30,31,60,61,90,91,121]
pairs=[]
counts=Counter()
for round_number in range(12):
    for board in range(9):
        index=round_number*9+board
        a=by_seat[seat(initial[ring[board]])]
        b=by_seat[seat(initial[ring[17-board]])]
        pairs.append((a['participantId'],b['participantId']))
        pairing='DD'if a['mode']==b['mode']=='digital'else'PP'if a['mode']==b['mode']=='paper'else'PD'
        counts[pairing]+=1
        winner=a if index in [11,13,15]or index%2==0 else b
        loser=b if winner is a else a
        margin=margins[index%len(margins)]
        for p in [a,b]:rows[p['participantId']]['recordedGames']+=1
        w,l=rows[winner['participantId']],rows[loser['participantId']]
        w['wins']+=1
        w['gamePoints']+=3 if margin>30 else 2
        w['positiveSpreadPoints']+=margin
        l['negativeSpreadPoints']+=margin
    ring=[ring[0],ring[-1]]+ring[1:-1]
for r in rows.values():r['netSpreadPoints']=r['positiveSpreadPoints']-r['negativeSpreadPoints']
assert len(set(pairs))==108
actual_pairs={(g['sideAId'],g['sideBId'])for g in finish['capture']['games']}
assert set(pairs)==actual_pairs
assert all(r['recordedGames']==12 for r in rows.values())
assert result['scoring']['pairCounts']==dict(counts)
numeric_rows=[{k:v for k,v in row.items()if k!='tournamentPlayerId'}for row in rows.values()]
assert sorted(numeric_rows,key=lambda r:r['participantId'])==sorted(result['scoring']['expectedRawStandings'],key=lambda r:r['participantId'])
assert {p['participantId']:p['tournamentPlayerId']for p in people}=={p['participantId']:p['tournamentPlayerId']for p in finish['capture']['participants']}
assert sum(r['gamePoints']for r in rows.values())==result['scoring']['gamePoints']==296
assert sum(r['positiveSpreadPoints']for r in rows.values())==result['scoring']['positiveSpreadPoints']==6427
assert sum(r['negativeSpreadPoints']for r in rows.values())==result['scoring']['negativeSpreadPoints']==6427
assert result['scoring']['verified']==108 and result['scoring']['scorelines']==216
assert result['scoring']['falseClaims']==0
assert start['proof']['normalStartReceiptVerified']and start['proof']['exactReplay']
assert finish['proof']['fixedTournamentIdsRetained']and finish['proof']['distinctNonselfReview']
assert result['simulatedIncomingMinor']==88000
assert [result[k]for k in ['regularAwardsMinor','qAwardsMinor','sideAwardsMinor','expensesMinor','restrictedBalanceMinor']]==[48500,16000,18000,5400,100]
assert sum(result[k]for k in ['regularAwardsMinor','qAwardsMinor','sideAwardsMinor','expensesMinor','restrictedBalanceMinor'])==88000
assert result['status']=='unpaid'and not result['actualMoneyReceived']and not result['moneyMoved']and not result['actualHumanSessions']
proof=dict(passed=True,appCalculationImports=False,sourceScriptRecomputed=True,actualCapturedPairSetMatched=True,
    sqlScorecardTotalsAssertedByFrozenHelper=True,rawDatabaseOutcomesIndependentlyCaptured=False,
    participants=18,matches=108,scorelines=216,pairCounts=dict(counts),gamePoints=296,
    positiveSpreadPoints=6427,negativeSpreadPoints=6427,simulatedIncomingMinor=88000,
    unpaidAwardsMinor=82500,expensesMinor=5400,restrictedBalanceMinor=100,
    sportingTiesResolvedByThisOracle=False,actualHumanSessions=False,moneyMoved=False,hostedChanges=False)
(run/'independent-source-oracle.json').write_text(json.dumps(proof,indent=2))
print(json.dumps(proof))
