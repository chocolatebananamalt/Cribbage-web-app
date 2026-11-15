# Tournament phone hyphens: input formatting only

The walkthrough request was to insert telephone hyphens automatically (owner
message `Sentinel_1efd0a5d03c08191b0d0dbf4a6d7af4b`). The existing Director
contact input forwarded raw text unchanged. The narrow local fix replaces that
one input with a controlled formatter; it does not change contact validation,
public visibility, server payloads, registration, roles or database schema.

Plain domestic edits display `808-555-0100`; a clear eleven-digit leading-1
number displays `1-808-555-0100`. International prefixes, extensions, Unicode,
unknown and longer text are preserved rather than stripped or truncated by the
formatter. The existing HTML 40-character limit remains. Loading a saved value
does not reformat it or emit an edit. Formatting is not phone-number validation.

Caret positions follow digit positions. Desktop keyboard and mobile input paths
handle separators without trapping deletion. The pre-edit selection is captured
before the browser changes the value: deleting a selected hyphen must preserve
all digits; only a fresh matching collapsed deletion may remove an adjacent
digit. Missing/ambiguous intent conservatively preserves digits. Composition,
blur, changed supplied values and disabled controls clear stale caret intent.

The patch is independent of the blocked mixed-rehearsal database work. It is
unpublished and ready for separate test-release review after local verification.
The isolated six-file patch is checked against local HEAD `ba2845a92...`, not a
verified current hosted deployment. Use that logical patch, not the entire
dirty setup file, to avoid including unrelated unfinished work. No database
update is needed. Rollback changes the input behavior only; existing formatted
phone strings remain compatible with the original free-text field.
