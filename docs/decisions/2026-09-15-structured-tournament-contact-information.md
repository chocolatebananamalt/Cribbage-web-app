# Structured tournament contact information

**Date:** 2026-09-15
**Status:** Accepted — Category 2 prerequisite

## Decision

Tournament setup uses a role-backed primary-director display name, a required
tournament contact phone, a required tournament contact email, and an optional
player-facing tournament mailing address. The mailing address is deliberately
chosen by the director and may be a P.O. box, club address, venue address, or
another preferred tournament address.

The app must not collect, infer, or expose any private/home address from a
director account or ACC record. The retired free-text `contact_details` field
is retained only inside historical setup revisions and is neither published
nor interpreted by the current application.

## Consequences

- Setup saves are versioned and audited with structured selected contact
  values.
- Registration displays only the chosen phone, email, and optional mailing
  address. Future flyer output consumes the same structured fields.
- Activation rejects a setup revision lacking a valid phone or email.
- Existing setup revisions can be loaded with blank structured fields so an
  authorized director can repair them, but cannot be newly activated until the
  required values are saved.
- No profile-address schema, account-address lookup, or ACC member-record
  contact synchronization is added.
