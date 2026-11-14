# Own-player privacy and closed route/provider checkpoint

## Privacy completed locally

Own metadata always returns opponent.profileId=null, including Digital peers. The null allowance exists only in own Digital binding/projection; the general Paper/official person contract was not relaxed. Own player.profileId remains exactly the authenticated actor. Peer submission must bind the actual event participant and nonself actor reference; peer confirmation must use exactly the submission's actor reference. Server writes and entry-bound identity/consent/nonself checks are unchanged.

Own-participant state transforms only nonself entry.actorId to a game-scoped HMAC UUID using the existing private Start operation_receipt_id as key. It is not a new credential or public key. Game scope avoids cross-game linkage; keyed hashing prevents recomputation merely from known account UUIDs. Raw canonical journal, source/CAS historyDigest and own entries/receipts remain unchanged. Hash/digest fields remain opaque server-verified CAS data, not a claim that a display-projected peer entry can reconstruct the canonical journal. Nonplaying official state remains raw under existing private role/identity rules. No raw opponent account UUID, private Start key or contact/ACC/financial data is introduced into the own metadata/state DTO. Do not feed this display DTO into authoritative journal/qualification code.

## Route and provider integration, disabled

Added native-mixed-player-route-v1 server loader and /tournament/[tournamentId]/rehearsal/[eventId]/[startId]/[gameId] page. Hard-false code gate rejects before this page's env/client/provider work; existing global middleware behavior is unchanged. No environment switch or query can enable it. Loader uses authenticated getUser/getClaims before/after exact own metadata RPC, validates params and selected owned game, derives source digest from verified response and rejects identity/session/source mismatch.

Browser provider validates configured project URL/ref against target before constructing own client; uses existing publishable client, not admin/service key. Auth events immediately close transport admission, revalidate own actor/session, unsubscribe on cleanup and retain pending data. Activation epoch prevents off/on resurrection. Transactional IndexedDB port construction does not itself open storage. Actual browser lifecycle/IDB/JWT behavior is not proven by source tests. A private entry/card navigation override was added to the shared frame; ordinary defaults remain unchanged. No ordinary offline assignment marker or cached offline page was claimed for this new route.

Every SQL function still defaults off and is revoked from public/anon/authenticated/service_role. No hosted schema/grant/route publication. Page gate remains false.

## Actual disposable fixture

Container46a5e90f8465f30fa86834653b0b41dea43a5e6977a4e6bb5810025dc58f51c4, network none/no mounts/no ports, fictional18 participants. Current113 install plus exact own-reader candidate executed. Actual random18/108/Start, own12 metadata, own card0complete -> actual DD2submits+2confirms ->1complete/2GP/+1spread passed. Privacy results: null peer metadata; raw peer account absent from player state; peer submit/confirm reference equality; game-scoped keyed alias; no private key disclosure; own entry byte-identical; actual TypeScript pending recovery archived exact own receipt against redacted peer state. Repeated terminal history/source/race safety cases passed. All runtime gates restored. Fixture removed and exact absence verified: state.json cleaned/cleanupVerified true. No active owned fixture left.

Evidence directory test-results/native-mixed-privacy-20261107 contains install manifest, installed own SQL bytes, privacy-results.json, own bindings/card exports, traces, logs and cleanup state. Auth/JWT responses were fictional through local SQL adapter, not actual signed provider/browser sessions. No hosted records were read or changed, no existing user draft touched, no persistent access/credentials, invitations or real money.

SQL game candidate SHA256 0a53dcc1c11f28f9dc5f4981595731a30ec16f5648e969a4dfd8c52fd0b261ce. Own-reader SHA256 bbe23cd86c8f4c732f1235643d07d0948f5e47ec5b717a9ff8e50eae56f6a778.

## Verification

53 focused and2,276 complete application tests pass. TypeScript noEmit, production Next build, static provider readiness and14 workspace/handoff pass. Lint0 errors137 pre-existing warnings. Initial full suite correctly flagged new direct RPC absent from migration inventory; added one exact caller/name declaration exception pinned to tested private SQL hash, revoked permissions and AST hard-false route gate. Ordinary migration checks and unrelated callers remain strict. Initial failure retained in application-tests-initial-inventory-failure.log. Independent source reviewer found no P1/P2 in privacy, closed route/provider or navigation, with actual browser acceptance explicitly outstanding. Previous browser/audit denials not retried.

## Readiness, authorization and next action

Human rehearsal remains NO-GO. Highest next local implementation task is a server-enforced, runtime-proven per-player progression guard for future games; do not enable this route assuming normal game's sequencing applies automatically. Also required: real provider/JWT/independent role sessions, supported browser phone/desktop/200%/account-switch/IndexedDB/offline reload and route lifecycle acceptance, truthful physical movement/anchor review, qualification/Finance closure and reviewed test release/grant/recovery plan. Current route is deliberately not an offline full-reload rehearsal page.

Existing authorization suffices for further isolated fictional local DB work and cleanup; do not ask per fixture within that scope. Hosted schema/grants/publication and actual signed-in provider/browser acceptance remain separate scoped authorization/verification gates. No previously denied browser access may be bypassed. This checkpoint does not authorize real-money play or claim official qualification/payout results.
