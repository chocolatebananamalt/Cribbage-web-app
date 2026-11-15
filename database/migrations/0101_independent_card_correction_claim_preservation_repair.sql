-- Rule 12.2 original card claims are not necessarily reciprocal. The linked
-- canonical scoreline identifies the game/card only; it must not overwrite or
-- constrain the separately preserved original claim on a correction projection.

alter table app.independent_card_correction_projections
  rename column original_scoreline_id to canonical_scoreline_id;

drop index if exists app.independent_card_correction_projections_scoreline_idx;
create index independent_card_correction_projections_canonical_scoreline_idx
  on app.independent_card_correction_projections(canonical_scoreline_id, canonical_game_id);

create or replace function app.assert_independent_card_correction_projection()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_scoreline app.card_scorelines%rowtype;
begin
  select * into v_scoreline
  from app.card_scorelines s
  where s.id = new.canonical_scoreline_id
    and s.canonical_game_id = new.canonical_game_id
    and s.tournament_id = new.tournament_id
    and s.event_id = new.event_id;

  if not found then
    raise exception 'canonical scoreline scope unavailable';
  end if;
  if new.card_side <> v_scoreline.side then
    raise exception 'correction card side must match canonical scoreline';
  end if;
  if new.original_plus_points <> (case when new.original_is_winner then new.original_margin else 0 end)
    or new.original_minus_points <> (case when new.original_is_winner then 0 else new.original_margin end)
    or new.original_game_points <> (case when new.original_is_winner then (case when new.original_margin >= 31 then 3 else 2 end) else 0 end) then
    raise exception 'correction original claim is internally inconsistent';
  end if;
  if new.adjudicated_plus_points <> (case when new.adjudicated_is_winner then new.adjudicated_margin else 0 end)
    or new.adjudicated_minus_points <> (case when new.adjudicated_is_winner then 0 else new.adjudicated_margin end)
    or new.adjudicated_game_points <> (case when new.adjudicated_is_winner then (case when new.adjudicated_margin >= 31 then 3 else 2 end) else 0 end) then
    raise exception 'correction adjudicated score is internally inconsistent';
  end if;
  return new;
end;
$$;
