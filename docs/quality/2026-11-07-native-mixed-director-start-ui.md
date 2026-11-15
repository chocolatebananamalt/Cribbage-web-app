# Director rehearsal Start UI — local acceptance

The bounded Start UI is implemented and tested locally. The Director bootstrap is a read-only status view, not a completed setup wizard. The candidate remains disabled. No hosted system, live tournament, invitation, credential or real payment was changed.

## What is implemented

The existing preparation page now includes a read-only Before Seating checklist and a Start Rehearsal panel. Its status projection requires the same fixed-project, current-session, Director and event-cohort authorization as preparation. It exposes only aggregate preparation records and an event-level simulated-Start presence flag. Unknown, stale or inaccessible status is unavailable, never zero. Partial records are not full readiness. Six own-subject consent records and an independent paper-review record remain separate requirements.

Start uses the existing private simulated-Start writer and its three guarded provider methods. There is no new Start writer or change to ordinary attendance, scoring, admission-seal or finance rules. The request is saved using the existing retained-storage CAS adapter before dispatch. Unknown replies require checking the same saved operation; they cannot generate a fresh nonce or silently resend. Only the explicit source_busy outcome permits a user-requested exact retry. Storage collisions, unrecognized records, account changes and offline transitions preserve pending bytes. A historical receipt is retained as historical, with current readiness requiring another source check. The display drops its current claim after 30 seconds or a failed recheck.

A fresh own-session bootstrap observation blocks a second device from preparing a new Start when one already exists. The database's event-unique Start guard remains authoritative for races. Preparation and Start confirmations begin unchecked. Default page/API gates remain false; no environment setting enables this candidate.

## Acceptance evidence

The final isolated fixture was 137b1b6cd537b1cbc2ece1ef0b7e2acce875210b8462b662307e2758a471c61d. It used fictional data, modeled Auth clients and local PostgreSQL, with no network, ports or mounts. Its frozen source manifest matched through completion. It exercised the preparation authoring model, retained controller, modeled HTTP Request handlers and SQL, then:

- persisted a confirmed Start, deliberately lost its committed response, reloaded the controller, recovered the original receipt and revalidated the current source without resending;
- rejected a second device before a new nonce or pending-storage write;
- showed a temporary own-subject consent revocation as five grants and currentReadinessVerified:false, then verified recovery after rollback;
- denied a foreign-session bootstrap read; the aggregate RPC remained unavailable directly to anonymous/authenticated roles;
- completed nine qualifying games across DD, DP and PP, with 28 private receipts/audits and eight fictional paper artifacts;
- left ordinary Start, submissions, confirmations, scorelines and paper completions at zero;
- preserved all 45 prior fictional rows across 254 monitored tables.

An independent graph check of the actual new SQL schedule finds 108 unique pairs across 12 rounds, 12 distinct opponents for all 18 participants, and no sit-outs. This is schedule proof, not a new full-108 scoring run or physical-movement certification. The prior full-108 scoring evidence is preserved separately. No qualification, MRP, payout calculation, actual collection or disbursement is claimed here.

Two failed harness attempts are preserved: c35212... stopped at the consent-revocation test because the fixture had not granted the guarded own-consent wrapper; e66bd2... passed Start/consent checks but stopped before game writes because the smoke harness lacked an initialized result cache. Both were removed. The final corrected run passed and was removed. Independent Docker metadata verification confirms all 22 tracked containers absent.

Current checks: 2,345 application tests; nine Start-controller tests including expiry; 11 actual-model Start/bootstrap SSR checks; TypeScript and production build pass. Lint has zero errors and 167 warnings. Independent source/evidence review found no new P1/P2 for this bounded candidate. SSR does not establish browser, hydration, IndexedDB or accessibility behavior. No prior browser/network denial or dependency-audit denial was retried or bypassed.

Evidence folder: test-results/native-mixed-start-ui-20261107. Cleanup artifact: test-results/native-mixed-start-ui-cleanup-verification-20261107.json. The grant fixes are strictly disposable-fixture permissions, not a hosted rollout manifest.

## Practical readiness and remaining work

The human 18-person rehearsal is still NO-GO. The tested fixture is the existing Main-only $30-per-entrant simulation; Daron's saved $50 setup was not read or changed.

The bootstrap fixture still supplies preconditions that the Director page cannot create: an approved TEST ONLY activated event, 18 registered identities with six Digital links and 12 fictional Paper entries, approved officials and a project/event/actor/expiry cohort. The page also lacks retained, guarded writes for admission intent, simulated funding scope and its 18 entries, attendance scope, paper declaration and attendance seal. Each real digital player needs an own-session consent screen, and a different authorized cross-checker needs a paper-roster review screen. Do not replace either with a Director checkbox. The existing admission seal requires an ordinary Start and must not be fabricated for this simulated path.

After those flows: genuine signed-JWT/PostgREST and browser acceptance, independent real devices, offline/full-reload recovery, phone/desktop accessibility, physical movement and playing-official role checks, and the qualification/Finance/payout bridge remain. The six-human role arrangement is not proved by a fixture using six player identities and two nonplaying official identities; this does not mean eight people are required.

Before any hosted acceptance or release: isolate the exact reviewed code/dependency/grant/cohort manifest, verify a current recoverable staging backup and obtain separately scoped hosted approval. A private source ZIP is not a database backup. No publication is requested from this checkpoint.