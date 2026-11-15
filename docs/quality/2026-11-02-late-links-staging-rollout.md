# Late-link staging repair completed — 2026-11-02

The reviewed 11-file patch was committed and normally pushed to codex/director-setup-journey / draft PR122 as 2abf66823a6d135041edb5e093e05ca29d5e75df. CI push 41386702604 and PR 41386708940 passed. Git-created Preview dpl_4H7s2kqPpTtzxVBPsBbZMfD1BxkQ is READY for that exact SHA and the stable branch alias. The unique URL is https://cribbage-web-hk7lr9zvt-cribbage-app.vercel.app . The compatible app/parser deployed before the schema. No production publication or main merge occurred.

Staging nnhcnvksxgxnpvdqjgpg migration 0273 applied once as 20261102040931. Stored SQL is exactly 16,953 bytes, SHA256 65ed12880e4a5562dfeb4660877b54b5eb6254630bbed7bf67227086df8d2487. There were no active other clients before migration. All 225 existing app tables and 22,383 rows had identical fingerprints after migration; the new private forced-RLS table was empty. Browser RPC execution is denied; only the backend service role can execute it.

The two approved service reconciliations completed:
- Director link 51b6c278-e534-4c2a-a38b-06a0e27fbafe to participant a24a85df-27f0-4c11-b626-5526e792050c.
- B link ea7d6751-2aeb-41ca-9360-90a2369909c4 to participant 83a13dfc-5307-4825-b85e-f90acee7a064.

Each returned boundCount 1 and blockedCount 0. Operation IDs are 6db0bd0e-49bf-4622-b81a-ad832cf31de1 and 9d5183ef-5938-4c28-bbbd-3d21a63f54e0. Only the two intended null profiles changed, plus two binding records, two operation receipts and two audit events. Every other old table hash remained unchanged. The old rows in the three changed tables exactly match the baseline after removing the approved additions and normalizing those two profile fields to their original nulls. Games, seats, schedule and start history remained unchanged. The current participant digest equals the immutable start digest. The event retains its single user-operated start at 02:59:02 UTC and zero score submissions.

On the actual laptop, tab 336434447 refreshed My Games and opened Game 1, 0e78d3f1-ae09-47ab-8cc2-c7d01bbe792f. Current Game Results shows Director ID A-1 / Table A Seat 1, B ID A-2 / Table A Seat 2, winner buttons, spread keypad, Review Result disabled until input, and Offline Ready. Opening the normal app prepares its existing scoped offline capability; the agent entered no score or confirmation. The phone was not observed. The read-only B account reader returns 12 assigned games and the same Game 1 with action enter_result, B ID A-2 and opponent Director A-1. No activation was repeated, no fixture or credentials were created, and no password, sign-out, role grant or money action occurred.

Next user step: refresh replacement My Games on the phone and reopen Game 1. The laptop is already on the correct scoring form. Verify matching players, then continue the guided single-operator two-device test. No independent-human acceptance is claimed. No result or outage was performed. No access or approval blocker remains.

The source backup receipt is retained separately in the task directory. Source snapshots exclude secrets, configuration, private/generated data, Git history, browser sessions, Docker and hosted Database/Auth/Storage. They are not database backups.
