-- An event with an odd number of checked-in players could not be scheduled at
-- all. publish_director_reviewed_event_schedule_core_v1 refused outright:
--
--   if v_participant_count < 2 or mod(v_participant_count, 2) <> 0 ...
--     raise exception 'participants unavailable'
--
-- and reported it as `participants_unavailable`, which names neither the count
-- nor the parity. A seven player event simply could not start, and the screen
-- did not say why.
--
-- With an odd field exactly one player sits out each game. That means a game
-- seats one fewer than the whole field, so the three per-game equality checks,
-- which each compared against the full participant count, have to compare
-- against the number of players actually seated: 2 * (count / 2). Integer
-- division floors, so for an even field 2 * (n / 2) = n and every one of these
-- checks keeps its current meaning exactly. Nothing changes for an even event.
--
-- The total match count line already floors correctly, because v_participant_count
-- is an integer and `/` is integer division: 7 / 2 * 12 = 36. It is left alone.
--
-- What this does NOT do: it does not choose who sits out, and it does not
-- compensate anybody for sitting out. The schedule is supplied by the director
-- as a CSV, so the director decides the byes. A player who sits out a game
-- simply has no row for it and earns nothing that game, so byes must be rotated
-- by hand or one player finishes a game short. There is no bye concept anywhere
-- in this schema and this migration does not add one.
--
-- Replacement is done against the live definition rather than by restating the
-- function, which is over 150 lines and was last rewritten by 0115. Each edit
-- asserts its exact target text is present, and the expected number of
-- occurrences, so this migration either makes precisely these changes or fails.

do $do$
declare
  v_def text;
  v_new text;
  v_parity text := ' or mod(v_participant_count, 2) <> 0';
  v_count_old text := 'having count(*) <> v_participant_count or count(distinct verification_id) <> v_participant_count
        or count(distinct table_seat) <> v_participant_count';
  v_count_new text := 'having count(*) <> 2 * (v_participant_count / 2) or count(distinct verification_id) <> 2 * (v_participant_count / 2)
        or count(distinct table_seat) <> 2 * (v_participant_count / 2)';
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'app' and p.proname = 'publish_director_reviewed_event_schedule_core_v1' and p.prokind = 'f';

  if v_def is null then
    raise exception 'app.publish_director_reviewed_event_schedule_core_v1 does not exist; run 0114 and 0115 first';
  end if;

  if position(v_parity in v_def) = 0 and position(v_count_new in v_def) > 0 then
    raise notice 'already applied';
    return;
  end if;

  if position(v_parity in v_def) = 0 then
    raise exception 'the parity guard was not found verbatim; refusing to guess at a replacement';
  end if;
  if position(v_count_new in v_def) > 0 then
    raise exception 'the per-game checks are already widened but the parity guard remains; refusing a partial state';
  end if;
  if position(v_count_old in v_def) = 0 then
    raise exception 'the per-game equality checks were not found verbatim; refusing to guess at a replacement';
  end if;

  -- Each target must appear exactly once, or a blind replace would edit
  -- something this migration has not reasoned about.
  if (length(v_def) - length(replace(v_def, v_parity, ''))) / length(v_parity) <> 1 then
    raise exception 'expected exactly one parity guard';
  end if;
  if (length(v_def) - length(replace(v_def, v_count_old, ''))) / length(v_count_old) <> 1 then
    raise exception 'expected exactly one per-game check block';
  end if;

  v_new := replace(v_def, v_parity, '');
  v_new := replace(v_new, v_count_old, v_count_new);

  if v_new = v_def then
    raise exception 'replacement produced no change';
  end if;

  execute v_new;
end
$do$;

notify pgrst,'reload schema';
