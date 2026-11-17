# V25 local legacy registration bridge acceptance

Base: V24 88636040b2c5c0d8d79a3781d67da8c817a89b81. New default-closed paper lane; no V3 writer/schema replacement, old record mutation, automatic merge or digital profile policy.

## Implemented
- Guarded roster navigation and mounted address/distinction registration, pre-save duplicate review, exact existing-row selection, stable separate identity for same-name/address people.
- Native transaction joins new legacy row, normal receipt/audit and private identity/adoption under one roster ID. Legacy legal display constraint remains intact; recorded distinctions are rendered by existing V24 check-in rows.
- Shared and own write pause/drain locks; source revision+inventory digest before own delta; exact actor/session/op/hash replay and current binding; final authorization check. Unknown/incomplete namesake coverage blocks matching claims.
- No local PII recovery request: metadata only; null/loss/reload preserves work, explicit exact re-entry required, no auto replay/deletion. Retained UI callbacks invalidated by committed intent/epoch and Auth/owner changes.
- Real Next API wrapper has same-origin/bounded parse/private JSON/failure boundary; normal runtime uses verified cookie identity and SID continuity. No synthetic Auth seam ships in application runtime.

## Executed
- Native PostgreSQL17.12 owned fresh loopback fixture: ten SQL groups + integrated pipeline; constraints, rollback, concurrent same operation, session expiry during outer DML, closed roles, catalog drift, actor/hash denial. Final controls OFF. Owned PID stopped, port closed, PID file absent, data removed.
- Actual components at390/1440, six browser groups: complete first registration; duplicate opens same identity without write; distinct middle/prefix/suffix persists second ID; commit-response503/reload/exact recovery; null/ABA/Auth/stale actions preserve recovery; paused0write; both recorded names visible directly; separate actual normal check-ins produce one event per ID; no payments/seating effects or overflow.
- Browser uses webpack-mounted actual components and handlers/providers, synthetic cookie/getClaims/getUser/recovery/router and SDK RPC translation to native SQL. Existing normal check-in route source executes. No genuine Supabase Auth/PostgREST or Next SSR/serviceworker proof.
- Full app suite3787 pass0fail; focused new contract/handler9 pass. First full run failed4 new-route boundary inventory tests, resolved with actual explicit normal wrapper; final all pass. Type/lint/provider/build/workspace outcomes are recorded in external aggregate package; unavailable checks remain incomplete.

## Remaining activation requirements
Matching mature legacy schema/preimages and every competing writer admission/lock graph; explicit future V25 public RPC wrappers, catalog and minimal ACL; genuine local Auth/PostgREST+Next SSR and independent sessions; linked/digital profile policy. Address-incomplete legacy namesakes require explicit review. This is registration→check-in acceptance, not proof of event enrollment, scoring, reporting or full tournament migration. New app gate rejects hosted targets even when flags are supplied. No hosted changes, practice records/session access, publication or sign-in email.

## Final aggregate
Final full suite3787/3787; focused11/11 including existing shared component checks (9 new V25 groups); lint0 errors/252 unchanged warnings; typecheck/provider passed; production build passed using fictional localhost:9/dummy credentials after compiler-worker escalation and Next advisory identical-command retry. Next16.4.2 emitted a known-security-vulnerability upgrade recommendation; no dependency upgrade performed. Workspace7pass/1 private-handoff skip. Explicit handoff fails because private import is absent; pnpm unavailable, so full pnpm verify/audit not executed. No package/dependency changes. Independent high-risk reviewer bounded PASS.
