# Finalize all events, open registration, and safe event replacement

Date: 2026-09-15

## Decision

A tournament begins as a private, editable draft. **Save All Events Draft**
creates an immutable setup version but does not make the tournament publicly
registerable. The designated tournament primary director must explicitly
confirm **Finalize All Events / Open Registration**. That one server-authorized
operation records the saved revision and event list, locks the initial event
definitions, opens registration, and sends the director to QR/URL management.

Public registration requires both an active registration credential and the
finalized/open tournament state. A credential issued before the operation is
never redeemable merely because its bearer token is valid.

An event is never destructively deleted after finalization. Before Start Play,
only the primary director may:

- **Cancel/Retire Event**, preserving its event, enrollment, payment, and
  audit history while blocking future enrollment; or
- **Cancel/Replace Event**, preserving the original and creating a separately
  identified replacement with a copied immutable setup snapshot for review.

Replacement additionally creates new event-scoped records for eligible
individual/team enrollments and team contributions. It does not duplicate,
move, or rewrite money: the receipt/obligation ledger is already scoped to the
tournament, so immutable transfer records bind the applicable payment-credit
references to the replacement. Withdrawn, disqualified, and substituted source
participants remain only in the original event for later director review.

Both actions require a reason, confirmation, exact idempotency receipt, and
append-only audit evidence. Co-directors cannot perform them. A platform
administrator may use the same server operation only under an auditable
emergency-override authority. Post-start issues use attendance, withdrawal,
correction, and results workflows instead.

## Consequences

The director can safely correct a setup mistake without rewriting historical
financial or scoring evidence. Registration remains separately controllable
from closing registration, seating, schedule publication, and Start Play.
Existing unfinalized unused drafts were set to closed registration when the
migration was applied; directors simply save their current complete draft and
make the explicit finalization choice.
