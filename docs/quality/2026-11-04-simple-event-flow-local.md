# Simplified Main/Consolation flow — local verification

Status: local only, not published. No hosted migration is required for the empty-draft correction. The owner's open page and unsaved deletions have not been manipulated.

## Behavior
Main first. Yes creates its associated Consolation editor once, directly below the question. Unambiguous one-Main/one-Consolation historical drafts reuse their stable editor instead of duplicating it; ambiguous historical associations fail closed for review. Normal flow has no picker, Link or Unlink controls. No uses a native modal confirmation with Cancel/Escape, focus return and keyboard containment; confirmation removes only the named local draft children. Saving later records a new version and preserves earlier versions. Satellite follows the resolved Main/Consolation choice.

A genuinely changed empty event draft may be saved. Returning a freshly empty draft to its initial unchanged state correctly leaves Save disabled. Finalization still requires Main. Exact save retry and readback reconciliation remain mandatory.

## Executed evidence
- Six component tests cover immediate single creation, safe reuse, ambiguous preservation, cancellation, failed parent confirmation and historical multiple-child preservation.
- Fresh isolated browser checks at320,390,1440CSSpx and100%/200%text passed guided and legacy recovery paths. Recovery includes503, mismatched readback, identical retained request retry, then a changed empty save. Screenshot evidence is under test-results/setup-simple-guided and setup-simple-recovery.
- Actual isolated PostgreSQL schema through0292 passed authenticated Main/Consolation/Satellite save, empty save/readback, exact retries, old-revision preservation, outsider denial and empty-finalization denial. Receipt: test-results/empty-linked-setup-sql-result.json. Isolated container removal was verified. No hosted record was used.
- Visual inspection found the No dialog was hidden by an existing overly broad CSS ancestor selector. Narrowing to the direct-child finalization dialog preserves the original finalization layout while allowing the nested choice modal. Phone inspection verified the corrected modal; controls have44pxminimum targets.

## Required final gates
Independent review identified a pending-finalization editing gap; the shared edit/save lock now prevents edits and saves while finalization is unresolved, preserving the exact activation retry. Final pnpm verify passed:1272application tests,6provider checks,8workspace checks, production build, lint with0errors and dependency audit with no known vulnerabilities. Private handoff6tests passed. Logs: test-results/setup-simple-full-verify.log and setup-simple-handoff.log. Earlier failed lint/static-selector runs are retained and are not acceptance evidence. The dedicated recovered-activation browser passed320/390/1440, covering503 then unknown outcome, exact retained request, edit/No/save locks and malformed recovery; receipt test-results/setup-simple-activation/result.json. Independent final review found no remaining concrete P1/P2 in this bounded patch; the identified recovery gap is fixed. This is ready for publication review, not published.

## Safe morning handoff
The old open browser client will not acquire the new code without refreshing. Refreshing would discard the owner's unsaved deletions and load the saved draft. Do not advise refreshing or promise the old disabled button will become enabled until the owner chooses the explicit recovery/testing approach after publication approval. No remote deletion, rollback or replacement draft is authorized by this report.


Existing event-lock browser passed320/1440; existing declaration-readiness browser passed390/768/1440, stale/capability/formula race, exact pinned retry and200%text plus legacy/v2/unknown amendment guards. Its missing linked-capability mock was corrected to an explicit legacy404; the original503 prevented the fixture loading and was not a production regression. Final guided and recovery reruns after the shared lock both passed all three widths.

React quality check: no new network waterfalls or dependencies, no conditional hooks, stable IDs preserved, typed callbacks, native accessible modal, explicit errors/recovery, and local updates guarded from uncertain activation. This is testing and focused review, not accessibility certification. At320px with200%text the modal scrolls vertically.


## Verified local preservation
Selected source/evidence archive `../simple-event-flow-verified-20261104.zip`: 116326bytes, 27entries, SHA256`1df8e2bd05f378675e88b025abcaa8a4e87128cd636160fa3d108225ff446de8`. CRC and every entry hash were checked. This archive predates this descriptive paragraph; its frozen QA content and all17code/test files are intact. Manifest: `test-results/simple-event-flow-publication-manifest.json`. No hosted recovery, off-device copy or publication is implied.


## Subsequent approved publication
Parent relayed explicit userYes to test-only publication. Exact17-file patch published as ba2845a92a484ec66e360817709c5c6ed43aa296; bothCIruns passed and stablepreviewalias verifiedREADY. No migrations or mockwork included. See 2026-11-04-simple-event-flow-preview-rollout.md. Local-only statements above describe the prepublication milestone.
