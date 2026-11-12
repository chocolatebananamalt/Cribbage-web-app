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

select :'scenario'='start_reopen' as run_case \gset
\if :run_case
select public.start_event_play_v1(
  'a2370000-0000-4000-8000-000000000001','b2370000-0000-4000-8000-000000000001',
  'e2370000-0000-4000-8000-000000000001','42370000-0000-4000-8000-000000000001',
  app.event_participant_snapshot_digest_v1('e2370000-0000-4000-8000-000000000001'),2,1,true,
  '52370000-0000-4000-8000-000000000101'
) as rpc_response \gset
select :'rpc_response'::jsonb->>'status'='event_started' as rpc_ok \gset
\endif

select :'scenario'='desk_start' as run_case \gset
\if :run_case
select public.desk_check_in_event_v1(
  'a2370000-0000-4000-8000-000000000001','b2370000-0000-4000-8000-000000000001',
  'e2370000-0000-4000-8000-000000000002','f2370000-0000-4000-8000-000000000202',
  '52370000-0000-4000-8000-000000000201'
) as rpc_response \gset
select :'rpc_response'::jsonb->>'status'='checked_in' as rpc_ok \gset
\endif

select :'scenario'='qr_close' as run_case \gset
\if :run_case
select public.submit_event_check_in_completion_v1(
  '62370000-0000-4000-8000-000000000302','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'Race','Three B','race-3b@test.invalid','HI23706'
) as rpc_response \gset
select :'rpc_response'::jsonb->>'status'='checked_in' as rpc_ok \gset
\endif

select :'scenario'='start_enrollment' as run_case \gset
\if :run_case
select public.start_event_play_v1(
  'a2370000-0000-4000-8000-000000000001','b2370000-0000-4000-8000-000000000001',
  'e2370000-0000-4000-8000-000000000004','42370000-0000-4000-8000-000000000004',
  app.event_participant_snapshot_digest_v1('e2370000-0000-4000-8000-000000000004'),2,1,true,
  '52370000-0000-4000-8000-000000000401'
) as rpc_response \gset
select :'rpc_response'::jsonb->>'status'='event_started' as rpc_ok \gset
\endif

select :'scenario'='repeated_start' as run_case \gset
\if :run_case
select public.start_event_play_v1(
  'a2370000-0000-4000-8000-000000000001','b2370000-0000-4000-8000-000000000001',
  'e2370000-0000-4000-8000-000000000005','42370000-0000-4000-8000-000000000005',
  app.event_participant_snapshot_digest_v1('e2370000-0000-4000-8000-000000000005'),2,1,true,
  '52370000-0000-4000-8000-000000000501'
) as rpc_response \gset
select :'rpc_response'::jsonb->>'status'='event_started' as rpc_ok \gset
\endif

\if :rpc_ok
\else
\echo 'ERROR: session A RPC returned an unexpected response'
select 1/0;
\endif

\echo EVENT_START_ATTENDANCE_A_READY_:scenario
select pg_sleep(4);
commit;
\echo EVENT_START_ATTENDANCE_A_COMMITTED_:scenario
