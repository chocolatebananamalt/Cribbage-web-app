-- Preserve venue and player-facing Tournament Director name parts separately
-- in each immutable setup revision. Existing revisions remain readable and
-- receive blank structured fields; a later draft save records deliberate
-- values without rewriting prior history.

alter table app.tournament_setup_revisions
  add column venue_name text not null default '' check (length(venue_name) <= 160),
  add column venue_street text not null default '' check (length(venue_street) <= 240),
  add column venue_postal_code text not null default '' check (length(venue_postal_code) <= 20),
  add column tournament_director_first_name text not null default '' check (length(tournament_director_first_name) <= 80),
  add column tournament_director_last_name text not null default '' check (length(tournament_director_last_name) <= 80);

create function app.inherit_structured_tournament_details_v1()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_venue_name text:=current_setting('app.setup_venue_name',true);
  v_venue_street text:=current_setting('app.setup_venue_street',true);
  v_venue_postal_code text:=current_setting('app.setup_venue_postal_code',true);
  v_director_first_name text:=current_setting('app.setup_director_first_name',true);
  v_director_last_name text:=current_setting('app.setup_director_last_name',true);
  v_prior app.tournament_setup_revisions%rowtype;
begin
  if v_venue_name is not null and v_venue_street is not null and v_venue_postal_code is not null
     and v_director_first_name is not null and v_director_last_name is not null then
    new.venue_name:=trim(v_venue_name);
    new.venue_street:=trim(v_venue_street);
    new.venue_postal_code:=trim(v_venue_postal_code);
    new.tournament_director_first_name:=trim(v_director_first_name);
    new.tournament_director_last_name:=trim(v_director_last_name);
    return new;
  end if;
  select * into v_prior from app.tournament_setup_revisions
  where tournament_id=new.tournament_id and version<new.version
  order by version desc limit 1;
  if found then
    new.venue_name:=v_prior.venue_name;
    new.venue_street:=v_prior.venue_street;
    new.venue_postal_code:=v_prior.venue_postal_code;
    new.tournament_director_first_name:=v_prior.tournament_director_first_name;
    new.tournament_director_last_name:=v_prior.tournament_director_last_name;
  end if;
  return new;
end $$;
revoke all on function app.inherit_structured_tournament_details_v1() from public,anon,authenticated;
create trigger tournament_setup_revision_structured_details
before insert on app.tournament_setup_revisions
for each row execute function app.inherit_structured_tournament_details_v1();

alter function public.save_tournament_setup_version(uuid,integer,jsonb,uuid)
  rename to save_tournament_setup_version_before_structured_details;
create function public.save_tournament_setup_version(
  p_tournament_id uuid,p_expected_version integer,p_payload jsonb,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_venue_name text; v_venue_street text; v_venue_postal_code text;
  v_director_first_name text; v_director_last_name text;
  v_venue_projection text; v_director_projection text;
begin
  -- Direct legacy database fixtures remain valid. Current application requests
  -- always send all five structured fields and are validated below.
  if not(p_payload ?| array['venueName','venueStreet','venuePostalCode','tournamentDirectorFirstName','tournamentDirectorLastName']) then
    return public.save_tournament_setup_version_before_structured_details(
      p_tournament_id,p_expected_version,p_payload,p_idempotency_key);
  end if;
  if coalesce(jsonb_typeof(p_payload),'')<>'object'
     or not(p_payload ?& array['venueName','venueStreet','venuePostalCode','tournamentDirectorFirstName','tournamentDirectorLastName'])
     or jsonb_typeof(p_payload->'venueName')<>'string'
     or jsonb_typeof(p_payload->'venueStreet')<>'string'
     or jsonb_typeof(p_payload->'venuePostalCode')<>'string'
     or jsonb_typeof(p_payload->'tournamentDirectorFirstName')<>'string'
     or jsonb_typeof(p_payload->'tournamentDirectorLastName')<>'string' then
    return jsonb_build_object('status','rejected','code','invalid_setup_payload');
  end if;
  v_venue_name:=trim(p_payload->>'venueName');
  v_venue_street:=trim(p_payload->>'venueStreet');
  v_venue_postal_code:=trim(p_payload->>'venuePostalCode');
  v_director_first_name:=trim(p_payload->>'tournamentDirectorFirstName');
  v_director_last_name:=trim(p_payload->>'tournamentDirectorLastName');
  v_venue_projection:=v_venue_name||' — '||v_venue_street||' · '||v_venue_postal_code;
  v_director_projection:=v_director_first_name||' '||v_director_last_name;
  if length(v_venue_name) not between 1 and 160
     or length(v_venue_street) not between 1 and 240
     or length(v_venue_postal_code) not between 1 and 20
     or length(v_venue_projection)>240
     or length(v_director_first_name) not between 1 and 80
     or length(v_director_last_name) not between 1 and 80
     or length(v_director_projection)>160
     or p_payload->>'venue'<>v_venue_projection
     or p_payload->>'tournamentDirectorPublicName'<>v_director_projection then
    return jsonb_build_object('status','rejected','code','invalid_setup_payload');
  end if;
  perform set_config('app.setup_venue_name',v_venue_name,true);
  perform set_config('app.setup_venue_street',v_venue_street,true);
  perform set_config('app.setup_venue_postal_code',v_venue_postal_code,true);
  perform set_config('app.setup_director_first_name',v_director_first_name,true);
  perform set_config('app.setup_director_last_name',v_director_last_name,true);
  return public.save_tournament_setup_version_before_structured_details(
    p_tournament_id,p_expected_version,
    p_payload-array['venueName','venueStreet','venuePostalCode','tournamentDirectorFirstName','tournamentDirectorLastName'],
    p_idempotency_key);
end $$;
revoke all on function public.save_tournament_setup_version_before_structured_details(uuid,integer,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.save_tournament_setup_version(uuid,integer,jsonb,uuid) from public,anon;
grant execute on function public.save_tournament_setup_version(uuid,integer,jsonb,uuid) to authenticated;

alter function public.get_tournament_setup_workspace(uuid)
  rename to get_tournament_setup_workspace_before_structured_details;
create function public.get_tournament_setup_workspace(p_tournament_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_base jsonb; v_current jsonb; v_revision app.tournament_setup_revisions%rowtype;
begin
  v_base:=public.get_tournament_setup_workspace_before_structured_details(p_tournament_id);
  if v_base is null then return null; end if;
  v_current:=v_base->'current';
  if v_current='null'::jsonb then return v_base; end if;
  select * into v_revision from app.tournament_setup_revisions
  where tournament_id=p_tournament_id order by version desc limit 1;
  return jsonb_set(v_base,'{current}',v_current||jsonb_build_object(
    'venueName',coalesce(v_revision.venue_name,''),
    'venueStreet',coalesce(v_revision.venue_street,''),
    'venuePostalCode',coalesce(v_revision.venue_postal_code,''),
    'tournamentDirectorFirstName',coalesce(v_revision.tournament_director_first_name,''),
    'tournamentDirectorLastName',coalesce(v_revision.tournament_director_last_name,'')
  ),false);
end $$;
revoke all on function public.get_tournament_setup_workspace_before_structured_details(uuid) from public,anon,authenticated;
revoke all on function public.get_tournament_setup_workspace(uuid) from public,anon;
grant execute on function public.get_tournament_setup_workspace(uuid) to authenticated;
