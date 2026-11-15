# Fictional historical test inputs

The 56 entries in `manifest.json` are preserved fictional test JSON and SQL
source inputs, copied with their original SHA256 hashes. They contain no real
user sessions or hosted credentials. These inputs reproduce earlier local
test assertions; they do not prove current Auth, provider, device or tournament
acceptance. SQL here is read as source data and is never executed by bootstrap.

`tests/run-application-tests.mjs` restores only missing declared inputs into
the original ignored `test-results/` and `output/print/` locations. It checks
bounded paths, counts, bytes and hashes, rejects linked paths and refuses to
overwrite different existing evidence. The bundled copies stay unchanged.

Supporting metadata is separate from the restored input list:

- `closed-proposals-proof.json`: actual current local installation/default-off
  ACL-denial proof for the two updated private proposal pins. No enabled-write
  or provider acceptance is claimed.
- `installed-rpc-contract.json`: actual disposable local PostgreSQL public
  function names, input argument names and definition hashes, with installed
  source provenance. This is metadata, not execute permission or acceptance.
- `scoped-rpc-callers.json`: the exact source-file/RPC-name pairs allowed to
  resolve against that pinned catalog. No general private-proposal fallback is
  supplied, and wrong callers/names/arguments remain rejected.

Current backend/browser acceptance belongs to the coordinating integration
evidence and must be reported separately from these historical fixtures.
