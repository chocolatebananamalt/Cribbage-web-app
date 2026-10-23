\if :{?event_id}
\else
\echo 'ERROR: event_id psql variable is required'
select 1/0;
\endif

begin;
select clock_timestamp() as lock_wait_started \gset
select app.lock_event_attendance_lifecycle_v1(:'event_id'::uuid);
select extract(epoch from clock_timestamp()-:'lock_wait_started'::timestamptz)>=2 as lifecycle_waited \gset
\if :lifecycle_waited
select 'session_b_waited_for_event_lifecycle_lock' as assertion;
\else
\echo 'ERROR: shared lifecycle lock did not serialize sessions for at least two seconds'
select 1/0;
\endif
rollback;
