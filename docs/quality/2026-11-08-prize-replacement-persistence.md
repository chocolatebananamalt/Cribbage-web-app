# Main/Consolation replacement: persistence checkpoint

Later local integration supersedes the unconnected-authoring/finalization
status below. See [Setup and registration integration](2026-11-08-prize-setup-registration-integration.md).
The published preview is still unchanged and the new path remains disabled.

This is an incomplete local implementation checkpoint, not a release. The normal
published Setup still renders the legacy declarations. Do not tell Daron to
refresh expecting those sections to disappear.

## Acceptance and scope

The replacement must retain the latest Playoff design, save and recover complete
settings without losing historical data, and bind finalization to the reviewed
new settings before the legacy forms disappear. Payout amounts and money movement
must not be inferred from a saved policy draft. No hosted data, deployment,
public repository upload, access grant or credential change is authorized here.

This slice establishes authoritative workspace reading and the existing atomic
save path. A workspace explicitly distinguishes proven historical absence from
an unavailable or inconsistent head; minimal Main/Consolation row IDs and kinds
must exactly cover both settings and prize snapshots. The authenticated RPC
adapter and private, hard-disabled route composition now support workspace,
save and owned reconciliation. Read, write and recovery capabilities are
independent. Invalid origin, changed identity, malformed requests or unknown
outcomes never cause a legacy fallback or pending-work deletion.

The existing Playoff editor can render the latest prize controls beside its
series controls, without also rendering the obsolete V1 payout inputs. Dormant
historical fields remain unchanged. This optional composition is not wired into
the real Setup workspace yet.

## Executed evidence

`tests/run-event-prize-local-v1.mjs` uses a pinned, already available PostgreSQL
image; the verified empty post-0236 baseline; migrations through 0292; the exact
closed preparation51 package; and the private V4/prize source candidates. It
creates fictional identities and one disposable database in a network-none
container, with no host bind or published port. SQL executes as the fixture
owner with synthetic JWT subject claims, not real Supabase provider sessions.
Temporary roles and candidate flags exist only in that disposable container.

The first real save exposed an ambiguous PL/pgSQL `r.actor_id`: the reservation
record and a table alias shared the name. The query now uses the distinct
`nested_reservation` alias. Source regression coverage was added. Harness-only
SQL-null decoding, immutable-fixture editing and outcome-count query errors were
corrected without relaxing production checks; each failed fixture was removed.

The successful runtime covers initial absence, outsider denial, complete Main
and Consolation save, full TS/SQL acknowledgement parity, exact retry, owned
recovery, all four raw methods and independent rounding choices, immutable old
history, explicit preservation, injected post-core rollback and subsequent
retry, competing writers, and current-role revocation. See the machine-readable
result for the final forced-overlap proof and exact cleanup identity:
`test-results/event-prize-local-v1-20261108/result.json`.

Local source verification: 2,376 application tests; 68 focused tests (including
actual-component SSR); lint exit 0 with 198 warnings; provider readiness; a
production build; and 14 workspace/private-handoff checks passed. Integrity was
rerun after the completed build; its earlier parallel attempt correctly failed
because the build manifest was not ready. Logs are under
`test-results/event-prize-integration-20261108-*`.

Independent source review found and closed two P2 issues: missing exact event
coverage and a shared flag that would disable recovery along with writes. The
reviewer found no additional definite P1/P2 in the scoped changes. SSR proves
rendered composition and disabled controls, not responsive browser interaction.

The complete `pnpm verify` command is not claimed: its npm dependency audit was
previously denied because it could export dependency metadata to the registry.
That denied audit escalation was not retried or bypassed in this task. The local
components above were executed separately. No current clean audit is claimed.

Official Supabase function-security documentation and changelog were consulted.
The markdown changelog could not be fetched by the web tool; the official HTML
index was readable. No SDK package or security setting was changed.

## Remaining implementation and acceptance gates

1. Connect actual Setup authoring and retained browser recovery to the new
   workspace and full prize envelope. Preserve legacy pending operations.
2. Extend the existing guarded registration finalization with exact prize
   snapshot/digest pins, series-only rule validation for V2, and explicit event
   dispatch. The current operational proof assesses V1 payout fields and rejects
   Satellite/mixed scopes. Do not invent a neutral V1 payout to pass that proof.
3. Only then remove legacy declaration forms from the normal new-settings path;
   preserve immutable historical records and legacy finalization for old events.
4. Verify phone/desktop recovery and actual signed-in provider/role sessions.
   Prior denied browser access has not been bypassed or retried here.
5. New methods and $1/$10 increments are saved raw choices, not newly verified
   accounting mathematics. Versioned Finance dispatch, fund reconciliation and
   unresolved rounding/entry-fee comparison semantics remain separate gates.

No approval to publish should be requested on the strength of this checkpoint.
