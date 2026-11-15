-- Finalizing Setup remains a server-only lifecycle operation. Replacing the
-- wrapper in 0234 can inherit the project's authenticated default EXECUTE
-- grant, so remove it explicitly and retain only the service boundary.

revoke all on function public.activate_tournament_setup_v2(uuid,uuid,uuid,integer,uuid)
  from public,anon,authenticated;
grant execute on function public.activate_tournament_setup_v2(uuid,uuid,uuid,integer,uuid)
  to service_role;

notify pgrst,'reload schema';
