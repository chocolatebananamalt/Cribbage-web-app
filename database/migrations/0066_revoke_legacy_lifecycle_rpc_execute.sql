-- The v2 wrappers are the only browser-facing lifecycle mutation boundary.
-- Legacy functions remain available to their SECURITY DEFINER wrappers, but
-- authenticated browser sessions must not invoke their unbound result shapes
-- directly through PostgREST.
revoke execute on function public.record_roster_check_in_event(uuid, uuid, text, text, uuid) from authenticated;
revoke execute on function public.publish_initial_seating(uuid, smallint, smallint, jsonb, uuid) from authenticated;
revoke execute on function public.link_roster_entry_to_account(uuid, uuid, uuid, uuid) from authenticated;
revoke execute on function public.enroll_linked_roster_entry_in_event(uuid, uuid, uuid, uuid) from authenticated;
