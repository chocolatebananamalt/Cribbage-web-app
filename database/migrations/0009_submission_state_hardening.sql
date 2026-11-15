-- Keep canonical game state truthful after the first accepted submission in
-- the already-migrated pilot. Direct client table writes remain revoked.

create or replace function app.mark_game_submitted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update app.canonical_games
  set state = 'submitted', version = version + 1
  where id = new.canonical_game_id and state = 'pending';
  return new;
end;
$$;

revoke all on function app.mark_game_submitted() from public, anon, authenticated;

drop trigger if exists mark_game_submitted on app.score_submissions;
create trigger mark_game_submitted
after insert on app.score_submissions
for each row execute function app.mark_game_submitted();
