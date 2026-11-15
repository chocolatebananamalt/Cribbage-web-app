\set ON_ERROR_STOP on
\if :{?scenario}
\else
\echo 'ERROR: scenario psql variable is required'
select 1/0;
\endif

select :'scenario' in ('start_reopen','desk_start','qr_close','start_enrollment','repeated_start') as valid_scenario \gset
\if :valid_scenario
\else
\echo 'ERROR: unknown 0236 race scenario'
select 1/0;
\endif

begin;
select clock_timestamp() as wait_started \gset

select :'scenario'='start_reopen' as run_case \gset
\if :run_case
select public.open_event_check_in_window_v1(
  'a2370000-0000-4000-8000-000000000001','b2370000-0000-4000-8000-000000000001',
  'e2370000-0000-4000-8000-000000000001','52370000-0000-4000-8000-000000000102'
) as rpc_response \gset
select :'rpc_response'::jsonb->>'code'='event_already_started' as rpc_ok \gset
\endif

select :'scenario'='desk_start' as run_case \gset
\if :run_case
select public.start_event_play_v1(
  'a2370000-0000-4000-8000-000000000001','b2370000-0000-4000-8000-000000000001',
  'e2370000-0000-4000-8000-000000000002','42370000-0000-4000-8000-000000000002',
  app.event_participant_snapshot_digest_v1('e2370000-0000-4000-8000-000000000002'),2,1,true,
  '52370000-0000-4000-8000-000000000202'
) as rpc_response \gset
select :'rpc_response'::jsonb->>'code'='attendance_or_seating_incomplete' as rpc_ok \gset
\endif

select :'scenario'='qr_close' as run_case \gset
\if :run_case
select public.close_event_check_in_window_v1(
  'a2370000-0000-4000-8000-000000000001','b2370000-0000-4000-8000-000000000001',
  'e2370000-0000-4000-8000-000000000003','52370000-0000-4000-8000-000000000302'
) as rpc_response \gset
select :'rpc_response'::jsonb->>'status'='event_check_in_closed' as rpc_ok \gset
\endif

select :'scenario'='start_enrollment' as run_case \gset
\if :run_case
select public.enroll_roster_entries_in_event_v3(
  'a2370000-0000-4000-8000-000000000001','b2370000-0000-4000-8000-000000000001',
  'e2370000-0000-4000-8000-000000000004',jsonb_build_array('f2370000-0000-4000-8000-000000000403'),
  '52370000-0000-4000-8000-000000000402'
) as rpc_response \gset
select :'rpc_response'::jsonb->>'code'='event_already_started' as rpc_ok \gset
\endif

select :'scenario'='repeated_start' as run_case \gset
\if :run_case
select public.start_event_play_v1(
  'a2370000-0000-4000-8000-000000000001','b2370000-0000-4000-8000-000000000001',
  'e2370000-0000-4000-8000-000000000005','42370000-0000-4000-8000-000000000005',
  app.event_participant_snapshot_digest_v1('e2370000-0000-4000-8000-000000000005'),2,1,true,
  '52370000-0000-4000-8000-000000000502'
) as rpc_response \gset
select :'rpc_response'::jsonb->>'code'='event_already_started' as first_rejection_ok \gset
select response_payload as accepted_response from app.operation_receipts
where actor_profile_id='a2370000-0000-4000-8000-000000000001' and client_operation_id='52370000-0000-4000-8000-000000000501' \gset
select public.start_event_play_v1(
  'a2370000-0000-4000-8000-000000000001','b2370000-0000-4000-8000-000000000001',
  'e2370000-0000-4000-8000-000000000005','42370000-0000-4000-8000-000000000005',
  app.event_participant_snapshot_digest_v1('e2370000-0000-4000-8000-000000000005'),2,1,true,
  '52370000-0000-4000-8000-000000000501'
) as retry_response \gset
select :'first_rejection_ok'::boolean and :'retry_response'::jsonb=:'accepted_response'::jsonb as rpc_ok \gset
\endif

select extract(epoch from clock_timestamp()-:'wait_started'::timestamptz)>=2 as lifecycle_waited \gset
\if :lifecycle_waited
\else
\echo 'ERROR: session B did not wait for the competing RPC transaction'
select 1/0;
\endif
\if :rpc_ok
\else
\echo 'ERROR: session B RPC returned an unexpected response'
select 1/0;
\endif

-- Persisted-state and append-only cardinality assertions for each race.
select :'scenario'='start_reopen' as run_case \gset
\if :run_case
select
  (select count(*) from app.event_play_starts where event_id='e2370000-0000-4000-8000-000000000001')=1
  and (select count(*) from app.operation_receipts where actor_profile_id='a2370000-0000-4000-8000-000000000001' and client_operation_id='52370000-0000-4000-8000-000000000101')=1
  and (select count(*) from app.operation_receipts where actor_profile_id='a2370000-0000-4000-8000-000000000001' and client_operation_id='52370000-0000-4000-8000-000000000102')=0
  and (select count(*) from app.audit_events where tournament_id='b2370000-0000-4000-8000-000000000001' and action='event_play_started' and entity_id in(select id from app.event_play_starts where event_id='e2370000-0000-4000-8000-000000000001'))=1
  and (select state='closed' and version=2 from app.event_check_in_windows where event_id='e2370000-0000-4000-8000-000000000001')
  as persisted_ok \gset
