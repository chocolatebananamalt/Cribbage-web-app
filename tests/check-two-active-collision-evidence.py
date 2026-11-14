"""Independent exported-evidence verification; no provider or database access."""
import hashlib,json,sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]
run=Path(sys.argv[1]).resolve()
assert run.parent==root/'test-results'
load=lambda name:json.loads((run/name).read_text(encoding='utf-8-sig'))
result=load('two-active-event-physical-collision-result.json')
assert result['passed'] is True and result['physicalGuardBranchTraversalProven'] is True
assert result['collisionScope']=='two-active-configured-ledger-sources-B-zero-enrollment'
assert result['activeConfiguredEvents']==2 and result['bEnrollmentCount']==0
assert result['bPlayoffCompletenessClaimed'] is False
before=load('two-active-ordinary-sources.json');after=load('two-active-ordinary-sources-after.json')
assert before['rawA']==after['rawA'] and before['rawB']==after['rawB']
assert before['bindingRows']==after['bindingRows'] and len(before['bindingRows'])==2
assert len({row['bindingId'] for row in before['bindingRows']})==2
assert {row['eventKind'] for row in before['bindingRows']}=={'main','consolation'}
assert all(row['state']=='active' for row in before['bindingRows'])
assert before['scope']['eventId']!=before['scopeB']['eventId']
assert before['scope']['actorId']==before['scopeB']['actorId']
assert before['scope']['tournamentId']==before['scopeB']['tournamentId']
for key,scope in (('rawA',before['scope']),('rawB',before['scopeB'])):
 raw=before[key]
 assert raw['status']=='source_available'
 for name in ('actorId','tournamentId','eventId'):assert raw[name]==scope[name]
assert before['rawB']['raw']['counts']['activeParticipants']==0
assert before['rawB']['raw']['counts']['paidEligibleEntries']==0
assert before['rawB']['raw']['qualification'] is None
assert before['bProposal']['status']=='accepted'
cases=load('two-active-event-direct-physical-collisions.json')
assert len(cases)==2 and len({case['physical'] for case in cases})==2
for case in cases:
 assert case['globalCollision'] is True and case['oldEventScopedCollision'] is False
 for key,status in (('source','blocked'),('write','rejected'),('final','blocked')):
  assert case[key]['status']==status and case[key]['code']=='physical_evidence_conflict'
source=load('fresh-fund-review-source-after.json');totals=source['totals']
assert totals['regularEntryMinor']-totals['benefitExpenseMinor']-totals['operatingExpenseMinor']+totals['unrestrictedIncomeMinor']==totals['recordedFundMinor']==48100
assert source['sanctioning']['totalMinor']==5400
assert load('two-active-event-baseline-final.json')=={'status':'blocked','code':'award_rank_order_invalid'}
checked=[]
for entry in load('trace.json'):
 if 'file' not in entry or 'sha256' not in entry:continue
 matches=list((root/'database').rglob(entry['file']));assert len(matches)==1
 digest=hashlib.sha256(matches[0].read_bytes()).hexdigest();assert digest==entry['sha256'].lower()
 checked.append({'file':matches[0].relative_to(root).as_posix(),'sha256':digest})
assert len(checked)==79
cleanup=load('cleanup.json')
assert cleanup['removed'] is True and cleanup['verifiedAbsentByIdAndName'] is True and cleanup['runnerExitCode']==0
assert result['providerSessionVerified'] is False and result['moneyMoved'] is False and result['payoutAuthorized'] is False
receipt={'passed':True,'scope':result['collisionScope'],'ordinaryActiveSources':2,'bEnrollment':0,'bCompletedPlayoffClaim':False,'exactCollisionCases':2,'exactBranchesPerCase':3,'sourcePinsRestored':True,'fundMinor':48100,'sanctioningCountedOnce':True,'installedSqlHashes':checked,'actualProviderSessionVerified':False,'hostedChanges':False,'moneyMoved':False}
(run/'root-two-active-collision-check.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
print(json.dumps({key:value for key,value in receipt.items() if key!='installedSqlHashes'}))
