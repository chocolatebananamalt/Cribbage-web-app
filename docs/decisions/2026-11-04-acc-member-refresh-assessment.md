# ACC member refresh — source assessment and safe integration proposal

READ-ONLY DESIGN. No scraping, member/tournamentrecord read, networkintegration or appcodechange.

## Existing support
src/lib/acc-number.ts normalizesuppercase/removesspaces, validates twoletters+digits+optionalyouthY, and treats empty string as validoptionalACCnumber. Its accIdentityKey removesyouthsuffix foridentitycomparison; formatting/identitynormalization are not membershipverification. src/lib/api/public-registration-v2.ts accepts optionalACCnumber via isOptionalAccNumber. Registration/manualroster/check-in passenteredvalues to protected existingRPCs. Seatingdirectorysearchesexistingroster names/ACCnumbers, not a nationaldirectory. No ACCdirectory import, remote lookup, source freshness snapshot or member-refresh service was found in src/database search. Do not falselyrequire membership merelybecause number is missing.

## Candidate source / unknowns
Parentresearch located publicactive-member lastnamelookup https://www.cribbage.org/internet/registration_lookup_player.php ; no completebulkroster yetestablished. This executor didnotquery it orindependentlyverify freshness/access/terms/completeness. A lastnamesearch isnot necessarily a supportedfullrosterfeed. Missingresult neverprovesnonmembership. Grassrootsgueststatus andits sessionrules are distinctfromACCmembership andneed a separatelyverifiedpolicy; nonmemberparticipation mustnotbeblockedbydirectoryavailability.

## Safe phased plan
1. Finishparentresearch: authoritativeprovider/contact, supportedAPI/export/lookupworkflow, permitteduse/accesslimits, scope(activeonly/allmembers), fields, effective/as-ofdate, refreshcadence andretention/privacy. No live scraping until a supportedsourceisapproved.
2. Versionedminimumdirectorysnapshot orboundedlookupresults storesstableACCmemberID, source/provenance/asOf/fetchedAt/status; avoidunnecessarypersonaldata. Keepcachedsource separatefromtournamentrosters andauthenticatedprofiles. A tournamentopeningcheck may refresh anapprovedstalesnapshot; defineexacttrigger (registrationopening vsdeskopening) beforeimplementation, throttle/coalesce duplicatecalls, retainlastknownsnapshotonerror. Nevertreatfetchsuccessasfreshsourceas-ofdate.
3. Directorbutton **Refresh member lookup** can query supportedsourcefor a registration lackinganumber. Displaycandidate(s), stableID,matchbasis/sourceas-of; requireexplicitreviewbeforea protectedauditedrosterupdate. Do not autoattachaccount/credentials oroverwriteuseridentity. Namealone isnot anidentitykey; duplicate/commonnamesmustremainambiguous. ExistingaccIdentityKey/youthsuffixrulesandcurrentconflictguards remainintact.
4. Showstatuses **Found**, **Multiple matches — review**, **Not found in this source**, **Source unavailable**, **Last checked [time]/source as of [date]**. BlankACCnumber remainsallowedwherecurrentrulesallow; distinguishdeclarednonmember fromunknownnumber/unverifiedlookup. Memberstatus mustnot silentlychangeGrassrootsguestcounts,eligibility,fees,dues orMRPapproval.
5. Testpositive/negative/ambiguous/duplicatename,youthsuffix,stale/offline/unavailable/partialsource,concurrentrefresh,repeatclick,consent/privacy,actorpermissions,conflict-safeupdateandnonmemberregistrationcontinuity. No lookupresultalonegrantsroleorapprovedMRPs. PresentexactlocalUI/API/migration/provider scopebeforepublication orhosteduse.

Currentblocker is SOURCE/VERIFICATION: approvedcompletefeed/lookupcontract,freshnessandmatchingrules are notyetverified. User’s desiredrefresh is recorded, not claimedimplemented.

## Owner and research clarifications (later2026-11-04)

Owner agrees directory data is a WARNING/LOOKUP aid, not automaticrejection. Ordinaryregistration doesnotrequireanexistingACCnumber; directoradmissionpolicy isboundedbymandatoryrules. KeepGrassrootsguest/sessionrules distinctfromACCmembership. A missingmatch ornumber isunknown, notproofnonmembership. ConfirmednonmembersmustnotreceiveMRPs, whileunknownmembershiprequiresverification; preserveallgames/results andcalculatedperformance, separatetheeligibilitydecisionfromofficialaward/reporting. Timingandexceptionsmustbeverifiedbeforeofficialawards.

ParentPolicyManualresearch: Chapter6 I.E.13 specifiesGrandNational andJPW/ACCOpen Main/Consolation membership; VII.C.4 permitsnonmemberentrywithfeepurchasingmembership; VI.A.2active-membershipMRPrequirement. TOC hasseparatequalification. Noexistingnumberblanketrequirementforordinaryweekendtournamentsestablished. Attribute toparentresearch until exactsource/extract integrated; do not inventunlimitedTDdiscretion.

Candidateall-timeGrassRootsURL https://www.cribbage.org/grassroots/stats.asp?topt=Alltime&grpgroup=All ; parentcorrectedearliercoverageclaim: publicplayerguidep17 describesStats→All asallregisteredACCplayers https://cribbage.org/grassroots/docs/Help_Docs/Website_Player_Guide/GR_Website_Guide_Player.pdf . ExclusionofzeroGrassRootspointsplayers isNOTestablished. D/Eflagsreportedfordeceased/expiredneedsourcefreshness/identityreview; blank/missingcannotestablishcurrentstatus. Noassumptionsencodedinapp, nobulkscraping performed.

## Owner-approved correction control (later2026-11-04)

MRPs require ACTIVEACCmembership. Director maycorrectamistakenwebsite status onlyafterverification, withanexplicitreason,evidencereference,actor/time,auditandsupersessionhistory. Storewebsite-observedstatusandreviewedcorrectionseparately; do notoverwritefeed/historyorlabelthisofficialACCapproval. Unknownstatus remainsreviewpending, notdefinitivelyeligible/ineligible. Thisdoesnotchangegames/resultsorordinaryregistration. No suchcorrectioncontrolimplementedinthissetupassociationwork.
