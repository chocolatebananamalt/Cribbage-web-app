-- Rollback-only hosted proof for migration 0136. All identities are fictional.
begin;

insert into auth.users(id, email) values
  ('a1360000-0000-4000-8000-000000000001', 'review-director@test.invalid'),
  ('a1360000-0000-4000-8000-000000000002', 'review-outsider@test.invalid');

insert into app.tournaments(id, director_profile_id, name, status, registration_status)
values ('b1360000-0000-4000-8000-000000000001', 'a1360000-0000-4000-8000-000000000001', 'Review Authority Fixture', 'open', 'open');

insert into app.tournament_roles(tournament_id, profile_id, role)
values ('b1360000-0000-4000-8000-000000000001', 'a1360000-0000-4000-8000-000000000001', 'director');

insert into app.tournament_registration_links(
  id, tournament_id, token_hash, created_by_profile_id, enabled,
  max_claims, max_claims_per_hour, token_version, token_salt, token_digest,
  lifecycle_state, issued_at, expires_at
) values (
  'c1360000-0000-4000-8000-000000000001', 'b1360000-0000-4000-8000-000000000001', null,
  'a1360000-0000-4000-8000-000000000001', true, 10, 10, 2,
  decode(repeat('11', 32), 'hex'), decode(repeat('22', 32), 'hex'),
  'issued', now(), now() + interval '1 day'
);

insert into app.registration_claims(
  id, tournament_id, registration_link_id, display_name, normalized_name,
  email, normalized_email, intended_payment_method, status,
  client_operation_id, request_fingerprint
) values (
  'd1360000-0000-4000-8000-000000000001', 'b1360000-0000-4000-8000-000000000001',
  'c1360000-0000-4000-8000-000000000001', 'Review Test Player', 'review test player',
  'review-player@test.invalid', 'review-player@test.invalid', 'unspecified', 'pending_review',
  'e1360000-0000-4000-8000-000000000001', repeat('a', 64)
);

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a1360000-0000-4000-8000-000000000001', true);
set local role authenticated;

do $$
declare first_result jsonb; replay_result jsonb;
begin
  first_result := public.review_registration_claim(
    'b1360000-0000-4000-8000-000000000001', 'd1360000-0000-4000-8000-000000000001',
    'approved_for_roster', null, null, '', 'f1360000-0000-4000-8000-000000000001'
  );
  replay_result := public.review_registration_claim(
    'b1360000-0000-4000-8000-000000000001', 'd1360000-0000-4000-8000-000000000001',
    'approved_for_roster', null, null, '', 'f1360000-0000-4000-8000-000000000001'
  );
  if first_result <> replay_result or first_result->>'status' <> 'approved_for_roster'
    or first_result->>'rosterCreated' <> 'false' then
    raise exception 'authorized review or exact replay failed';
  end if;
end;
$$;

reset role;
delete from app.tournament_roles
where tournament_id = 'b1360000-0000-4000-8000-000000000001'
  and profile_id = 'a1360000-0000-4000-8000-000000000001';

set local role authenticated;
do $$
declare revoked_result jsonb;
begin
  revoked_result := public.review_registration_claim(
    'b1360000-0000-4000-8000-000000000001', 'd1360000-0000-4000-8000-000000000001',
    'approved_for_roster', null, null, '', 'f1360000-0000-4000-8000-000000000001'
  );
  if revoked_result <> jsonb_build_object('status', 'rejected', 'code', 'not_director', 'claimId', 'd1360000-0000-4000-8000-000000000001') then
    raise exception 'revoked director received replay disclosure';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', 'a1360000-0000-4000-8000-000000000002', true);
set local role authenticated;
do $$
declare outsider_result jsonb;
begin
  outsider_result := public.review_registration_claim(
    'b1360000-0000-4000-8000-000000000001', 'd1360000-0000-4000-8000-000000000001',
    'rejected', null, null, '', 'f1360000-0000-4000-8000-000000000002'
  );
  if outsider_result <> jsonb_build_object('status', 'rejected', 'code', 'not_director', 'claimId', 'd1360000-0000-4000-8000-000000000001') then
    raise exception 'outsider registration review was not denied';
  end if;
end;
$$;

reset role;
do $$
begin
  if (select count(*) from app.operation_receipts where tournament_id = 'b1360000-0000-4000-8000-000000000001' and operation_type = 'review_registration_claim') <> 1
    or (select count(*) from app.audit_events where tournament_id = 'b1360000-0000-4000-8000-000000000001' and action like 'registration_claim_review%') <> 1
    or (select count(*) from app.registration_claim_operation_conflicts where tournament_id = 'b1360000-0000-4000-8000-000000000001') <> 0 then
    raise exception 'unauthorized registration review created durable noise';
  end if;
end;
$$;

set constraints all immediate;
rollback;
