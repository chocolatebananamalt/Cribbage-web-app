-- Harden the inert Rule 12.2 projection foundation before any correction
-- writer exists. This does not create a reader, writer, or execute grant.

create or replace function app.assert_independent_card_correction_sequence()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_game_version integer;
  v_expected_sequence integer;
begin
  select g.version into v_game_version
  from app.canonical_games g
  where g.id = new.canonical_game_id
    and g.tournament_id = new.tournament_id
    and g.event_id = new.event_id
  for update;

  if v_game_version is null then
    raise exception 'correction game scope unavailable';
  end if;
  if new.base_game_version <> v_game_version then
    raise exception 'correction base game version is stale';
  end if;

  select coalesce(max(c.correction_sequence), 0) + 1 into v_expected_sequence
  from app.independent_card_corrections c
  where c.canonical_game_id = new.canonical_game_id
    and c.tournament_id = new.tournament_id
    and c.event_id = new.event_id;
  if new.correction_sequence <> v_expected_sequence then
    raise exception 'correction sequence must be next for game';
  end if;
  return new;
end;
$$;

create or replace function app.assert_independent_card_correction_projection()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_scoreline app.card_scorelines%rowtype;
begin
  select * into v_scoreline
  from app.card_scorelines s
  where s.id = new.original_scoreline_id
    and s.canonical_game_id = new.canonical_game_id
    and s.tournament_id = new.tournament_id
    and s.event_id = new.event_id;

  if not found then
    raise exception 'original scoreline scope unavailable';
  end if;
  if new.card_side <> v_scoreline.side then
    raise exception 'correction card side must match original scoreline';
  end if;
  if new.original_is_winner is distinct from v_scoreline.is_winner
    or new.original_margin is distinct from v_scoreline.margin
    or new.original_plus_points is distinct from v_scoreline.plus_points
    or new.original_minus_points is distinct from v_scoreline.minus_points
    or new.original_game_points is distinct from v_scoreline.game_points then
    raise exception 'correction original snapshot does not match scoreline';
  end if;
  if new.adjudicated_plus_points <> (case when new.adjudicated_is_winner then new.adjudicated_margin else 0 end)
    or new.adjudicated_minus_points <> (case when new.adjudicated_is_winner then 0 else new.adjudicated_margin end)
    or new.adjudicated_game_points <> (case when new.adjudicated_is_winner then (case when new.adjudicated_margin >= 31 then 3 else 2 end) else 0 end) then
    raise exception 'correction adjudicated score is internally inconsistent';
  end if;
  return new;
end;
$$;

create or replace function app.assert_independent_card_correction_complete()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_correction_id uuid;
  v_projection_count integer;
  v_side_count integer;
begin
  if tg_table_name = 'independent_card_corrections' then
    v_correction_id := new.id;
  else
    v_correction_id := new.correction_id;
  end if;
  select count(*), count(distinct p.card_side)
    into v_projection_count, v_side_count
  from app.independent_card_correction_projections p
  where p.correction_id = v_correction_id;
  if v_projection_count <> 2 or v_side_count <> 2 then
    raise exception 'correction requires exactly two independent card projections';
  end if;
  return null;
end;
$$;

create trigger independent_card_corrections_sequence
before insert on app.independent_card_corrections
for each row execute function app.assert_independent_card_correction_sequence();

create trigger independent_card_correction_projections_match_original
before insert on app.independent_card_correction_projections
for each row execute function app.assert_independent_card_correction_projection();

create constraint trigger independent_card_corrections_complete
after insert on app.independent_card_corrections
deferrable initially deferred
for each row execute function app.assert_independent_card_correction_complete();

create constraint trigger independent_card_correction_projections_complete
after insert on app.independent_card_correction_projections
deferrable initially deferred
for each row execute function app.assert_independent_card_correction_complete();

revoke all on function app.assert_independent_card_correction_sequence() from public, anon, authenticated;
revoke all on function app.assert_independent_card_correction_projection() from public, anon, authenticated;
revoke all on function app.assert_independent_card_correction_complete() from public, anon, authenticated;
