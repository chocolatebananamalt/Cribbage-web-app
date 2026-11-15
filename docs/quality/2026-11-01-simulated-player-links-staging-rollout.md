# Simulated player links — staging rollout verified

User approved exact 0270, the reviewed test-branch publication and named rehearsal
enrollment/use. Production was not targeted. The working tree had unrelated local
documentation before this rollout; only the approved 22-file inventory plus its
manifest was staged and committed. No generated/private files or credentials were
published. Snapshot40 protected the pre-publication source and acceptance sequence.

## Exact artifacts and gates

- Staging project: `nnhcnvksxgxnpvdqjgpg` only. Quiet preflight: no other active
  client writer. History ended at0269; no simulated-link objects existed.
- Migration 0270 applied ONCE as `20261101075403`. Stored history contains one
  statement, exactly 9,773 bytes and SHA256
  `733536D1A495373564C5F5A63A0992DAE77583B5AF94932681A3943B06BFEA19`.
- Both new tables are postgres-owned, forced RLS, no client SELECT or service-role
  direct INSERT. All three RPCs are postgres-owned SECURITY DEFINER with empty
  search_path; service-only EXECUTE, no anon/authenticated EXECUTE. Five expected
  guards/immutable triggers are enabled, including deferred provenance enforcement.
- Commit `f183d395bf75df9648871d6eb870ffdd6ce4fb9e`, normally pushed to existing
  `codex/director-setup-journey`, draft PR122, no force/merge/main action.
- Exact-SHA Verify push `41286681074` and PR `41286684365`: both SUCCESS.
- READY Preview `dpl_AAaxz56N7Z9iDSbLypYWo2BP4Hmk`, target null, aliasError null,
  immutable `https://cribbage-web-r9jn5drjj-cribbage-app.vercel.app`.
  Stable alias points to that exact commit:
  `https://cribbage-web-app-git-codex-director-setup-journey-cribbage-app.vercel.app`.

## Enrollment and preservation

Exactly ONE new scope row enrolled at 2026-11-01 07:57:26 UTC for rehearsal
`3c58ef91-010c-4769-af20-5cfa2ffe98a9`, operator director profile
`de0f27a1-60d0-4449-af83-fdf360a9bc08`, fixed staging project. Target accounts remain
only that director and B `986c7f24-1d42-4115-8532-053fc4bef59a`. No human role/access
grant occurred. B's existing accepted co-director binding remains active.

Protected readers return true for those two decision scopes, false for an unrelated
profile and for the completed no-Q fixture. Provenance 0, links 0, roster 0, operational
events 0. No simulated approval, player credential, score, outage or financial action
has occurred. Per-link provenance will be written atomically only when a labelled
comparison is actually approved; enrollment alone is not a passed technical test.

All 223 pre-existing app tables / 21,258 rows have identical whole-table counts and
SHA256 fingerprints before migration, after migration and after enrollment. This
includes both completed replacement finals, receipts, scores, original identity/
qualification history and all other fixtures. The sole app data addition is the
new scope row; migration history separately gained0270.

## Hosted UI and actual next step

Preserved Chrome test tab 336434427 was refreshed without sign-out, password entry,
clipboard use, storage clearing or another tab. Initial recovery preflight settled
normally; no guard was bypassed. The accepted B invitation shows Registered &
Approved. Rehearsal overview explicitly says Your role: Director, proving the
preserved director identity when compared with its unique staging role binding.
The new banner/workspace renders through the stage-URL gate and service-only scope
reader, confirming privileged runtime staging routing. Phone session was untouched.

Observed **SIMULATED TEST**, **One operator simulating two accounts; no independent
identity witness**, unchecked simulation consent and **Pending simulated account
links**. Overview retains that banner. No request was pending or approved. Existing
empty-roster copy says Every roster entry is linked; this is a vacuous empty state,
not evidence that either test account is linked (authoritative count 0).

The draft is revision 2; no regular prize declaration exists. Next director setup:
save the required declaration, use **Finalize All Events / Open Registration**, add
the two fictional Digital roster entries, then use **Player app access**. Each
account redeems its own normal private link; the other test account compares the
phrase in the explicitly simulated workspace, checks the one-operator consent and
chooses **Record simulated match**. Do not use the normal witnessed-match label or
claim an independent human. Complete normal enrollment/check-in/attendance/seating,
publish the 12-game schedule and start before exercising the first two games. No
actual receipt or subsidy may be invented just to satisfy a gate.

Daron stays Director on laptop and B on phone; no further invitation acceptance or
sign-in is currently needed. The first two-device stage requires no helper. The
planned offline step is user-operated and needs execution-time agreement. Only
after technical success will a separate person perform usability and real
independent-human verification. Neither stage is claimed complete here.

No production project query/migration, actual payment, permission/settings change,
external communication or additional fixture was performed. No rollout action was
denied. Supported escalation resolved sandbox Git/network access; the optional
desktop check-diagnostics surface was unavailable, so GitHub's supported read-only
workflow-run API supplied exact push and PR evidence instead.
