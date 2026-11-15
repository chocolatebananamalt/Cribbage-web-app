# Structured venue and Tournament Director name layout

## Decision

Tournament Setup stores venue name, street, city, State/Territory, and ZIP as distinct versioned values. The public Tournament Director name is captured as required First name and Last name values. A compatibility venue string and public display name are derived for existing downstream readers; directors never edit those projections directly.

Desktop rows are fixed as follows:

1. Tournament name; Venue name.
2. Venue street address (half row); compact Venue city, Venue State, and Venue ZIP fields.
3. Start date; End date; Time Zone.
4. One outlined **Tournament Director Information (shown to players)** area:
   required First name/Last name plus optional Phone/Email on one desktop row,
   with optional Mailing Address for Correspondence below.
5. The existing save-details gate.

At phone width every field stacks into one column. Existing immutable setup revisions are not parsed, guessed, or rewritten. A legacy draft must deliberately supply the missing structured values before a new setup revision can be saved.

All single-line controls have one fixed visual height. The Director help text is
a separate full-width block above the field grid so it cannot stretch the
First/Last name inputs or wrap into a narrow column. Between phone and wide
desktop widths, the four Director fields use two balanced rows rather than
becoming too narrow.

## Compatibility and data integrity

- The legacy venue projection includes name, street, and ZIP so the existing idempotency digest still binds those values.
- The legacy Director display projection is derived from the two entered name parts.
- A before-insert trigger writes the five new structured columns into the same immutable setup revision.
- Direct legacy database fixtures remain accepted and inherit prior structured values, but the current browser/API contract requires all structured fields.
- The public registration contact continues to receive the derived full Director name and does not read a private profile address.
- Optional phone/email values are stored only when deliberately supplied. Blank values do not block finalization or QR-link issuance and are omitted from public rendering.

## Non-goals

This change does not modify events, registration state, payments, seating, or scoring.
