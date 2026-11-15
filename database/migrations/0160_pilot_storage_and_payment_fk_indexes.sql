-- Cover every foreign-key prefix introduced by the October storage, OCR, and
-- payment-obligation migrations. These indexes do not widen table access.

create index paper_card_ocr_attempts_storage_scope_idx
  on app.paper_card_ocr_attempts(storage_receipt_id,tournament_id);
create index paper_card_storage_access_receipt_scope_idx
  on app.paper_card_storage_access_events(storage_receipt_id,tournament_id);
create index paper_card_storage_receipts_capture_scope_idx
  on app.paper_card_storage_receipts(capture_id,tournament_id,event_id,canonical_game_id);
create index paper_card_transcription_attempt_scope_idx
  on app.paper_card_transcription_draft_versions(ocr_attempt_id,tournament_id);
create index roster_payment_obligation_roster_scope_idx
  on app.roster_payment_obligation_versions(roster_entry_id,tournament_id);
