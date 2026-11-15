# Playoff evidence rejection: retained context and remaining recovery gap

Read-only investigation found a critical rehearsal implementation gap. `database/proposals/native-mixed-playoff-v1.sql` accepts only create-context/game-action requests. For a proposed game action it computes progress before inserting the receipt/evidence; a null result returns `rejected / evidence_mismatch`. Thus the second conflicting entry is rejected, not retained as a server-side disputed result. A synthetic model containing two persisted conflicting submissions is not proof that the writer supports that workflow. No new mismatch phase or unsupported correction control was added.

The own-playoff controller already stores a validated rejection hold around the verbatim original prepared request. It has no terminal resolver or audited replacement generation. Its old message was generic and lost the specific evidence-disagreement reason across reload. The normal host also said the request could be checked/retried while both controls were deliberately disabled for rejection.

## Bounded local change

- Preserve the exact validated evidence_mismatch reason in the displayed message, both immediately and after restoring a matching request/session hold. Foreign, unknown or older-session work remains opaque and untouched.
- Show the saved game number, own fixed Tournament ID, entry/confirmation type and own won/lost choice, explicitly as a saved request rather than a verified result. No opponent name is inferred from newer state.
- Put the rejection and saved context above the game controls; say plainly that this screen cannot correct, replace or clear it. Existing disabled retry/check and all admission/epoch/revocation guards remain unchanged.
- A blocked entry phase no longer tells the player to enter another result. Other phases and all command generation remain unchanged.

No wire/storage schema, SQL, projection, scoring, series progression, access grant or payment behavior changed. No database fixture was needed.

## Targeted proof

`test-results/native-mixed-playoff-rejection-20261109/` contains:

- `tests.log`: 46 nearest pending/transport/route/view tests pass. Added reason-preservation and foreign-session rejection-hold privacy assertions; original bytes, blocked actions, zero archives and no extra dispatch remain checked.
- `types.log`, `lint.log`: scoped TypeScript/lint pass. The final player status change is copy-only and browser verified.
- `provider/result.json`: actual React host with a mocked normal auth/RPC client and transactional memory store; four widths (320/390/768/1440), normal/doubled text and real global CSS. Explicit evidence rejection shows saved identity/choice before controls; no verified-result claim; retry/check/submit blocked; remount keeps exact bytes/reason without resend or archive; session change hides private saved choice. Zero external requests. This does not prove real Auth, PostgREST, IndexedDB or a full browser reload.
- Independent read-only review found no concrete new issue, including the final blocked-entry wording. No writer/clear/correction authority was introduced.

The previously completed disagreement checkpoint and frozen public release were not changed. Full simulation/build/audit were not needlessly repeated for this presentation-only change; the chained pnpm verification remains unclaimed and the denied audit/publication were not retried.

## Critical next implementation

Contested playoff play cannot currently resume safely in the app. Do not tell a second player to copy a conflicting first entry, delete recovery storage, create a replacement nonce or treat a rejected request as verified evidence. Ordinary or qualifying-game correction writers cannot safely be substituted for the Playoff context/slot/game/series source and downstream results.

The next bounded implementation needs durable server disagreement evidence and an audited reviewed resolution/attempt model, exact historical-operation recovery, fresh independent submissions/confirmations, and strict blocking once later games, match advancement or Finance depend on the result. A focused local mismatch-to-reviewed-resumption test can prove that path without repeating the entire qualifying simulation. This is a missing implementation/verification gate, not a newly discovered owner policy decision. All hosted/publication/access restrictions remain in force.
