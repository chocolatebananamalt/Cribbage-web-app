# Live pilot advisor recheck — 2026-09-09

## Scope

Read-only recheck of the active pilot database after the result-draft integrity
repair. This was not an authorization to change its schema, grants, records,
or configuration.

## Evidence

- The project reports `ACTIVE_HEALTHY` on PostgreSQL 17.6.
- Migration history ends at the passwordless profile-bootstrap migration; no
  result-draft migration is present.
- The security advisor reports only the expected private-schema pattern:
  forced-RLS `app` tables without browser policies, two deliberately public
  non-enumerating registration RPCs, and authenticated-only private RPCs.
  Those functions are separately role/scope checked and remain required for
  the application boundary; the warning is not a permission to broaden table
  access.
- The advisor also reports leaked-password protection disabled. Separately,
  a fake-credential, no-account password-grant probe established that the
  hosted Email/Password provider is enabled even though the app offers only
  magic-link sign-in. That provider configuration remains a critical release
  blocker; this read-only recheck did not change it.
- Performance notices are unused-index observations on a pilot with little
  production traffic. They are not evidence that required foreign-key or
  receipt indexes are redundant and must not be removed without representative
  workload evidence.
- Catalog inspection confirms that an event’s actual ruleset and scoring
  method live on `app.events`, and that canonical games hold both participant
  identities plus verified/corrected state, winner, margin, and version. The
  future results writer must lock and derive from those records; caller input
  is not a source of truth.

## Result

No newly discovered database-exposure defect was found. The result-draft
atomicity/provenance gap remains open by design until a disposable-database,
executed implementation can prove the strengthened contract. This recheck is
not release certification and does not clear the remaining multi-user,
offline, official-fixtures, finance, finalization, restore, or simulated-event
gates.
