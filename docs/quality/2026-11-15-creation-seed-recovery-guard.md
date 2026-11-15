# Creation-seed cleanup preserves unverified recovery bytes

Base:275dbd02702a89f3b432b226ae0fdfcf2ae5bc5a. New isolated checkpoint:creation-seed-recovery-20261115/candidate. This is an independent semantic reconstruction, NOT an exact13033415 import. No unavailable cloud patch was assumed.

## Reproduced current behavior

Actual SetupClient used an unconditional sessionStorage.removeItem for creation-seed cleanup. Its helper was called by saved Setup load and three confirmed-save paths, including the versioned prize path. Reading a valid saved Setup could therefore remove malformed, unknown or foreign-tournament data under the current seed key without validating those bytes. The existing readCreationSeed already validated its DTO for prefilling; cleanup did not.

Final executable lifecycle fixture against the exact preserved base:6groups,3pass/3intendedfail. Malformed/foreign cleanup and raw-replacement protection failed; the successful-save case also observed redundant unconditional removal. Creation request retention, failed/uncertain/malformed or wrong revision/fee save retention, and stale owner/load guards passed before the change. Baseline failures and final source identity are preserved in support files.

## Narrow source correction

Only product file:src/app/tournament/[tournamentId]/setup/setup-client.tsx. clearCreationSeed now reads raw storage, returns for absence, parses unknown JSON, requires the existing exact isTournamentCreated DTO and matching tournamentId, then re-reads and compares the exact raw string immediately before removal. Exceptions preserve recovery; accepted Setup readback remains authoritative. Even semantically equivalent replacement JSON with different whitespace remains untouched when bytes change between validation and removal.

All four callers pass the current tournamentId. The existing actor/tournament-scoped key, owner reference, load sequence, expected revision/financial matching, pending acknowledgement and exact recovery paths remain unchanged. No fee rules, DTO definition, backend, flags, authentication, callbacks, session state or user draft was changed. No actual retry record was inspected or cleared.

## Six executed component lifecycle groups

1. Actual NewTournament uncertain response retains the same request and operation; malformed/extra-field success responses do not seed or navigate. Valid receipt stores the creation seed, clears only creation pending and navigates to the fictional Setup path. No real tournament is created.
2. Actual Setup with no saved revision prefills from a validated seed and retains it. Saved Setup removes only a strict matching tournament-created receipt; malformed JSON/null, unknown shape, foreign tournament, extra field and malformed date remain byte-identical.
3. Exact raw replacement, including equivalent pretty JSON, and first/second-read/removal storage-denied paths preserve data and do not turn valid Setup readback into an error.
4. Actual Setup retry handler retains the original pending JSON and seed on503, thrown outcome, malformed acknowledgment, wrong persisted revision and changed persisted fee. Failed/malformed GET readback also preserves seed. Actual current request/DTO/financial validators execute; paid Main fixture uses3000cents/12games, not a free-entry prerequisite.
5. Actual load callback rejects superseded owner and load epochs before seed removal.
6. Successful actual legacy save/readback clears the matching scoped seed and exact Setup pending after revision/financial verification; foreign actor/tournament seed and pending entries remain unchanged. Cleanup is absent-safe and does not repeat removal of a missing entry.

All6groups pass on the candidate. The harness transpiles actual NewTournamentClient and SetupClient root modules plus current TypeScript validators. Deterministic hooks/JSX-tree, storage/fetch and recovery-owner/coordinator ports are fixtures; UI child components are presentation ports. It is not real React/browser, IndexedDB/SW, Auth, provider/database idempotency, linked/versioned/prize lifecycle or multi-user acceptance. The linked/versioned/prize callers use the same guarded helper and were checked statically; their complete lifecycles were not newly executed.

Independent existing Sol review:PASS/no must-fix. Compared1222sourcefiles, only SetupClient differs. Verified all4call sites, no await between recheck/removal, and unchanged owner/epoch/current financial/revision guards. Required full checks, exact candidate/tree, preimages/hashes, baseline/focused logs and portable patch are in adjacent support REPORT.md/MANIFEST.json.

No hosted Preview/production/database changes, credentials, account/auth/callback changes, live session/draft access, real tournament creation, public listener or publication. Previous275dbd0 and all earlier source/artifacts remain preserved. Other overnight recovery slices remain unreconciled.
