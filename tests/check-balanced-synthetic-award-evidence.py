"""Independent integer/identity reconciliation of local synthetic exports only."""
import hashlib,json,sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]
run=Path(sys.argv[1]).resolve();assert run.parent==root/'test-results'
load=lambda name:json.loads((run/name).read_text(encoding='utf-8-sig'))
result=load('balanced-final-result.json');source=load('balanced-final-source.json')
stored=load('balanced-final-record.json');recon=load('balanced-final-reconciliation.json')
assert load('operational-finance-source-adoption-acceptance.json')['adoptionResult']['laterAliasSourceChangeNotRunAfterFinal'] is True
oracle=json.loads((root/'test-results/synthetic-balanced-final-award-oracle.json').read_text())
assert result['passed'] is True and source['status']=='source_available' and stored['status']=='recorded'
edit=load('balanced-final-normal-director-editor.json');old=edit['before'];new=edit['editor']
assert new['basis']==old['basis']
assert new['history'][:len(old['history'])]==old['history']
assert new['overrideHistory'][:len(old['overrideHistory'])]==old['overrideHistory']
assert new['overrideHistory'][-1]['voided'] is True
assert new['overrideHistory'][-1]['perPersonMinor']==7500
assert source['nativeRecipientSource']['proposal']['editor']==new
assert source['proposal']['revisionId']==load('balanced-final-proposal.json')['outcome']['revisionId']
for name in ('actorId','tournamentId','eventId'):
 assert source[name]==result['scope'][name]
 assert recon[name]==result['scope'][name]
assert stored['tournamentId']==source['tournamentId'] and stored['eventId']==source['eventId']
assert stored['sourceCapture']==source
for name in ('sourceDigest','recipientSourceDigest','fundSourceDigest'):assert stored[name]==source[name]
assert stored['proposalRevisionId']==source['proposal']['revisionId']
assert stored['fundReviewId']==source['income']['reviewId']
assert stored['qualificationResultVersionId']==source['proposal']['qualificationResultVersionId']
entries=benefits=operating=0;physical=set()
for row in source['nativeRecipientSource']['nativeFinanceSource']['raw']['allocation']['eventSources']:
 assert row['physicalEvidenceId'] not in physical;physical.add(row['physicalEvidenceId'])
 assert row['sourceId']==row['physicalEvidenceId'] and row['state']=='active'
 for part in row['allocations']:
  assert part['eventId']==source['eventId'] and part['poolId'] is None and part['classificationReviewed'] is True
  n=part['amountMinor'];assert type(n) is int and n>=0
  if row['kind']=='entry_receipt' and part['bucket']=='regular_entry':entries+=n
  elif row['kind']=='expense' and part['bucket']=='player_benefit':benefits+=n
  elif row['kind']=='expense' and part['bucket']=='operating_expense':operating+=n
  else:raise AssertionError('unexpected source classification')
heads={};records=source['income']['records'];assert len(records)==2
for row in records:
 assert row['physicalEvidenceId'] not in physical
 prior=heads.get(row['incomeId'])
 assert row['priorRecordId']==(prior['recordId'] if prior else None)
 if prior:
  assert row['physicalEvidenceId']==prior['physicalEvidenceId']
  assert row['evidenceReference']==prior['evidenceReference']
 heads[row['incomeId']]=row
