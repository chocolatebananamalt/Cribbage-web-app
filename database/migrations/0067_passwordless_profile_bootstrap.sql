-- Passwordless account creation establishes only a private app profile. It
-- grants no tournament role, roster identity, participant, seat, or payment.
create or replace function app.create_profile_for_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into app.profiles (id, display_name)
  values (new.id, 'Tournament participant')
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function app.create_profile_for_auth_user() from public, anon, authenticated;
drop trigger if exists app_profile_for_auth_user on auth.users;
create trigger app_profile_for_auth_user after insert on auth.users
for each row execute function app.create_profile_for_auth_user();

-- Backfill only auth users whose profile is absent; do not overwrite a
-- director-provided display name or infer a roster/account relationship.
insert into app.profiles (id, display_name)
select u.id, 'Tournament participant' from auth.users u
where not exists (select 1 from app.profiles p where p.id = u.id);
