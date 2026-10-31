\if :{?event_id}
\else
\echo 'ERROR: event_id psql variable is required'
select 1/0;
\endif

begin;
select app.lock_event_attendance_lifecycle_v1(:'event_id'::uuid);
select pg_sleep(4);
select 'session_a_held_event_lifecycle_lock' as assertion;
rollback;
