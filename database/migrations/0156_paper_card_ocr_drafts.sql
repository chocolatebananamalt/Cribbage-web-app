-- OCR output is private, append-only draft evidence. It cannot update a score,
-- confirm a game, or affect standings. A human reviewer must create a separate
-- reviewed version before existing cross-check workflows can use transcription.

create table app.paper_card_ocr_attempts (
  id uuid primary key default extensions.gen_random_uuid(),
  storage_receipt_id uuid not null references app.paper_card_storage_receipts(id) on delete restrict,
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  requested_by_profile_id uuid not null references app.profiles(id) on delete restrict,
  provider text not null check (provider = 'openai'),
  model text not null check (length(trim(model)) between 1 and 100),
  adapter_version text not null check (length(trim(adapter_version)) between 1 and 100),
  provider_response_id text check (provider_response_id is null or length(provider_response_id) between 1 and 200),
  attempt_state text not null check (attempt_state in ('completed','failed')),
  failure_code text check ((attempt_state='completed' and failure_code is null) or (attempt_state='failed' and length(trim(failure_code)) between 1 and 100)),
  created_at timestamptz not null default now()
);
alter table app.paper_card_ocr_attempts enable row level security;
alter table app.paper_card_ocr_attempts force row level security;
revoke all on table app.paper_card_ocr_attempts from public, anon, authenticated;
create trigger paper_card_ocr_attempts_immutable before update or delete on app.paper_card_ocr_attempts
for each row execute function app.reject_immutable_history();
create index paper_card_ocr_attempts_receipt_idx on app.paper_card_ocr_attempts(storage_receipt_id, created_at desc);
create index paper_card_ocr_attempts_tournament_idx on app.paper_card_ocr_attempts(tournament_id, created_at desc);
create index paper_card_ocr_attempts_requester_idx on app.paper_card_ocr_attempts(requested_by_profile_id);

create table app.paper_card_transcription_draft_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  ocr_attempt_id uuid not null references app.paper_card_ocr_attempts(id) on delete restrict,
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  version integer not null check (version > 0),
  editor_profile_id uuid not null references app.profiles(id) on delete restrict,
  source_kind text not null check (source_kind in ('ocr','human_edit')),
  draft_payload jsonb not null check (
    jsonb_typeof(draft_payload)='object'
    and draft_payload->'authoritative' = 'false'::jsonb
    and draft_payload->'humanReviewRequired' = 'true'::jsonb
  ),
  review_state text not null check (review_state in ('needs_review','reviewed','rejected')),
  review_note text check (review_note is null or (length(trim(review_note)) between 1 and 500 and octet_length(review_note)<=2000)),
  created_at timestamptz not null default now(),
  unique (ocr_attempt_id, version)
);
alter table app.paper_card_transcription_draft_versions enable row level security;
alter table app.paper_card_transcription_draft_versions force row level security;
revoke all on table app.paper_card_transcription_draft_versions from public, anon, authenticated;
create trigger paper_card_transcription_drafts_immutable before update or delete on app.paper_card_transcription_draft_versions
for each row execute function app.reject_immutable_history();
create index paper_card_transcription_drafts_tournament_idx on app.paper_card_transcription_draft_versions(tournament_id, created_at desc);
create index paper_card_transcription_drafts_editor_idx on app.paper_card_transcription_draft_versions(editor_profile_id);

comment on table app.paper_card_transcription_draft_versions is
  'Non-authoritative OCR/human transcription drafts. Existing independent cross-check operations remain the only route to verified games.';
