-- Local disposable database only. Fictional fixture rows are always rolled back.
begin;
select set_config('request.jwt.claim.role','service_role',true);
do $fixture$
declare
 director uuid:=extensions.gen_random_uuid(); nominee uuid:=extensions.gen_random_uuid(); stranger uuid:=extensions.gen_random_uuid();
 tournament uuid:=extensions.gen_random_uuid(); nomination uuid:=extensions.gen_random_uuid(); operation uuid:=extensions.gen_random_uuid();
 result jsonb; accepted jsonb; repeated jsonb; state text;
begin
 if has_function_privilege('anon','public.get_setup_official_invitation_context_v1(uuid,uuid)','execute')
 or has_function_privilege('authenticated','public.get_setup_official_invitation_context_v1(uuid,uuid)','execute')
 or not has_function_privilege('service_role','public.get_setup_official_invitation_context_v1(uuid,uuid)','execute') then raise exception 'context ACL boundary failed';end if;
 if not exists(select 1 from pg_proc p join pg_roles r on r.oid=p.proowner where p.oid='public.get_setup_official_invitation_context_v1(uuid,uuid)'::regprocedure and r.rolname='supabase_admin' and p.prosecdef and p.proconfig @> array['search_path=""']) then raise exception 'context owner/search path failed';end if;
 insert into auth.users(id,email) values(director,'copy-director@test.invalid'),(nominee,'copy-official@test.invalid'),(stranger,'copy-stranger@test.invalid');
 insert into app.tournaments(id,director_profile_id,name,status,registration_status) values(tournament,director,'TEST ONLY no-email officials','open','open');
 insert into app.tournament_roles(tournament_id,profile_id,role) values(tournament,director,'director');
 insert into app.tournament_setup_official_nominations(id,tournament_id,role,first_name,last_name,email_normalized,acc_number,acc_identity_key,status,invitation_expires_at,created_by_profile_id)
 values(nomination,tournament,'cross_checker','TEST ONLY','Official','copy-official@test.invalid','ZZ1222026102602','ZZ1222026102602','pending',clock_timestamp()+interval '1 day',director);
 result:=public.get_setup_official_invitation_context_v1(nominee,nomination);
 if result->>'status'<>'pending' or result->>'tournamentName'<>'TEST ONLY no-email officials' or result->>'role'<>'cross_checker' or (select count(*) from jsonb_object_keys(result))<>5 then raise exception 'correct context missing';end if;
 if public.get_setup_official_invitation_context_v1(stranger,nomination) is not null or public.get_setup_official_invitation_context_v1(director,nomination) is not null or public.get_setup_official_invitation_context_v1(nominee,extensions.gen_random_uuid()) is not null then raise exception 'context enumeration';end if;
 if exists(select 1 from app.tournament_roles where tournament_id=tournament and profile_id=nominee) then raise exception 'reader granted role';end if;
 foreach state in array array['removed','expired'] loop
  update app.tournament_setup_official_nominations set status=state where id=nomination;
  if public.get_setup_official_invitation_context_v1(nominee,nomination) is not null then raise exception 'unavailable state disclosed';end if;
 end loop;
 update app.tournament_setup_official_nominations set status='pending',invitation_expires_at=clock_timestamp() where id=nomination;
 if public.get_setup_official_invitation_context_v1(nominee,nomination) is not null then raise exception 'expired context disclosed';end if;
 if public.accept_tournament_setup_official_nomination_by_id_v1(nominee,nomination,extensions.gen_random_uuid())->>'code'<>'invitation_expired' then raise exception 'expired acceptance allowed';end if;
 update app.tournament_setup_official_nominations set status='delivery_failed',invitation_expires_at=clock_timestamp()+interval '1 day' where id=nomination;
 if public.get_setup_official_invitation_context_v1(nominee,nomination)->>'status'<>'pending' then raise exception 'delivery failure incorrectly prevents acceptance';end if;
 -- Deliberate no-email is pending, not a fabricated email failure.
 update app.tournament_setup_official_nominations set status='pending' where id=nomination;
 if public.accept_tournament_setup_official_nomination_by_id_v1(stranger,nomination,extensions.gen_random_uuid())->>'code'<>'invitation_email_mismatch' then raise exception 'wrong-email acceptance allowed';end if;
 accepted:=public.accept_tournament_setup_official_nomination_by_id_v1(nominee,nomination,operation);
 if accepted->>'status'<>'official_accepted' then raise exception 'canonical no-email acceptance failed';end if;
 if public.get_setup_official_invitation_context_v1(nominee,nomination)->>'status'<>'accepted' then raise exception 'lost-response reconciliation failed';end if;
 update app.tournament_setup_official_nominations set invitation_expires_at=clock_timestamp()-interval '1 second' where id=nomination;
 if public.get_setup_official_invitation_context_v1(nominee,nomination)->>'status'<>'accepted' then raise exception 'accepted recovery incorrectly expires';end if;
 repeated:=public.accept_tournament_setup_official_nomination_by_id_v1(nominee,nomination,operation);
 if accepted<>repeated or (select count(*) from app.tournament_roles where tournament_id=tournament and profile_id=nominee and role='cross_checker')<>1 then raise exception 'duplicate acceptance';end if;
 if (select count(*) from app.operation_receipts where actor_profile_id=nominee and client_operation_id=operation)<>1 then raise exception 'duplicate receipt';end if;
 if exists(select 1 from app.audit_events where tournament_id=tournament and action in('tournament_setup_official_email_sent','tournament_setup_official_email_failed')) then raise exception 'fabricated email event';end if;
 update app.tournament_setup_official_nominations set accepted_profile_id=stranger where id=nomination;
 if public.get_setup_official_invitation_context_v1(nominee,nomination) is not null then raise exception 'other accepted actor disclosed';end if;
 perform set_config('request.jwt.claim.role','authenticated',true);
 if public.get_setup_official_invitation_context_v1(nominee,nomination) is not null then raise exception 'nonservice invocation accepted';end if;
end $fixture$;
set local role anon;
do $deny$ begin
 begin perform public.get_setup_official_invitation_context_v1(null,null); raise exception 'anon execution allowed';
 exception when insufficient_privilege then null; end;
end $deny$;
reset role;
set local role authenticated;
do $deny$ begin
 begin perform public.get_setup_official_invitation_context_v1(null,null); raise exception 'authenticated execution allowed';
 exception when insufficient_privilege then null; end;
end $deny$;
reset role;
set local role service_role;
select public.get_setup_official_invitation_context_v1(null,null) is null as service_execution_allowed;
reset role;
set constraints all immediate;
rollback;