assert len(heads)==1 and [r['amountMinor'] for r in records]==[500,400]
income=sum(row['amountMinor'] for row in heads.values() if not row['voided'])
fund=entries-benefits-operating+income
assert (entries,benefits+operating,income,fund)==(54000,6400,400,48000)
assert source['fund']['regularEntryIncomeMinor']==entries
assert source['fund']['benefitExpenseMinor']==benefits and source['fund']['operatingExpenseMinor']==operating
assert source['fund']['unrestrictedIncomeMinor']==income and source['fund']['awardFundMinor']==fund
assert source['sanctioning']['totalMinor']==5400 and source['fund']['bankReceiptVerified'] is False
groups=stored['groups'];assert groups==source['projection']['groups']
assert [{k:g[k] for k in ('firstPlace','lastPlace','people','perPersonMinor','groupTotalMinor')} for g in groups]==oracle['groups']
assert all(g['included'] is True and g['perPersonMinor']%500==0 and g['groupTotalMinor']==g['people']*g['perPersonMinor'] for g in groups)
assert sum(g['groupTotalMinor'] for g in groups)==fund
assert all(a['perPersonMinor']>=b['perPersonMinor'] for a,b in zip(groups,groups[1:]))
recipients=stored['recipients'];assert len(recipients)==stored['recipientCount']==5
sort_key=lambda r:(r['firstPlace'],r['participantId'])
assert sorted(recipients,key=sort_key)==sorted(source['projection']['recipients'],key=sort_key)
assert len({r['participantId'] for r in recipients})==len({r['profileId'] for r in recipients})==5
assert sum(r['amountMinor'] for r in recipients)==stored['totalMinor']==fund
playoff=source['nativeRecipientSource']['playoff'];assert playoff['qualifierCount']==5
players={p['participantId']:p for p in playoff['players']};matches={m['slot']:m for m in playoff['matches']}
assert set(matches)=={1,2,3,4}
expected_places={matches[4]['result']['winnerId']:(1,1),matches[4]['result']['loserId']:(2,2),matches[2]['result']['loserId']:(3,4),matches[3]['result']['loserId']:(3,4),matches[1]['result']['loserId']:(5,5)}
assert len(expected_places)==5
for r in recipients:
 assert (r['firstPlace'],r['lastPlace'])==expected_places[r['participantId']]
 for name in ('profileId','displayName','tournamentPlayerId'):assert r[name]==players[r['participantId']][name]
 band=next(g for g in groups if (g['firstPlace'],g['lastPlace'])==(r['firstPlace'],r['lastPlace']))
 assert r['included'] is True and r['amountMinor']==band['perPersonMinor']
assert stored['awardStatus']=='recorded_unpaid' and stored['historicalReceipt'] is True and stored['currentSourceVerified'] is False
for name in ('moneyMoved','payoutAuthorized','disbursementAuthorized','finalizationAuthorized'):assert stored[name] is False
assert recon['outcome']['awardSetId']==stored['awardSetId']
assert recon['request']['expectedSourceDigest']==source['sourceDigest']
assert recon['request']['expectedFundReviewId']==stored['fundReviewId']
assert result['counts']=={'sets':1,'groups':4,'recipients':5}
sibling=load('balanced-final-sibling-unchanged.json');assert sibling['before']==sibling['after']
assert sibling['after']['state']=='active'
for name in ('participants','income','reviews','finals'):assert sibling['after'][name]==0
assert result['bEnrollmentCount']==0 and result['bFundedPlayoffClaimed'] is False
assert result['providerCookieIdentityProved'] is False and result['moneyMoved'] is False
checked=[]
for row in load('trace.json'):
 if 'file' not in row or 'sha256' not in row:continue
 matches=list((root/'database').rglob(row['file']));assert len(matches)==1
 digest=hashlib.sha256(matches[0].read_bytes()).hexdigest();assert digest==row['sha256'].lower();checked.append(row['file'])
assert len(checked)==79
cleanup=load('cleanup.json');assert cleanup['removed'] is True and cleanup['verifiedAbsentByIdAndName'] is True and cleanup['runnerExitCode']==0
proof={'passed':True,'kind':'independent-unpaid-synthetic-award-reconciliation','fundMinor':fund,'awardTotalMinor':sum(r['amountMinor'] for r in recipients),'recipientCount':5,'recipientIdentityAndFiveQualifierPlacementVerified':True,'equalBandAndFiveDollarIncrements':True,'incomeCorrectionHistory':[500,400],'sanctioningCountedOnceMinor':5400,'installedSqlFiles':len(checked),'bEnrollment':0,'bFundedPlayoffClaim':False,'actualProviderCookiesVerified':False,'bankReceiptVerified':False,'moneyMoved':False,'payoutAuthorized':False,'hostedChanges':False}
(run/'root-balanced-final-award-check.json').write_text(json.dumps(proof,indent=2)+'\n',encoding='utf-8')
print(json.dumps(proof))
