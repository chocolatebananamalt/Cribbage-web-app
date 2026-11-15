-- Preserve the correction UI's short-reason limit at the database boundary.
-- This trigger also covers authenticated direct RPC callers, while leaving
-- immutable historical rows untouched.

create or replace function app.enforce_correction_reason_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.reason is not null
    and (pg_catalog.char_length(new.reason) > 500 or pg_catalog.octet_length(new.reason) > 2000) then
    raise exception using errcode = 'P0001', message = 'correction reason too long';
  end if;
  return new;
end;
$$;

revoke all on function app.enforce_correction_reason_limit() from public, anon, authenticated;
drop trigger if exists game_corrections_reason_limit on app.game_corrections;
create trigger game_corrections_reason_limit
before insert on app.game_corrections
for each row execute function app.enforce_correction_reason_limit();
