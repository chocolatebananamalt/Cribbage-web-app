# Exact three-file reviewed-draw reconciliation with seating refresh

Base:b6af14e151e5858461079a1b3d8cdda4e3228603. New isolated workspace:seating-draw-compatibility-20261115/candidate. Both prior candidate histories/artifacts are preserved. This is NOT full13033415 integration.

## Source provenance and preimages

Read only normal authorized project files in ../task/staging-reload-candidate13033415-20261115; no private Codex history was read. Its MANIFEST.json/TRANSFER-VERIFIED.json attribute three exact files to13033415ad004c5c9b2837295cc3b314f019f00b, explicitly not a reproduced whole tree. Independently checked all three actual file bytes before any candidate copy:

- src/components/reviewed-draw-publisher-client.tsx:14849bytes; SHA256f8658b6b323cc7c09d08389ab9fe0d0631557b1682c09982e4871e270afcb1ac.
- src/lib/seating/reviewed-draw-navigation.ts:1712bytes; SHA25610362d4fb29faba322df0afaef350055b510b5e7108e81e914ba6c6e0769b390.
- tests/reviewed-draw-navigation-reload.test.mjs:10958bytes; SHA2561032ddd2dc622b01f6a85c9e5bac7b920d055ca0a2740b96e6dce914d9065de7.

The publisher preimage SHA256cb471a7f634182eab239889f33f76f4f2c7ebda53fe2dbf567452361bf339962 in b6af14e equals the published ccff9f7d publisher bytes exactly. Other two paths are absent/new in b6af14e. Only those three input files were copied; none edited or reconstructed. No SQL or backend fixture files were integrated. Input provenance and final manifest record exact bytes/preimages and stored Git blobs.

## Semantic compatibility

b6af14e's SeatingClient handles an unpublished local manual draft:current checked-in roster identities must match before publishing; explicit draft updates and Table Plan rebuilds revoke consent, and retained requests remain protected. This product file is byte-identical after reconciliation.

ReviewedDrawPublisherClient is a separate keyed actor/tournament scope. Its reload now clears the previous link, fetches the validated current native workspace, reads only the remembered canonical operation pointer, and fetches that exact operation. It renders navigation only after accepted actor/tournament/request/operation receipt validation and matching immutable native publicationId,18published roster identities and verification/start seats. It never guesses latest draw or substitutes the live attendance roster for published IDs. The helper is read-only navigation proof, not eligibility, permission to publish, scheduling, Start Play or payment.

The actor/tournament storage key and keyed child/layout cleanup preserve scope. Generation and active-scope checks after workspace and exact-operation awaits, plus a recheck of the remembered pointer, prevent old readbacks restoring a link after refresh/unmount/pointer replacement. Storage/network errors leave saved requests untouched and navigation hidden. The destination schedule reader retains its separate fresh admission/authorization; no server proof or gate is relaxed.

No shared product path or state key is modified by both slices. Refreshed draft membership and authoritative published-ID navigation are intentionally distinct states. No reconciliation edits beyond the exact incoming files were needed. Existing18-player reviewed cohort and existing draw availability remain unchanged.

## Executed proof and review

19focused tests pass:8exact navigation reload groups,8existing publication-result groups and3actual check-in-route groups. Includes malformed/missing pointer, foreign actor/tournament/operation, changed native publication or assignment/count, invalid request, unavailable read, storage/network exceptions, pointer replacement, unmount, fresh failed refresh and superseded-read races. Navigation test uses actual component/strict codecs with deterministic hook/storage/fetch ports; it is not a real React browser or provider test.

All10b6seating-refresh browser cases pass in the combined candidate at390x1000/1440x1000, covering changed IDs, explicit update, exact response-loss retry, protected foreign recovery and both alternate consent-reset inputs. Actual React component and real browser sessionStorage; synthetic router/RPC/HTTP/recovery setter, SWblocked. No real Auth/database replay or multi-device/provider claim.

Independent existing Sol reviewer:PASS/no must-fix. Checked all incoming hashes, unchanged b6seating file, keyed scope, generation/operation/native-ID binding, downstream schedule checks and executed focused/browser evidence. Required full verification outcomes, candidate/tree, clean-preimage checks and portable artifacts are in adjacent support REPORT.md/MANIFEST.json.

No hosted state, Preview/production, SQL, grants, flags, credentials, user draft/session, real tournament, account or publication changed. Other overnight cloud recovery changes remain unavailable/unreconciled; whole13033415 tree has not been restored. The backend lane's earlier native assertions are historical context, not tests newly run or claimed by this package.
