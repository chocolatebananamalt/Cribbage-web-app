# September pilot scope and prototype verification

Date: 2026-09-11 (HST)

## Acceptance criteria

1. The release tracker identifies the September 18 director-onboarding target,
   October 3 supervised event, must-work Standard Singles capabilities, and
   explicitly deferred capabilities.
2. The Qualification Preview has a working Previous Screen action returning to
   the selected event detail.
3. The Operations option and destination heading both say `Tournament Events
   and Flyer`; the summary shows Main, Consolation, and Satellite events.
4. The prototype does not imply that Judge Desk, digital team scoring, or flyer
   generation are ready for the pilot.
5. Paper/manual evidence and non-self dispute resolution remain pilot gates;
   one paper record or one staff action cannot verify a game.
6. Automatic scheduling is unavailable without an approved rotation fixture;
   the pilot fallback is a visibly labeled, uniqueness/capacity-validated,
   director-approved entered/imported schedule.
7. MRP, Q-pool, payout, and export outputs cannot become official without dated
   approved inputs.

## Executed evidence

- `pnpm test:score`: pass, 78/78.
- `pnpm verify`: pass, 223/223 application tests, dependency audit, lint,
  production build, and 5/5 workspace gates.
- `pnpm verify:handoff`: pass, 6/6.
- `git diff --check`: pass.
- External Chrome desktop: `/demo` rendered; Operations opened; the renamed
  option and destination matched; Main/Consolation/Satellite summaries and
  deferred labels were visible; Results → Main Event → View Qualifiers opened
  the Qualification Preview; Previous Screen returned to Main Event details.
- Production-readiness Site version 14 was rendered locally in external Chrome.
  Its deadline card, must-work scope, deferred scope, milestones, and corrected
  hybrid/rotation/results blockers were present. Static JavaScript and required
  content validation passed.

## Review and limitations

A Sol high-risk review initially found that the narrowed wording had omitted a
minimum paper/dispute path, promised automatic schedules before rotation
approval, and dated official results ahead of required ACC inputs. Those
conflicts were corrected before integration. The second review found no
remaining P0/P1 issue. Its two remaining wording conflicts were also corrected:
image/OCR retention is due only before the deferred image/OCR capability is
enabled, and the active synthetic Rulebook preview is explicitly distinguished
from deferred production Rulebook integration.

The external Chrome controller used for this pass does not expose a phone-size
viewport, so the required real 320/375-pixel visual proof remains open. Static
narrow-phone layout assertions pass, but they do not replace the release
browser gate. The readiness Site was published owner-private as version 14 at
`https://acc-tournament-production-readiness.chocolatebananamalt.chatgpt.site/`.
