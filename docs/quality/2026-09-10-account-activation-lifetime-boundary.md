# Account-activation lifetime boundary — 2026-09-10

## Finding and repair

The disabled account-activation issue route accepted any canonical timestamp
and relied on the private database function to reject lifetimes outside its
five-to-sixty-minute window. A plainly invalid browser request therefore
reached the server-only database boundary and was reported as a generic
availability failure.

The request validator now rejects an activation expiry at or below five
minutes, or above sixty minutes, before creating the server-only client or
calling the RPC. The SQL migration retains the same time window as the
authoritative concurrent-state check.

## Evidence

- Deterministic validation tests accept a 30-minute lifetime and reject the
  exact five-minute boundary and a value just over sixty minutes.
- Focused lint and the activation API test passed locally.

## Scope

This does not enable account activation. Its release flag remains closed, its
private migrations remain unapplied to the shared pilot, and real
multi-account database/browser evidence remains required before release.
