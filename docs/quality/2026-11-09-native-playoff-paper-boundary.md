# Paper Playoff preview and independent-review boundary

**Historical prototype checkpoint.** The later integrated, verified local result supersedes the implementation-status statements below: see [Paper Playoff integration](2026-11-09-native-playoff-paper-integration.md). Existing administrative-access distinctions and the reproduced hash issue remain relevant.

The parent requested the user-facing paper Playoff workflow and preservation of blind independent evidence. This checkpoint completes a **local, default-off, unmounted screen prototype and pure contract**. It does not install a paper RPC, save readings, or connect a provider. Its new blind-review statement is deliberately not sent to the existing writer, which does not yet support it.

## Reviewable work

`src/components/native-mixed-playoff-paper-v1.tsx` and scoped CSS present fictional paper/digital and paper/paper cards with full names and the same Tournament IDs. Each paper card has its own required winner field. Independent review starts blank, requires an explicit re-entry acknowledgment and preserves differing card readings. It does not invite the reviewer to agree with the preparer's answer or classify agreement locally. Changed server-head metadata keeps unsubmitted choices visible and blocks submission until explicit review/reset. One in-memory attempt prevents duplicate callback dispatch. The preview explicitly says saving/recovery/connection are unfinished.

`src/lib/playoffs/native-mixed-playoff-paper-v1.ts` is an exact-field, scope-bound proposed workspace/command contract. It rejects original capture claims in review metadata, foreign/null identities, incomplete paper side sets, hidden authority fields and accessor input. A review must use the same opaque binding for its expected head and artifact reference. This is a structural contract, **not proof that a server token is opaque or authorized**. The server adapter and persistence remain absent.

Five model/source groups, scoped TypeScript/lint and actual offline React StrictMode browser checks pass. Phone/tablet/desktop at320/390/768/1440 and100/200percent text verify blank fields, every paper-card choice, required acknowledgment, keyboard, differing PP readings, DP single-paper capture, retained stale choices, explicit reset, one callback and zero network. Evidence: `test-results/native-mixed-playoff-paper-20261109/`. These are fake callbacks without storage or backend; screenshots are not a working tournament.

## Reproduced security problem

The existing fictional paper artifact digest is an unsalted SHA256 over known context/slot/game metadata and winner-only claims. PP has only four candidate claim sets (DP has two). The retained fictional actual-SQL witness was reproduced with PostgreSQL JSONB serialization; enumerating four candidates recovered the unique original capture exactly. `blind-hash-reproduction.json` records this defensive local proof. No hosted records or network access were used.

Therefore removing capture claims while returning the raw artifact digest is insufficient. A raw head digest can also expose low-entropy claims if its other fields are known. The proposed server path needs an opaque actor/session/context/game/head-bound token, private server key material and historical token validation. It must retain the exact independently submitted reading and idempotency key, mechanically classify matching/disputed evidence, and leave legacy statement/hash domains unchanged. No new nonce, rewritten request, automatic agreement, or client-supplied approval is acceptable.

## Clarified supported access scope

The parent subsequently directed this work to preserve existing Director/Co-director access and distinguish independent form workflow from authorized administrative visibility. No new role restriction will be imposed: the established nonself/different-official rules remain. Paper capture still requires Cross-checker authority; independent review may use a different Director, Co-director or Cross-checker. Their legitimate administrative tools remain unchanged.

The new endpoint/form must never fetch the preparer's answers before the actor submits an independent reading. Its opaque binding must prevent the new endpoint itself from revealing answers through guessable hashes. It does **not** promise that an administrator cannot intentionally inspect evidence through their existing authorized tools, nor that software can erase prior knowledge of a physical card. This distinction removes the proposed access-policy decision; no new owner answer is needed for this scope.

Backend work is now proceeding as a separate closed proposal after the proof-v2 dependency. Both new capture and review statements will bind an opaque actor/session/context/game/head token while leaving legacy statement/hash behavior unchanged. The server will store the exact independently submitted request, classify matching/disputed evidence mechanically, and support audited exact recovery without rewriting nonces. Root owns client/retained/provider integration; the independent SQL worker owns token/writer/read/recovery source and bounded fictional runtime proof.

At this checkpoint the screen remains an unmounted local preview; the server adapter, persistence and signed-in provider acceptance are still unfinished. Nothing has been installed or enabled on hosted services. There is no current tool denial or unresolved role-policy blocker; the remaining gate is implementation and verification of secure binding/recovery.
