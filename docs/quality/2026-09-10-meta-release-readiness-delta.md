# Meta Release-Readiness Delta Review — 2026-09-10

## Review method

This is a fresh delta review against the normative production baseline,
current tracked source/migrations, current project status, pilot/disposable
database evidence recorded on 2026-09-10, and the hosted Vercel Preview
deployment. A build, static test, or prototype screen is not treated as proof
of an unimplemented multi-user, financial, or operational requirement.

## Corrections closed in this review cycle

| Item | Current evidence | Result |
| --- | --- | --- |
| Unsafe path-bearer registration | Migration `0070`, source deletion, pilot/disposable aggregate checks, and hosted Preview 404 | Closed without enabling a replacement public signup path |
| Paper-evidence retention conflict | `R-RET-01` and paper capture contract now both require restricted hold/no automatic purge | Closed as a requirements conflict; storage is not implemented |
| Anonymous legacy database functions | Fresh advisor/catalog evidence after `0070` | Closed; browser-executable legacy functions are gone |

## Current critical release blockers

| Requirement area | Current state | What would prove closure |
| --- | --- | --- |
| Registration lifecycle (`R-REG-01`) | Legacy public signup is intentionally disabled. The server-only v2 token primitive exists, but no issue/rotate/close/redeem lifecycle, browser bootstrap, or independent-user evidence exists. | Service-only lifecycle migration/routes, fragment-only browser flow, direct-RPC denial, disposable race tests, and browser/network canary evidence. |
| Hosted auth boundary (`R-ROLE-01`) | The application uses magic links, but the hosted Supabase project still accepts the password grant outside the intended UI. | Authorized administrator disables the Email/Password provider (or an equivalent supported setting is verified), followed by a no-account provider probe. |
| Operations/rules (`R-OPS-01`, `R-RULE-01`) | Starting seating/check-in boundaries exist; rotation, play-through, Consolation eligibility, dispute/judge capacity workflow, and dated official fixtures are not implemented. | Dated ACC sources and test fixtures plus server-authoritative lifecycle and independent-session tests. |
| Offline and hybrid (`R-OFFLINE-01`) | Pending/retry handling exists for selected online mutations; no encrypted/auth-bound offline queue, replay, or dead-phone/paper workflow exists. | Queue implementation and reconnect, replay, session-switch, conflict, and shared-device tests. |
| Paper-card scan/OCR | Contract is defined but no restricted storage, camera capture, approved OCR provider, or comparison UI exists. | Approved provider/layout/type limits; storage/RLS/audit implementation; false-read, self-capture, and real-device tests. |
| Results, finance, export, finalization (`R-FIN-01`, `R-EXP-01`, `R-FINAL-01`) | Manual payment evidence exists, but authoritative standings, result versions, reconciliation, payout/Q-pool calculations, finalization, and `acc-results-v1` do not. | Approved fixtures/contracts, ledger/result reconciliation, negative-path tests, versioned publication/export, and director simulation. |
| Recovery/release evidence (`R-RET-01`, `R-UX-01`) | No backup-and-restore drill, rollback drill, monitoring validation, independent multi-user browser proof, or accessibility usability study exists. | Recorded successful drills and supervised simulation at phone/desktop/zoom with real sessions. |

## Deliberate release posture

The protected Preview is appropriate for layout review but must not be
promoted as tournament operations. The root review dashboard remains guarded
from production hostnames, and the public registration surface is unavailable
until a safe replacement is completed. These are safeguards, not substitute
implementations of the missing product capabilities.

## Priority order

1. Build the secure registration lifecycle and complete the real account/
   role ceremony needed for independent sessions.
2. Complete operational state machines and dated ACC fixtures before any
   official rotation, eligibility, payout, or qualification calculation.
3. Build the offline/hybrid and paper-evidence workflow on top of those
   identity and game boundaries.
4. Build finance, versioned results, export, and finalization together so
   neither money nor results can be published from a mock total.
5. Run integration, browser, recovery, accessibility, monitoring, and
   director-supervised simulated-tournament evidence before production.

## Conclusion

There are no newly found critical defects in the two items corrected during
this review cycle. The application is nevertheless not production-ready:
every item in the critical blocker table remains non-waivable until it has its
listed direct evidence. This review intentionally keeps those gaps visible
rather than relabeling prototype behavior as complete.
