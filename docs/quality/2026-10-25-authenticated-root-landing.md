# Authenticated root landing repair — local candidate

## Acceptance and scope

The root must show the existing real tournament chooser to a verified director
or player in every environment. Anonymous visitors get tournament sign-in,
without querying private tournament/director adapters. Empty/unavailable access
must remain truthful. Explicit `/demo` keeps its sample-only notice and scoring
prototype; real tournament/player scoring routes and authorization stay intact.
Direct entry, refresh and Back must preserve these choices on phones/desktops.

The published Preview at68315d0 was observed showing Sample Cribbage Classic
at `/` after successful staging sign-in. Source selected the review prototype
by hostname before reading the verified subject. This was a routing problem,
not failed sign-in. Its separate hosted activation verification is recorded in
`2026-10-25-hosted-staging-rehearsal.md`.

## Change

- `src/app/page.tsx`: remove the host/environment prototype branch; always use
  the existing verified-subject chooser and anonymous sign-in path. No automatic
  choice of a tournament: users retain their role-scoped list and workspace links.
- Delete the now-unused `src/lib/review-prototype-boundary.ts`; source search
  confirmed no other runtime caller. `/demo` remains unchanged.
- Replace obsolete host/prototype assertions in
  `tests/supabase-auth-semantics.test.mjs` with root/demo separation guards.
- Add `tests/home-landing-browser.mjs`, rendering the actual root/demo source
  with three server data adapters mocked. Synthetic cookie values are fixture
  roles, never authentication credentials. No external backend is contacted.
- `PROJECT_STATUS.md`, this report and the existing hosted report preserve
  the local/published distinction. No memory files changed.

## Executed verification

- Focused auth/chooser tests:42/42 PASS.
- New Chrome suite:exit0, five states (anonymous, director, player, empty access,
  unavailable backend), each at390px/1440px without horizontal overflow.
  Verified exact actor passed to both private adapters and zero private calls
  for anonymous requests; director Create Tournament versus player absence;
  authorized workspace links, Back/refresh, explicit demo notice/Score Entry,
  demo reload and Back. Workspace destination is a local stub: this is root
  routing proof, not new score-entry/backend authorization proof.
- Screenshots visually inspected for director390px and player1440px. Full
  synthetic evidence is outside Git in `home-landing-evidence-1792956138179`.
- Fresh `pnpm verify`:exit0;775/775 app tests, production audit0, lint0errors/
  2pre-existing warnings, provider fallbacks, TypeScript/Next16.4.2 production
  build PASS; workspace7pass/1expected private-handoff skip. Private handoff
  is absent, so `verify:handoff` remains unavailable rather than claimed passing.
- `git diff --check`:exit0, line-ending notices only.
- Independent Sol review: plan, source/test design and final executed-evidence
  review PASS, with no remaining findings. No auth, scoring or security change.

Initial browser assertions failed before Next streamed/transitioned to the target
screen. Explicit visibility waits were added, preserving the same content checks.
Diagnostic DOM then showed the correct chooser with a typographic apostrophe;
the heading selector now accepts only the straight/typographic apostrophe forms.
The later demo-link assertion similarly needed navigation completion. A local
PowerShell edit failed parsing before execution and a diagnostic localhost read
arrived after fixture shutdown; neither changed product data. Final rendered
checks passed with no assertion removed or security guard weakened.

## Remaining staging QA with current permissions

The existing fictional director can perform further paper-only rehearsals without
new credentials: roster CSV/manual validation and duplicate guidance, attendance
and enrollment rejection paths, explicit zero-owed review, schedule/start gates,
director paper capture/re-entry, closure/cancel/reload, and accessible read-only
reports. A realistic larger paper event can use additional fictional roster
identities without app accounts, provided its schedule is reviewed against the
existing rules rather than invented. These are feasible, not claimed completed.

The sole director cannot establish independent digital-player confirmation or
multi-user self-check restrictions. Cross-check completion still needs the
required assigned cross-checker; no role is granted to bypass it. Final settlement,
full final-results acceptance, real SMTP, physical multi-device/offline proof and
the recommended staging-only database-password rotation remain separate gates.
No real email/payment, credential creation, permission expansion, production
write, push, deployment, merge or release occurred in this repair.

This candidate is local and unpublished. PR122/remote head remains68315d0.
Next step: review this result before authorizing a Preview update, then verify
the actual signed-in root on that new hosted build.
