# Four-qualifier result binding - source only

Parent authorized non-fixture local work on completed four-qualifier playoff mapping, preserving historical source integrity and equal 3rd-4th groups. The separately approved 18-player runtime did not install this candidate or test it.

## Gap and bounded implementation

Existing V3 outcome rows in migration 0240 contain an immutable qualification-result FK, result revision, receipt and audit. The old Director workspace omits that result-specific FK/currentness, so the player/Finance read projection intentionally blocks completed Main4 results. Do not infer the missing link from names, participant overlap or the workspace's current qualification ID.

Added a private, default-off SQL candidate `database/proposals/main-four-playoff-binding-v1.sql`. It returns data only under an explicit service-role claim and current Director/co-director assignment, and has no API-role execute grants. It reads the latest qualification/result, requires four qualifiers, matching FK and whole existing workspace/result, recomputes stored outcomes, checks the immediate predecessor, reconstructs the original native receipt hash and exact response, and requires its matching audit. It never updates old records. No provider wrapper or route is added, and the SQL has not been installed or executed.

Added server-only `main-four-playoff-binding-v1.ts` and an optional provided-model binding in `player-playoff-read-model.ts`. The codec requires strict whole-workspace/head/receipt metadata agreement with the independently supplied qualification and workspace. A missing, stale or contradictory binding retains `legacy_result_linkage_unavailable`. The producer's Postgres digest is opaque to JS; JS hashes the complete captured content as an additional source pin, not an independent recomputation of that digest. Only an authorized private producer may supply this binding, never a browser request.

Completed results map to the existing four-seed chart (1 vs 4, 2 vs 3, then final), preserving the one actual aggregate result UUID and three explicit series ordinals. No fake game/result IDs or independent player confirmations are generated. Existing tie, completed-schedule, fixed Tournament ID, role, source-drift, private-field redaction and synthetic-origin gates remain. Closed/blocked history and unmatched positive synthetic context still block; this is not a bypass around a missing historical contract.

## Finance mapping

The existing Finance estimate consumer now accepts a properly bound Main4 projection. It derives champion, finalist and one equal 3rd-4th elimination band. A Top3 cutoff expands to the whole band/all four with a warning. A director's group adjustment, including explicit zero, stays equal for both recipients, retains history and produces the separate fund warning. Qualification and paid places remain separate. No MRP membership decision, award authorization, disbursement or new accounting writer is introduced.

## Executed verification

Seven pure react-server test groups pass: completed bracket/source ordinals and redaction; missing/foreign/stale binding rejection; equal groups and expanded paid cutoff; manual zero/history; changed winners/revisions; revoked-role/read drift; private default-off candidate contract. These use fictional DTOs, not a database fixture.

Combined full `pnpm verify` exits zero: 1,996 app tests, no known production audit vulnerabilities, zero lint errors/119 existing warnings, six provider checks, build/TypeScript and eight workspace checks. Focused final lint and six handoff tests pass. Independent Sol source/test review found no concrete P1/P2 and matched the SQL hash/response/audit to the 0240 writer.

## Remaining runtime gate

No Main4 SQL runtime, catalog/auth/provider or actual record-read integration is proved. The candidate checks an immediate predecessor rather than recursively certifying all historical revisions; normal immutable writer/FK history remains a dependency. Matching double reads are not atomic snapshots or role leases. The existing production reader supplies no new binding, so its completed Main4 behavior remains blocked.

A separately authorized disposable local 16-entrant/four-qualifier test is needed to install the candidate, verify default-off/ACLs, produce genuine V3 result/qualification/receipt/audit rows through supported test writers, check source/current-head/role rejection and estimate mapping, then remove the fixture. Do not reuse the exhausted single 18-player authorization for another database. No hosted access, migration, publication, fixture, invitation or payment occurred for this source slice.
