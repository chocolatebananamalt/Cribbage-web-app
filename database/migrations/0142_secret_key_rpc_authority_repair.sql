-- Supabase scoped secret API keys authorize requests as the service_role
-- database role but do not populate the legacy request.jwt.claim.role GUC.
-- EXECUTE is already revoked from public/anon/authenticated and granted only
-- to service_role for every function below. Remove the obsolete secondary GUC
-- check while retaining the actor, tournament, role, scope, and replay checks.

do $$
declare
  target_function regprocedure;
  definition text;
  repaired text;
begin
  foreach target_function in array array[
    'public.open_event_dispute_v1(uuid,uuid,uuid,uuid,uuid,text,uuid)'::regprocedure,
    'public.resolve_event_dispute_v1(uuid,uuid,text,uuid)'::regprocedure,
    'public.get_event_dispute_workspace_v1(uuid,uuid,uuid)'::regprocedure,
    'public.finalize_standard_singles_qualification_v1(uuid,uuid,uuid,uuid)'::regprocedure,
    'public.save_standard_singles_settlement_draft_v3(uuid,uuid,uuid,uuid,uuid,integer,jsonb,jsonb,jsonb,uuid)'::regprocedure,
    'public.get_standard_singles_settlement_reconciliation_v3(uuid,uuid,uuid,uuid)'::regprocedure
  ] loop
    -- Dashboard-applied migrations can preserve CRLF inside function bodies;
    -- normalize before matching so the repair is deterministic on every host.
    definition := replace(pg_get_functiondef(target_function), chr(13) || chr(10), chr(10));
    repaired := definition;
    repaired := replace(repaired,
      E'  if coalesce(current_setting(''request.jwt.claim.role'', true), '''') <> ''service_role'' then\n    raise exception using errcode = ''P0001'', message = ''server-only event dispute'';\n  end if;\n',
      E'  -- Server-only authority is enforced by the EXECUTE grant.\n');
    repaired := replace(repaired,
      E'  if coalesce(current_setting(''request.jwt.claim.role'', true), '''') <> ''service_role'' then return null; end if;\n',
      E'  -- Server-only authority is enforced by the EXECUTE grant.\n');
    repaired := replace(repaired,
      E'  if coalesce(current_setting(''request.jwt.claim.role'', true), '''') <> ''service_role'' then\n    raise exception using errcode = ''P0001'', message = ''server-only qualification finalization'';\n  end if;\n',
      E'  -- Server-only authority is enforced by the EXECUTE grant.\n');
    repaired := replace(repaired,
      E'  if coalesce(current_setting(''request.jwt.claim.role'',true),'''')<>''service_role'' then\n    raise exception using errcode=''P0001'',message=''server-only settlement working copy'';\n  end if;\n',
      E'  -- Server-only authority is enforced by the EXECUTE grant.\n');
    repaired := replace(repaired,
      'select case when coalesce(current_setting(''request.jwt.claim.role'',true),'''')=''service_role''
    and exists(',
      'select case when exists(');

    if repaired <> definition then
      execute repaired;
    end if;
    if pg_get_functiondef(target_function) like '%current_setting(''request.jwt.claim.role''%' then
      raise exception 'legacy JWT-role guard remains on %', target_function;
    end if;
  end loop;
end
$$;

revoke all on function public.open_event_dispute_v1(uuid,uuid,uuid,uuid,uuid,text,uuid)
  from public, anon, authenticated;
revoke all on function public.resolve_event_dispute_v1(uuid,uuid,text,uuid)
  from public, anon, authenticated;
revoke all on function public.get_event_dispute_workspace_v1(uuid,uuid,uuid)
  from public, anon, authenticated;
revoke all on function public.finalize_standard_singles_qualification_v1(uuid,uuid,uuid,uuid)
  from public, anon, authenticated;
revoke all on function public.save_standard_singles_settlement_draft_v3(uuid,uuid,uuid,uuid,uuid,integer,jsonb,jsonb,jsonb,uuid)
  from public, anon, authenticated;
revoke all on function public.get_standard_singles_settlement_reconciliation_v3(uuid,uuid,uuid,uuid)
  from public, anon, authenticated;

grant execute on function public.open_event_dispute_v1(uuid,uuid,uuid,uuid,uuid,text,uuid) to service_role;
grant execute on function public.resolve_event_dispute_v1(uuid,uuid,text,uuid) to service_role;
grant execute on function public.get_event_dispute_workspace_v1(uuid,uuid,uuid) to service_role;
grant execute on function public.finalize_standard_singles_qualification_v1(uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.save_standard_singles_settlement_draft_v3(uuid,uuid,uuid,uuid,uuid,integer,jsonb,jsonb,jsonb,uuid) to service_role;
grant execute on function public.get_standard_singles_settlement_reconciliation_v3(uuid,uuid,uuid,uuid) to service_role;

notify pgrst, 'reload schema';
