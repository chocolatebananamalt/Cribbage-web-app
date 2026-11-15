"""Independent integer reconciliation of exported local synthetic SQL evidence.
No app calculation helper, database connection, credentials or money movement.
"""
import hashlib,json,sys
from pathlib import Path
run=Path(sys.argv[1]).resolve()
source=json.loads((run/'fresh-fund-review-source-after.json').read_text(encoding='utf-8-sig'))
receipt=json.loads((run/'fresh-fund-review-winning-receipt.json').read_text(encoding='utf-8-sig'))
request=receipt['request'];outcome=receipt['outcome'];scope={k:source[k] for k in ('actorId','tournamentId','eventId')}
assert all(receipt[k]==v and outcome[k]==v for k,v in scope.items())
assert outcome['request']==request and outcome['status']=='accepted'
entry=benefit=operating=0;physical=set();expenses={}
for row in source['recipientSource']['nativeFinanceSource']['raw']['allocation']['eventSources']:
 assert row['sourceId']==row['physicalEvidenceId'] and row['sourceId'] not in physical and row['state']=='active'
 physical.add(row['sourceId']);expense_total=0
 for part in row['allocations']:
  assert part['eventId']==scope['eventId'] and part['poolId'] is None and part['classificationReviewed'] is True
  amount=part['amountMinor'];assert type(amount) is int and amount>=0
  if row['kind']=='entry_receipt' and part['bucket']=='regular_entry':entry+=amount
  elif row['kind']=='expense' and part['bucket']=='player_benefit':benefit+=amount;expense_total+=amount
  elif row['kind']=='expense' and part['bucket']=='operating_expense':operating+=amount;expense_total+=amount
  else:raise AssertionError('unexpected source classification')
 if row['kind']=='expense':expenses[row['sourceId']]=expense_total
heads={};record_ids=set()
for row in source['income']['records']:
 assert row['physicalEvidenceId'] not in physical and row['recordId'] not in record_ids
 prior=heads.get(row['incomeId']);assert row['priorRecordId']==(prior['recordId'] if prior else None)
 record_ids.add(row['recordId']);heads[row['incomeId']]=row
income=sum(row['amountMinor'] for row in heads.values() if not row['voided'])
fund=entry-benefit-operating+income
assert (entry,benefit+operating,income,fund)==(54000,6400,500,48100)
assert source['totals']=={'regularEntryMinor':entry,'benefitExpenseMinor':benefit,'operatingExpenseMinor':operating,'unrestrictedIncomeMinor':income,'recordedFundMinor':fund}
fee=source['sanctioning'];assert fee['rateMinor']*fee['eligibleParticipantCount']==fee['totalMinor']==5400
chosen=request['sanctioningExpenseEventId'];assert expenses[chosen]>=fee['totalMinor']
assert sum(c['expenseSourceId']==chosen for c in fee['candidates'])==1
review=source['latestReview'];assert review['reviewId']==outcome['reviewId'] and review['version']==outcome['version']==request['expectedVersion']+1
for k in ('proposalRevisionId','nativeAllocationRevisionId','incomeHeadVersion','incomeHeadDigest','sanctioningExpenseEventId'):assert review[k]==request[k]
assert review['recipientSourceDigest']==source['recipientSource']['sourceDigest'] and review['sanctioningAllocatedMinor']==expenses[chosen]
assert review['sourceDigest']==outcome['sourceDigest'] and review['sanctioningSnapshotId']==fee['snapshotId']
collisions=json.loads((run/'fresh-fund-review-cross-event-collisions.json').read_text(encoding='utf-8-sig')) if (run/'fresh-fund-review-cross-event-collisions.json').is_file() else []
for case in collisions:
 assert case['globalCollision'] is True and case['oldEventScopedCollision'] is False
 assert case['source']['status']=='blocked' and case['write']['status']=='rejected' and case['final']['status']=='blocked'
for k in ('moneyMoved','payoutAuthorized','disbursementAuthorized','finalizationAuthorized','bankReceiptVerified'):assert outcome[k] is False
result={'passed':True,'kind':'independent-exported-SQL-semantic-reconciliation','entryMinor':entry,'allocatedCostMinor':benefit+operating,'incomeMinor':income,'fundMinor':fund,'sanctioningMinor':fee['totalMinor'],'sanctioningCountedOnce':True,'matchedReviewId':review['reviewId'],'crossEventCatalogPredicateCases':len(collisions),'negativeCorruptionFailsClosed':bool(collisions),'physicalGuardBranchTraversalProven':False,'actualProviderSessionVerified':False,'moneyMoved':False,'sourceSha256':hashlib.sha256((run/'fresh-fund-review-source-after.json').read_bytes()).hexdigest()}
(run/'root-fresh-fund-review-reconciliation.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result))
