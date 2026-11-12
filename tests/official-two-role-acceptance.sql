-- Disposable local database only: a partial two-role handoff is not completion.
begin;
select set_config('request.jwt.claim.role','service_role',true);
do $two_roles$
declare
 director uuid:=extensions.gen_random_uuid(); nominee uuid:=extensions.gen_random_uuid(); stranger uuid:=extensions.gen_random_uuid();
 tournament uuid:=extensions.gen_random_uuid(); co_nomination uuid:=extensions.gen_random_uuid(); cross_nomination uuid:=extensions.gen_random_uuid();
 co_operation uuid:=extensions.gen_random_uuid(); cross_operation uuid:=extensions.gen_random_uuid();
 accepted_co jsonb; accepted_cross jsonb; result jsonb;
begin
 insert into auth.users(id,email) values(director,'two-role-director@test.invalid'),(nominee,'two-role-official@test.invalid'),(stranger,'two-role-stranger@test.invalid');
 insert into app.tournaments(id,director_profile_id,name,status,registration_status) values(tournament,director,'TEST ONLY partial official acceptance','open','open');
 insert into app.tournament_roles(tournament_id,profile_id,role) values(tournament,director,'director');
 -- Seed pending invitation state, never the nominee's authority. Only the
 -- existing acceptance RPC below may create the two nominee role rows.
 insert into app.tournament_setup_official_nominations(id,tournament_id,role,first_name,last_name,email_normalized,acc_number,acc_identity_key,status,invitation_expires_at,created_by_profile_id)
 values(co_nomination,tournament,'co_director','TEST ONLY','Official','two-role-official@test.invalid','ZZ1222026102603','ZZ1222026102603','pending',clock_timestamp()+interval '1 day',director),
       (cross_nomination,tournament,'cross_checker','TEST ONLY','Official','two-role-official@test.invalid','ZZ1222026102603','ZZ1222026102603','pending',clock_timestamp()+interval '1 day',director);
 if public.get_setup_official_invitation_context_v1(nominee,co_nomination)->>'status' is distinct from 'pending'
 or public.get_setup_official_invitation_context_v1(nominee,cross_nomination)->>'status' is distinct from 'pending'
 or exists(select 1 from app.tournament_roles where tournament_id=tournament and profile_id=nominee) then raise exception 'pending context granted authority';end if;

 accepted_co:=public.accept_tournament_setup_official_nomination_by_id_v1(nominee,co_nomination,co_operation);
 if accepted_co->>'status' is distinct from 'official_accepted'
 or public.get_setup_official_invitation_context_v1(nominee,co_nomination)->>'status' is distinct from 'accepted'
 or public.get_setup_official_invitation_context_v1(nominee,cross_nomination)->>'status' is distinct from 'pending'
 or (select count(*) from app.tournament_roles where tournament_id=tournament and profile_id=nominee and role='co_director')<>1
 or exists(select 1 from app.tournament_roles where tournament_id=tournament and profile_id=nominee and role='cross_checker') then raise exception 'one acceptance incorrectly completed both roles';end if;
 result:=public.accept_tournament_setup_official_nomination_by_id_v1(nominee,co_nomination,co_operation);
 if result is distinct from accepted_co or (select count(*) from app.operation_receipts where tournament_id=tournament and actor_profile_id=nominee)<>1 then raise exception 'first-role replay duplicated acceptance';end if;

 result:=public.accept_tournament_setup_official_nomination_by_id_v1(stranger,cross_nomination,extensions.gen_random_uuid());
 if result->>'code' is distinct from 'invitation_email_mismatch' or public.get_setup_official_invitation_context_v1(stranger,cross_nomination) is not null then raise exception 'other account accepted second role';end if;
 update app.tournament_setup_official_nominations set invitation_expires_at=clock_timestamp() where id=cross_nomination;
 result:=public.accept_tournament_setup_official_nomination_by_id_v1(nominee,cross_nomination,extensions.gen_random_uuid());
 if result->>'code' is distinct from 'invitation_expired' or public.get_setup_official_invitation_context_v1(nominee,cross_nomination) is not null then raise exception 'expired second role accepted';end if;
 update app.tournament_setup_official_nominations set invitation_expires_at=clock_timestamp()+interval '1 day',status='removed' where id=cross_nomination;
 result:=public.accept_tournament_setup_official_nomination_by_id_v1(nominee,cross_nomination,extensions.gen_random_uuid());
 if result->>'status' is distinct from 'rejected' or public.get_setup_official_invitation_context_v1(nominee,cross_nomination) is not null then raise exception 'removed second role accepted';end if;
 if exists(select 1 from app.tournament_roles where tournament_id=tournament and profile_id=nominee and role='cross_checker') then raise exception 'rejected second-role attempt changed authority';end if;
 if (select count(*) from app.operation_receipts where tournament_id=tournament and actor_profile_id=nominee)<>1
 or (select count(*) from app.audit_events where tournament_id=tournament and action='tournament_setup_official_accepted')<>1 then raise exception 'rejected second-role attempt changed audit/receipt';end if;
 update app.tournament_setup_official_nominations set status='pending' where id=cross_nomination;

 accepted_cross:=public.accept_tournament_setup_official_nomination_by_id_v1(nominee,cross_nomination,cross_operation);
 if accepted_cross->>'status' is distinct from 'official_accepted'
 or public.get_setup_official_invitation_context_v1(nominee,co_nomination)->>'status' is distinct from 'accepted'
 or public.get_setup_official_invitation_context_v1(nominee,cross_nomination)->>'status' is distinct from 'accepted'
 or (select count(*) from app.tournament_roles where tournament_id=tournament and profile_id=nominee and role in('co_director','cross_checker'))<>2
 or exists(select 1 from app.tournament_roles where tournament_id=tournament and profile_id=nominee and role not in('co_director','cross_checker')) then raise exception 'explicit second acceptance has wrong scope';end if;
 result:=public.accept_tournament_setup_official_nomination_by_id_v1(nominee,cross_nomination,cross_operation);
 if result is distinct from accepted_cross or (select count(*) from app.operation_receipts where tournament_id=tournament and actor_profile_id=nominee)<>2
 or (select count(*) from app.audit_events where tournament_id=tournament and action='tournament_setup_official_accepted')<>2 then raise exception 'two-role replay duplicated audit/receipt';end if;
 result:=public.accept_tournament_setup_official_nomination_by_id_v1(nominee,cross_nomination,extensions.gen_random_uuid());
 if result->>'status' is distinct from 'rejected' or result->>'code' is distinct from 'invitation_expired'
 or (select count(*) from app.operation_receipts where tournament_id=tournament and actor_profile_id=nominee)<>2 then raise exception 'new-operation replay expanded acceptance';end if;
 if exists(select 1 from app.tournament_roster_entries where tournament_id=tournament)
 or exists(select 1 from app.event_participants where tournament_id=tournament)
 or exists(select 1 from app.paper_official_identity_bindings where tournament_id=tournament)
 or exists(select 1 from app.audit_events where tournament_id=tournament and action in('tournament_setup_official_email_sent','tournament_setup_official_email_failed')) then raise exception 'acceptance created unrelated roster/binding/email state';end if;
end $two_roles$;
set constraints all immediate;
rollback;
