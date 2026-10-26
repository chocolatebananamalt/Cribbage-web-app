-- Generated with pinned CLI migration new activation_deadline_metadata
-- (20261026095723); adapted to this repository's ordered migration naming.
-- Deploy backward-compatible app FIRST. Replace only the existing read RPC.
-- CREATE OR REPLACE preserves its existing ownership and permissions; there
-- are deliberately no permission changes or mutation-RPC replacements here.
do $$ begin
  if to_regprocedure('public.get_roster_account_activation_salt_v1(uuid)') is null then
    raise exception 'existing activation salt reader required';
  end if;
end $$;

create or replace function public.get_roster_account_activation_salt_v1(p_activation_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_salt bytea; v_expires_at timestamptz;
begin
  perform app.roster_account_activation_service_only();
  if p_activation_id is null then
    return jsonb_build_object('status', 'unavailable');
  end if;
  select token_salt, expires_at into v_salt, v_expires_at from app.roster_account_activations
    where id = p_activation_id and state = 'issued' and expires_at > now();
  if not found then return jsonb_build_object('status', 'unavailable'); end if;
  return jsonb_build_object('status', 'ready', 'activationId', p_activation_id,
    'saltBase64', encode(v_salt, 'base64'), 'expiresAt', v_expires_at);
end;
$$;
