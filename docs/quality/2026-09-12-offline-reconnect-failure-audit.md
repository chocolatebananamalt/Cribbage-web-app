# Offline, reconnect, and failed-device release audit — 2026-09-12

## Scope and acceptance

This audit covered the October-pilot-critical browser queue, reconnect replay,
prepared offline score page, and the already-implemented failed-device recovery
path. It did not enable feature flags, apply migrations, or change hosted data.

The repaired client behavior must:

- keep transient, unauthorized, rate-limited, and malformed replay outcomes in
  durable browser storage;
- remove a queued record only after an exact request-bound terminal receipt,
  including a server-recorded rejection, quarantine, or conflict;
- prevent parallel tabs or taps from creating multiple local submissions for
  the same actor and game;
- prevent further entry in the mounted score screen after a terminal adverse
  replay outcome;
- serve every explicitly prepared same-origin Next static asset, including
  stylesheet assets, while offline; and
- preserve the independent, non-self, two-official device-recovery authority
  already proved by the device-recovery contract and rollback fixture.

## Findings and repairs

1. A valid terminal `409` receipt was previously shown as “needs review” but
   retained in IndexedDB. Every later reconnect replayed an operation the server
   had already recorded as terminal. The score screen now validates the same
   exact receipt used for accepted replay, removes the local record, displays a
   distinct Conflict/Quarantined/Rejected outcome, and locks new entry until the
   current server context is reloaded or an official handles the case.
2. The queue store was keyed only by a random queue ID. Rapid duplicate actions
   or another tab could therefore create more than one queued submission for
   one actor/game, while the reader returned an arbitrary first match. A single
   IndexedDB read-write transaction now serializes the actor/game check and
   insert: exact repeated values reuse the existing immutable record, changed
   values fail closed, and legacy multiple matches are reported as a conflict.
3. Offline preparation cached all `/_next/static/` assets, but the service
   worker served only chunk/immutable subpaths. It now serves any previously
   prepared `/_next/static/` request and still never intercepts mutation/API
   traffic.
4. The failed-device recovery implementation was re-audited. Its strict request
   codecs, same-origin authenticated routes, actor-scoped retry envelopes,
   non-self eligibility, independent review, immutable evidence, and approved-
   only projections remain covered by the focused test suite. No new code defect
   was found in that slice.

## Verification

Environment: local Windows worktree, Node/pnpm versions pinned by the repository.

- `node --conditions=react-server --experimental-strip-types --test tests/offline-score-queue-contract.test.mjs tests/device-failure-recovery.test.mjs`
  — PASS, 16/16.
- focused ESLint for the changed TypeScript/test files — PASS, zero errors.
- `pnpm exec tsc --noEmit` — PASS.
- `pnpm test` — PASS, 369/369.
- `pnpm build` — PASS, Next.js production compilation and route generation.
- `git diff --check` for the four implementation/test files — PASS (Git emitted
  only the existing Windows line-ending notices).

## Remaining release evidence

Repository verification cannot replace the required witnessed physical proof.
Before enabling offline scoring for the pilot, two independent browser/device
sessions against the disposable real backend still need to demonstrate:
offline entry, offline reload/restart, reconnect, terminal conflict/rejection,
stale state, same-player reauthentication, different-account blocking, shared-
device clearing, and reconstruction/approval after an unavailable device.
Those are verification tasks, not missing implementation discovered by this
audit.
