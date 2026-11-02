-- CLI scaffold20261102013623. LOCAL ONLY: no hosted enrollment, roles or links.
begin;
-- Permit exactly the approved replacement alongside the preserved original.
-- Keep the staging project, two profiles, one-operator provenance and all grants.
do $migration$
declare constraint_name text; definition text; anchor text; matches integer;
begin
 select count(*),min(c.conname) into matches,constraint_name from pg_constraint c
 where c.conrelid='app.simulated_player_link_scopes_v1'::regclass and c.contype='c'
 and position('3c58ef91-010c-4769-af20-5cfa2ffe98a9' in pg_get_constraintdef(c.oid))>0;
 if matches<>1 then raise exception 'Unexpected simulation fixture constraint';end if;
 execute format('alter table app.simulated_player_link_scopes_v1 drop constraint %I',constraint_name);
 alter table app.simulated_player_link_scopes_v1 add constraint simulated_link_two_named_fixtures_v2
 check(tournament_id in('3c58ef91-010c-4769-af20-5cfa2ffe98a9'::uuid,'fd0589d0-31e7-4921-b793-1beec2431337'::uuid));
 definition:=pg_get_functiondef('app.guard_simulated_player_link_v1()'::regprocedure);
 anchor:=$anchor$new.tournament_id='3c58ef91-010c-4769-af20-5cfa2ffe98a9'$anchor$;
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then
  raise exception 'Unexpected simulation enrollment lock guard';end if;
 execute replace(definition,anchor,$replacement$new.tournament_id in('3c58ef91-010c-4769-af20-5cfa2ffe98a9'::uuid,'fd0589d0-31e7-4921-b793-1beec2431337'::uuid)$replacement$);
end $migration$;
-- No enrollment or access rows are created; these remain separately approved actions.
notify pgrst,'reload schema';
commit;
