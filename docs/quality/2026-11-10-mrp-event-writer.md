# Protected MRP Provider and Writer Protocol

Local disabled implementation; no RPC, SQL table, migration or route installed.

The provider uses normal cookie claims and getUser before/after its required private RPC. It requires matching real actor/session/event/tournament and primary-Director proof from that RPC. No service key, JWT override, manual-journal fallback or public lookup inference. The required get_event_mrp_verified_evidence_v1 function does not yet exist, so native collection remains unavailable.

The writer follows the repository's transaction-port pattern. It derives points from the protected source, binds full current-capture SHA256 and expected head, requires explicit confirmation/reason, keeps unknown/review-only members pending, and records complete observations/corrections with original audit references. Exact operation replay precedes current head/source checks and is identified as a historical receipt, not current evidence. It does not submit a report to ACC or finalize an entire tournament. Scope remains supported canonical playoff qualifiers only.

A real adapter must provide one transaction, immutable history/unique operation/head CAS, serialization of actor/operation and all source-head writers, and rollback on callback failure. These guarantees are requirements, not proven by mocked tests. No actual adapter is supplied in this checkpoint; no official MRP was saved.

Verification: six writer/provider focused tests plus six collector tests pass; TypeScript and targeted ESLint pass. Protocol tests cover denied confirmation, source/head mismatch, unknown/review-only evidence, identity loss, source races, rollback in the fake transaction, lost successful commit acknowledgment, exact retry single append and adapter-owned object mutation. Review found uncertain outcomes mislabeled no-write and replay alias risk; both corrected. A thrown transaction now returns mrpWritten=null and requires exact-operation recovery. No database/provider session/browser/full-suite verification claimed.

Remaining concrete implementation: immutable native event-date eligibility determination storage (separate from journal), authoritative roster/result/date adapter and RPC, plus the SQL transaction adapter and reciprocal source-writer locking. Until those are implemented and verified, both gates stay literal false. Do not replace missing authority with an asserted role/status or ordinary review notes. No hosted changes, SQL execution, new fixture, public upload or denied-operation retry.
Independent source re-review GO: both P2 corrections verified, no remaining concrete P1/P2. Native evidence RPC/SQL adapter/database proof still absent.
