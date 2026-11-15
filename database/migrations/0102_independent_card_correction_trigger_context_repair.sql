-- Repair the deferred completeness trigger for the already-applied inert
-- foundation. Each trigger table has a different NEW record shape.

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
