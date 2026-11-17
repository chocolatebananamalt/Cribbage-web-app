# V19 local capability/control checkpoint

Base preserved: V18 42e3a8fd58c04fc4c00ab56c40ff0987dec2effe / tree 3aa2e61e20a6f045feed347966657000837777e0.

Implemented: strict scope/session/catalog/admission-bound capability parser and fresh RPC adapter; action-aware handler capability port; private default-paused SQL control and immutable operator audit. Operator pause uses row FOR UPDATE to drain participating transaction SHARE locks, bounded lock timeout, version CAS, exact operation replay and truthful database operator provenance. Resume requires bootstrap_fenced. No grants, activation or HTTP operator endpoint.

Results: 14 focused tests pass, focused ESLint exit0, TypeScript noEmit exit0. Native PostgreSQL17.12 eight protocol groups pass; see LATEST_RESULT.json. Genuine database concurrency; synthetic bootstrap marker only. No Auth/PostgREST/browser or mature writer integration acceptance. Initial sandbox TCP test failed before assertions; same approved local run passed. Owned server stopped, PID absent, port ECONNREFUSED, disposable data removed on successful run. Initial failed run data is retained as diagnostic artifact; server stopped/PID absent, port probe was denied by sandbox.

Safety boundary: this is NOT a mature installer. bootstrap_fenced remains false in proposal. Need exact first-effect table fence for already-running old function bodies, pinned catalog producer and authorized capability RPC, source-writer admission integration, and independent high-risk review before activation. Existing actual route/UI gates remain hard false. No all-writer drain guarantee is claimed. A historical pause replay is never current drain proof; independent committed state read is required. No held lock survives a transaction commit, so external postcommit effects are outside this protocol.

Full suite/build/pnpm verify NOT RUN for this incremental checkpoint. V18 full-suite evidence is preserved, not attributed to V19. Independent review requested, pending. No hosted action, publication retry, credentials, user session/draft or practice rows accessed.

Portable patch and exact preimages: closeout-v19-incremental.patch + MANIFEST.json. Apply only to exact base after git apply --check, preserve V18. This remains unpublished local work, not a release candidate. No Library update yet.
Bounded independent review completed: PASS, no must-fix found. Review is limited to protocol/parser, not activation clearance. pnpm verify attempted but unavailable because pnpm is not on this shell PATH (command not recognized); full verification incomplete. Focused lint/typecheck logs and CHECKS.json record exit0. Reverse patch application check passed before documentation additions.
