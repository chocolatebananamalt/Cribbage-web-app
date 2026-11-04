# Q Pool membership implementation plan and acceptance matrix - 2026-10-26

Local proposal only;no implementation,migration,hostedwrites,paymentoperationorpublication authorized by this document. Independent Sol source review confirms gap;focused21/21independently passed. No new testcount claimed for the matrix below.

## Confirmed contract and review corrections

Main/Consolation allow0-2configuredslots,immutable type/fee setup versions;SidePools are separate0-6operational pools. Event qualification ranking is distinct from playoff finish(requirements77-78). Existing manual QPool awards are qualifier-scoped and configured-slot-scoped,not verified purchases. 0190 explicitly reports qPoolCalculation=false,payoutCalculation=false. The 0165 team contribution q_pool label has no slot/config FK and no operational writer beyond0195copying;it does not fill the gap. 0232CSVqPoolPayments loses per-playerpoolallocation into roster-wide totals/receipt;requesthash cannot reconstruct elections. 0145 manualreconciliation uses tournament-widecash snapshots,notsegregatedQfunds. Do not suggest merely connecting a checkbox toexistingautomaticcalculator:thatcalculator is not authoritativeQpayout.

Evidence:0051:89-102;0232:228-234,275-304,387-393,420-442;0133:192-196;0145:180-215;0190:151;currentParticipants/settlementUI;docs/quality/2026-09-10-acc-mrp-payout-source-inventory.md. Sourceinventory explicitly leaves QPool/tie/roundingfixtures missing. HistoricalMRPapproval doesnotextendtopayouts. No current authoritativefinancialpolicy is invented here.

## Bounded phases

A. Explicit membership foundation first. Add private canonical QPool enrollment/correction record and director/co-directorUI per event,configuredslot and roster/participant. Bind membership to the exact activated Q Pool version. Current amendments create new version-row IDs: never backfill cross-version identity from slot number. A future logical pool identity must be forward-only or explicitly confirmed. Append-only versions(state elected/declined/withdrawn/corrected as approved),actor,reason,time,expectedversion,operationreceipt/audit,supersedes reference. Service-onlyRPCs and serverderivedactor;no browserdirecttablewrite. Existence, scope and current-event checks; decide roster-plus-event versus enrolled-participant subject before imposing an enrollment guard. 0232 accepts Q Pool payment input without same-row event enrollment. serializedevent/pool+entrant locking,exactrequest replay/conflict behavior. Signed-inplayer-view can be read-only initially;no selfservice enrollment until separatelydefined. No autocharge,receiptcreationorrefund. UI clearly shows elected state separatefrompaidstatus.

B. Collection allocation boundary. Link pool-specific amounts to existing manualpayment/obligation versions via an explicit versioned allocation ledger. Preserve cumulative receipt/void model. A25obligation must be explicit20base+5approvedelection with a reviewable fee breakdown;it doesnot become paid merely by electing. Allocate atmostcurrentvalidreceivedamount,handle partialamounts onlyunderapprovedpriority,neverdoublecountbase/side/Q. Voiding receipt supersedes/requiresreconciliation of allocation;membershiphistory unchanged. Preserve existingfinanceaudits;no directmoneyexecution.

C. Integrate supported CSV using same canonical membership operation and exactidempotencyenvelope. Existing legacyqPoolPayments stays explicitlypayment/auditevidence forcompatibility;new explicit CSVselection/versionfield orreviewstep suppliesmembership. No historic backfill from nonzero dollars. Migration adds empty ledgers and a legacy-unknown state only in the additive read model; never rewrite old receipts or fabricate allocation. Match currentroster identity safely(no newguessedACCvalues). Importpreview says elected versus moneyrecorded;transactionalallornothing;avoidnestedreceiptconflicts.

D. Membership-bound private payout preview after finalqualification/crosscheck. Snapshot event+poolconfigversion,currentelectors+collectionallocations+withdrawals,andqualificationversion. Revieweligibility/fundbasis;blockedwith reasons ifunknown/unreconciled/missingpolicy. Reuse ranking primitiveswithout rewritingplayofffinish. Formula module only afterdatedapprovedfixtures forEqual/top-double/graduated,tiecutoff,rounding andexceptionpolicies. Pureintegercents,explicitremainder/manualadjustmentreason,perpoolconservation. Manualsettlementclaims remain labeledmanual;new automaticpreviewmustnot silentlyfinalizeorpay.

E. Reviewed settlement integration. New draftcontract/migration version with explicit poolfund/membershipsnapshotID and authority flags. Validate awardedparticipantsactuallyeligibleelectedmembersand notduplicate,bind currentapproved policy andqualification snapshot,staleversionreject,distinctreviewifrequired. Keep existing manual finalizedrecordsimmutable/readable;no retroactive reinterpretationorrecalculation. Use additive compatibility appfirst,featureavailability preflight,newfunctionversion beforeclientswitch,oldnewreadercontractfixtures,thenstage-onlymigrationafterseparateapproval.

Scope stop:membership+readworkspace may be implemented independently once cutoff/correctioncontract agreed;automaticdistribution staysdisableduntil payoutsourcefixtures approved. No speculative broaderfinancialrewrite.