\endif

select :'scenario'='desk_start' as run_case \gset
\if :run_case
select
  (select count(*) from app.event_play_starts where event_id='e2370000-0000-4000-8000-000000000002')=0
  and (select state='open' and version=1 from app.event_check_in_windows where event_id='e2370000-0000-4000-8000-000000000002')
  and (select state='checked_in' from app.event_check_in_events where event_id='e2370000-0000-4000-8000-000000000002' and roster_entry_id='f2370000-0000-4000-8000-000000000202' order by version desc limit 1)
  and (select status='checked_in' from app.event_participants where event_id='e2370000-0000-4000-8000-000000000002' and roster_entry_id='f2370000-0000-4000-8000-000000000202')
  and (select count(*) from app.operation_receipts where actor_profile_id='a2370000-0000-4000-8000-000000000001' and client_operation_id='52370000-0000-4000-8000-000000000201')=1
  and (select count(*) from app.operation_receipts where actor_profile_id='a2370000-0000-4000-8000-000000000001' and client_operation_id='52370000-0000-4000-8000-000000000202')=0
  and (select count(*) from app.audit_events where operation_receipt_id=(select id from app.operation_receipts where actor_profile_id='a2370000-0000-4000-8000-000000000001' and client_operation_id='52370000-0000-4000-8000-000000000201'))=1
  as persisted_ok \gset
\endif

select :'scenario'='qr_close' as run_case \gset
\if :run_case
select
  (select state='closed' and version=2 from app.event_check_in_windows where event_id='e2370000-0000-4000-8000-000000000003')
  and (select state='checked_in' and source='qr' from app.event_check_in_events where event_id='e2370000-0000-4000-8000-000000000003' and roster_entry_id='f2370000-0000-4000-8000-000000000302' order by version desc limit 1)
  and (select request_state='checked_in' from app.event_check_in_requests where event_id='e2370000-0000-4000-8000-000000000003' and roster_entry_id='f2370000-0000-4000-8000-000000000302' order by created_at desc limit 1)
  and (select count(*) from app.event_check_in_requests where event_id='e2370000-0000-4000-8000-000000000003' and request_state='pending_desk')=0
  and (select count(*) from app.operation_receipts where actor_profile_id='a2370000-0000-4000-8000-000000000001' and client_operation_id='52370000-0000-4000-8000-000000000302')=1
  and (select count(*) from app.audit_events where operation_receipt_id=(select id from app.operation_receipts where actor_profile_id='a2370000-0000-4000-8000-000000000001' and client_operation_id='52370000-0000-4000-8000-000000000302'))=1
  as persisted_ok \gset
\endif

select :'scenario'='start_enrollment' as run_case \gset
\if :run_case
select
  (select count(*) from app.event_play_starts where event_id='e2370000-0000-4000-8000-000000000004')=1
  and (select count(*) from app.event_participants where event_id='e2370000-0000-4000-8000-000000000004')=2
  and (select count(*) from app.operation_receipts where actor_profile_id='a2370000-0000-4000-8000-000000000001' and client_operation_id='52370000-0000-4000-8000-000000000401')=1
  and (select count(*) from app.operation_receipts where actor_profile_id='a2370000-0000-4000-8000-000000000001' and client_operation_id='52370000-0000-4000-8000-000000000402' and outcome='rejected')=1
  and (select count(*) from app.audit_events where operation_receipt_id=(select id from app.operation_receipts where actor_profile_id='a2370000-0000-4000-8000-000000000001' and client_operation_id='52370000-0000-4000-8000-000000000402') and action='event_roster_enrollment_rejected')=1
  as persisted_ok \gset
\endif

select :'scenario'='repeated_start' as run_case \gset
\if :run_case
select
  (select count(*) from app.event_play_starts where event_id='e2370000-0000-4000-8000-000000000005')=1
  and (select count(*) from app.operation_receipts where actor_profile_id='a2370000-0000-4000-8000-000000000001' and client_operation_id='52370000-0000-4000-8000-000000000501' and outcome='accepted')=1
  and (select count(*) from app.operation_receipts where actor_profile_id='a2370000-0000-4000-8000-000000000001' and client_operation_id='52370000-0000-4000-8000-000000000502')=0
  and (select count(*) from app.audit_events where operation_receipt_id=(select id from app.operation_receipts where actor_profile_id='a2370000-0000-4000-8000-000000000001' and client_operation_id='52370000-0000-4000-8000-000000000501') and action='event_play_started')=1
  as persisted_ok \gset
\endif

\if :persisted_ok
\else
\echo 'ERROR: persisted state or append-only cardinality assertion failed'
select 1/0;
\endif

commit;
\echo EVENT_START_ATTENDANCE_B_COMMITTED_:scenario
