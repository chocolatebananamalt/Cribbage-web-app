-- Cookie-facing wrapper proposal; the private function independently checks role
-- and its literal-false gate. No installation or enablement implied.
begin;
create function public.get_satellite_recorded_reconciliation_v1(p_tournament_id uuid,p_event_id uuid)returns jsonb language sql volatile security definer set search_path=''as $$select app.get_satellite_recorded_reconciliation_v1(p_tournament_id,p_event_id)$$;
alter function public.get_satellite_recorded_reconciliation_v1(uuid,uuid)owner to postgres;
revoke all on function public.get_satellite_recorded_reconciliation_v1(uuid,uuid)from public,anon,service_role;
grant execute on function public.get_satellite_recorded_reconciliation_v1(uuid,uuid)to authenticated;
commit;