## Three decision bundles needed before policy-dependent work

1. Entry window and correction authority:when can players join/leaveeachQPool(beforefirstdeal,eventStart,registrationclose,other)? Must Q Pool entry require event enrollment, or can it be recorded against roster plus event before enrollment? What reasoned official corrections are allowed after that point? Does withdrawingmeanretainentry,removeeligibilityorrefunddue? Recordrefundentitlement separatelyfromactualmoney;do not execute refunds. Repository doesnotestablish these Q-specificrules.
2. Eligibility and fund allocation:must entry befullypaidbycutoff,or mayapprovedunpaid/partiallypaidplayersremaineligible? How are cumulativecashreceived allocatedamongbasefee,Qslot1,Qslot2,SidePools? Are funds grossentrycontributions or netapproveddeductions? Do allqualifyingelectedmembersshare,andwhat happensifnonequalify? Keepqualificationrankdistinctfromplayoffwinner;requestconfirmedrule/source ratherthanguess.
3. Authoritative payout schedule:provide/identify approvedcurrentQPoolrules or approve datedexamples forEqual,topqualifierdoubleandgraduatedvariants,includingtiedtopqualifier,tiesatqualifier/payoutcutoff,smallpools,roundingunitandremainder/distributedretainedbalance. Two-slotindependenceanddifferentfeesareexistingconfigcapability;exactformula isnot established. SidePoolnearest5estimate/sampleeventpayoutPDFisnot automaticallyaQrule. Retrieve authoritativeavailable sources beforeaskingownertoretypeknownrules.

These can be answered together;no userquestion has been issued by executor in this planningturn.

## Reusable local acceptance matrix

IDs below definefuturefixture obligations,notexecutedtests. Policy-dependent expected values must stay BLOCKED untildecision/sourcefixturefilled;never use thisplanasanofficialoracle.

| ID | Case | Required observable result |
|---|---|---|
| Q01 | 0,1,2slots;Main/Consy;unsupportedevent | Exactconfiguredscope;rejectwrongslot/event |
| Q02 | ExplicitAoptin,Bdecline withsamefee | Only A is elected/member candidate; payout eligibility stays blocked pending approved paid-status/cutoff policy; neither autocharged/paid |
| Q03 | PaidbasefeewithoutQelection | No inferredmembership |
| Q04 | Two slotsdifferentfees | Independentstate/allocation;no cross-slotleak |
| Q05 | Wrongrole/wrongtournament/removedrole | Reject;noelection/payment/auditsuccess |
| Q06 | Sameoperationreplay;changedpayloadsamekey | Sameversion/receipt;conflictwithoutduplicates |
| Q07 | Concurrentoptin/correctionexpectedversion | Onecommit,stale/conflictother;completeaudit |
| Q08 | Join/leave exactcutoff and afterstart | Equality/boundary perapprovedpolicy;no silentlateentry |
| Q09 | Withdraw/disqualify/correction/refunddue | Versionedreasonedstate;nomoneyexecution;policygate |
| Q10 | Partialreceipt/void/cumulative replacement | Allocationconservesvalidcash;unpaidnotautoeligible |
| Q11 | LegacyCSVpositiveQdollars | Legacyunknown,nobackfilledelection |
| Q12 | NewCSVexplicitselection/repeatedimport | Samecanonicaloperation,atomicretry,exactcounts |
| Q13 | Eventreplacement/poolamendment | Stableversionedscope;historicalentriesunchanged |
| Q14 | Qualifyingmember/nonmember/nonqualifier | Approvedqualificationeligibility;no playoffrankmixup |
| Q15 | Equal/top-double/graduated fixtures | Exactdatedapprovedexpectedawards;blockeduntiloracle |
| Q16 | Tiedtop/cutoff;0/1eligiblemember;smallfund | Deterministicapprovedtie/edgepolicy,notassumed |
| Q17 | Nondivisiblecents/nearestunit/remainder | Perpoolintegerconservation;reasonedadjustment |
| Q18 | Changedstandings/election afterdraft | Stalesnapshotblocked;newversion/audit,pastimmutable |
| Q19 | Refresh/back/cancel/interruptedsubmit | Retainexactrequestuntilresolved;no duplicates |
| Q20 | Mobile/desktop/keyboard/multi-official | Clearselected/paid/blockedstates;serverauthorization |
| Q21 | Claims/finalreports/PDF/CSV | Sameimmutablefund/snapshottotals;noactualtransfer |
| Q22 | Existinghistoricalmanualfinalization | Readableunchanged;no inventedmembershiporaward |

Verification sequence:unitcontracts/purefixtureformula;actualisolatedSQLconcurrency/rollback;fullpnpmverify;independentSolreview;desktop/phone syntheticbrowser;stage-onlyreviewedmigration thenrealhostedfictionalflowwithroles;finalsourcecheck. Fullsettlement andOCRremainseparateacceptancegates. No productionorpaidprovidertest.

Independent Sol plan review: GO after incorporating three P2 clarifications above (subject timing, exact config-version identity, elected versus payout-eligible wording). No P1 issue. All four requested clarifications including additive legacy-unknown handling are incorporated; no implementation/hosted action.
