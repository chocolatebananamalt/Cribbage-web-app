> Later update: the exact candidate now passed local official-CLI populated-schema acceptance; see 2026-11-07-native-official-full51.md. Historical attempt notes below are retained, and staging remains held.

> Update: the later network-none Unix-socket protocol probe passed. See 2026-11-07-native-official-cli-socket.md. This report retains the original failed attempt; full candidate installation remains unverified.

# Official CLI migration packaging — local candidate, transport blocked

## Acceptance and outcome

Prepare a genuine CLI-versioned candidate from the reviewed 51-source closure; preserve source bodies and closed privileges; prove official-runner rollback/history behavior and populated-record compatibility; leave staging unchanged. Packaging/source integrity passed. The official transport and its downstream populated install did **not** run, so this task is not a release-readiness pass.

Candidate: `database/release-packages/native-preparation51/supabase/migrations/20261107090229_native_preparation51_closed_install.sql`, SHA256 `22f9145694802d79d13d50ab36d52e8dc030b1f86649b9cb8a5f2fe733187f58`. Generated with cached Supabase CLI 2.121.0, no download/login/link. A workspace-only SUPABASE_HOME avoids writing global CLI state; telemetry was disabled with the supported CLI command. Manifest explicitly holds official-runner atomicity unverified. One source BEGIN and one COMMIT were removed; the interior, including 379 final revokes, is byte-identical. No new access grant is in the final privilege suffix.

## Actual local attempt and cleanup

`tests/native-mixed-official-cli-run.mjs` created one temporary fictional PostgreSQL cluster on an internal, labeled Docker network, no host mounts, no credentials. Requested binding was 127.0.0.1 only. PostgreSQL became ready internally, but Docker supplied no published HostPort. The create phase failed; **no numbered baseline restore, CLI migration, SQL probe or migration-history test executed**. This is a local transport/environment failure, not an automatic-review denial. No retry with a less-isolated network was attempted.

Owned container `4b1357592839b2218cb815bc3dac49b28e67a9c6d8b732bc13ca7df4cde7f558` and internal network `f322a5e7d9cf2c922e94aafef4caa612f9002465617ffafb4e4f2e768e787155` were removed. `state.json` records cleanupVerified and networkCleanupVerified true; `cleanup.log` confirms removal. Prior atomic51 results remain separate evidence: full rollback before commit, no interim exposure, 30 preparation operations, role denials and historical fictional row/ACL/sequence preservation. See the closure51 QA report. They do not prove the CLI transaction/history contract.

## Checks executed

- Python atomic SQL lexer: 3 passed.
- New official package source-integrity tests: 5 passed (hashes, exact interior, no explicit inner transaction, 379 closed revokes, release-held flags).
- Workspace/handoff checks: 14 passed, including nested 6 handoff checks.
- Local transport: failed before install, cleanup passed.

No application behavior or UI changed. Prior 2361 application checks and isolated 23-file build were not rerun for this SQL packaging-only task. Required audit and browser checks remain unavailable due to prior denials; neither was retried or bypassed. New runtime harness is diagnostic, not accepted release tooling.

## Risks and smallest next action

First establish a supported local-only official-CLI connection, then execute the small transaction/history fault-injection probe. Do not apply the 1.27MB body until that succeeds. Next run the exact candidate against fictional populated 0292 and eventually a fresh private restored staging backup, with real migration history and all existing legacy/catalog checks. The old recovery export is stale. Hosted installation, cohort/access setup and signed-provider/browser acceptance remain separate approvals/gates.

The 51-file closure is broad and changes two existing guarded activation function bodies plus Side/schedule constraints, despite preserving five accounting functions. Post-commit restoration is not established by a website rollback or injected rollback test. Do not claim the trial or Finance is ready, enable the candidate, or rewrite the saved user draft.
