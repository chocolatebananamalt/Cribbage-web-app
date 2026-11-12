# Setup navigation and wording — LOCAL, unpublished

## Completed safe UI slice
Date helperexact (Includes the start day.); removed11:59sentence, unchanged date behavior. RemovedonlysetupheaderQ-Poolpolicy/payoutpreviewlink; underlyingprotectedpage/client/APIs unchanged. TournamentEvents capitalization; shared AddMain/Consolation/Satelliteactionsbesideheading ondesktop andwrappedonphone; relevantactionsrepeatedbelowconfiguredsections. AffectedQ-Poollabels hyphenated. Existingdraftrows, fields, pools, recovery, serverpayloads andeligibility untouched. Header/footer/handler now consistentlyblock editswhiledeclarationsarebeingchecked. No neweventcardinalityrule was introduced; existingunsupportedmultiMainconstraintsremain a separatebackendgap.

## Files
src/components/tournament-date-fields.tsx; setup/page.tsx; setup/setup-client.tsx; newsetup/setup-event-actions.css; tests/setup-workspace-ui.test.mjs; tests/setup-event-navigation-browser.mjs; existingq-setup-prize/setup-fee-persistence/setup-event-declaration-readiness browserlabels/locators updated.

## Verification
BundledNode24.19.0,pnpm11.19.0,Next16.4.2. Fullpnpmverify-finalexit0: productionaudit0knownvulnerabilities, lint0errors/64existingwarnings,1232applicationtests,providerchecks,TypeScript/productionbuild,workspace8. Privatehandoff6pass. Focused13pass. Eightnewactualcomponentmockedbrowsergroups320/390/768/1440 × Main-only/existingConsolation: header/footeractions, newConsolationQ-Pool/Sideeditors, retainedexistingMain/Consolationvalues,zeroPOST, declaration-checklocks, actualdoubledheading/buttontext andnohorizontalpageoverflow. Focusedphone/desktopscreenshotsvisuallyinspected, desktopcontrolsactuallybesideheading. Existingfee/save/retry/readbackbrowser36scenarios/72observationspassed,localhostcleanupverified; declarationbrowser6groupspassed. Existing Q-Pool/base-payout browser smoke passed at390/1440px. Its obsolete expense-preview fixture was corrected to supply the already-required player-benefit amount and assert current text; no payout code changed.

IndependentSolreviewcaughtP2header-versusfooterchecklock; fixedheaderandaddhandlerandaddedconcurrentheld-readbrowserproof. Re-reviewPASS,noP1/P2. gitdiff--checkPASS. Nohostedrecordsread/written,migration,roles/credentials,payments ordeployment. Onlyfictional/localmocks used; nofreshhostedfixturefingerprintsclaimed.

## Explicit incomplete dependency
MainYes/No + associatedConsolation editor is NOTimplemented: currentSetupEventhasnopersistentparentMainlink; legacy0191saveforbids>1Main/Consolation;0112activation/0278ConsolationeligibilityinferssoleMain. AcheckboxalonewouldmisrepresentmultipleMainassociation/eligibility. Noeventwasdeleted,hiddenorreassigned. See docs/decisions/2026-11-04-explicit-main-consolation-links-plan.md forversionedstable-IDassociation/API/activation/eligibility/financialisolationplananddefinitionsscope. NoACCsingleMainlimitasserted; parentGN44researchdoesnotestablishuniversalrecordcardinality.

Definitionspage remains a proposal: currentreferenceindex+five-topicRulebookQuickReferencearenotafullglossary; needexactworkbookDefinitions/manual/projectsourcesforreviewbeforeaddingmeanings. Memberdirectoryrefreshalsoassessmentonly in docs/decisions/2026-11-04-acc-member-refresh-assessment.md; existingACCformatvalidationisnotnationalmemberlookup,missingnumberallowedandnotproofnonmembership.
