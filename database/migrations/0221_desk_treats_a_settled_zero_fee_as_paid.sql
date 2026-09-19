-- 0219 made the money gate treat a settled balance as settled, so a comped or
-- zero fee player passes app.event_qr_player_is_paid_and_enrolled and can check
-- in. The desk screen was left behind: its "Check in at desk" button is disabled
-- on `!row.paid` (src/app/tournament/[tournamentId]/event-check-in/
-- event-check-in-client.tsx:89), and `paid` is computed independently inside
-- get_event_check_in_workspace_v1 using the older strict form:
--
--   'paid', coalesce(payment.event_type='received'
--                    and payment.amount_minor >= obligation.amount_owed_minor, false)
--
-- For a player who owes 0 and has no payment row, payment.event_type is null, so
-- the whole comparison is null and coalesce yields false. The button greys out
-- permanently. There is no way out from the UI either: dollarsToMinor requires
-- cents > 0 (payments/payment-client.tsx:19), so a 0 dollar receipt cannot be
-- recorded to satisfy it. The database would have allowed the check-in; only the
-- screen refused.
--
-- This aligns `paid` with the gate. An obligation row must still exist, which is
-- what the gate requires, so a player with no fee configured keeps showing as
-- unpaid rather than silently becoming checkable.
--
--   no obligation row      -> false  (unchanged, matches the gate)
--   owes 0, nothing paid   -> TRUE   (was false, this is the fix)
--   owes 25, paid 25       -> true   (unchanged)
--   owes 25, paid then void-> false  (unchanged, the 0219 void fix is preserved)
--
-- The replacement is done against the live definition rather than by restating
-- the whole function, because get_event_check_in_workspace_v1 is a single ~4000
-- character expression that 0217 and 0218 both rewrote. Restating it here would
-- risk a transcription error silently reverting one of them. The assertion below
-- means this migration either changes exactly that one expression or fails.

do $do$
declare
  v_def text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'get_event_check_in_workspace_v1' and p.prokind = 'f';

  if v_def is null then
    raise exception 'get_event_check_in_workspace_v1 does not exist; run 0217 and 0218 first';
  end if;

  v_old := '''paid'',coalesce(payment.event_type=''received'' and payment.amount_minor>=obligation.amount_owed_minor,false)';
  v_new := '''paid'',(obligation.amount_owed_minor is not null and coalesce(case when payment.event_type=''received'' then payment.amount_minor else 0 end,0)>=obligation.amount_owed_minor)';

  if position(v_old in v_def) = 0 then
    if position(v_new in v_def) > 0 then
      raise notice 'already applied';
      return;
    end if;
    raise exception 'the paid expression was not found verbatim; refusing to guess at a replacement';
  end if;

  execute replace(v_def, v_old, v_new);
end
$do$;

notify pgrst,'reload schema';
