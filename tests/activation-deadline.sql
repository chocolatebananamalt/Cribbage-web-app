-- Fictional, rollback-only proof on a disposable local Supabase database.
begin;
select set_config('request.jwt.claim.role','service_role',true);
do $$
declare
 director uuid:=extensions.gen_random_uuid(); player uuid;
 tournament uuid:=extensions.gen_random_uuid(); receipt uuid:=extensions.gen_random_uuid();
 roster uuid; activation uuid; request uuid; replacement uuid; operation uuid;
 result jsonb; repeated jsonb; delta integer; deadline timestamptz;
begin
 insert into auth.users(id,email) values(director,'expiry-director@test.invalid');
 insert into app.tournaments(id,director_profile_id,name,status,registration_status) values(tournament,director,'TEST ONLY expiry fixture','open','open');
 insert into app.tournament_roles(tournament_id,profile_id,role) values(tournament,director,'director');
 insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(receipt,tournament,director,'expiry_fixture',tournament,repeat('1',64),extensions.gen_random_uuid(),'accepted','{}',now());
 -- Transaction now() is stable: exact deadline equality is tested deterministically.
 foreach delta in array array[-1,0,1] loop
  player:=extensions.gen_random_uuid();roster:=extensions.gen_random_uuid();activation:=extensions.gen_random_uuid();request:=extensions.gen_random_uuid();operation:=extensions.gen_random_uuid();deadline:=now()+delta*interval '1 second';
  insert into auth.users(id,email) values(player,'expiry-player-'||delta||'@test.invalid');
  insert into app.tournament_roster_entries(id,tournament_id,source_kind,claimed_display_name,claimed_normalized_name,scorecard_type,creator_profile_id,operation_receipt_id) values(roster,tournament,'director_manual','Expiry Player '||delta,'expiry player '||delta,'digital',director,receipt);
  insert into app.roster_account_activations(id,tournament_id,roster_entry_id,issued_by_profile_id,token_salt,token_digest,state,expires_at,issued_at) values(activation,tournament,roster,director,decode(repeat('01',32),'hex'),decode(repeat('02',32),'hex'),'issued',deadline,now()-interval '10 minutes');
  result:=public.get_roster_account_activation_salt_v1(activation);
  if delta>0 then
   if result->>'status'<>'ready' or (result->>'expiresAt')::timestamptz<>deadline then raise exception 'immutable lookup deadline missing';end if;
  elsif result<>jsonb_build_object('status','unavailable') then raise exception 'lookup accepted at/after expiry';end if;
  -- Model a redemption completed before the deadline, as in the real rehearsal.
  update app.roster_account_activations set state='pending' where id=activation;
  insert into app.roster_account_activation_requests(id,tournament_id,activation_id,profile_id,confirmation_phrase,state,requested_at) values(request,tournament,activation,player,'ABCD-EFGH','pending',now()-interval '1 minute');
  result:=public.decide_roster_account_activation_v1(director,tournament,request,'approve','ABCD-EFGH',operation);
  if delta>0 then
   if result->>'status'<>'approved' then raise exception 'legitimate before-deadline approval blocked';end if;
   repeated:=public.decide_roster_account_activation_v1(director,tournament,request,'approve','ABCD-EFGH',operation);
   if result<>repeated or (select count(*) from app.roster_account_links where roster_entry_id=roster)<>1 then raise exception 'duplicate approval changed link';end if;
  else
   if result<>jsonb_build_object('status','rejected') or exists(select 1 from app.roster_account_links where roster_entry_id=roster) then raise exception 'approval accepted at/after expiry';end if;
   if not exists(select 1 from app.roster_account_activations where id=activation and state='expired') or not exists(select 1 from app.roster_account_activation_requests where id=request and state='rejected') then raise exception 'expiry history missing';end if;
   replacement:=extensions.gen_random_uuid();
   result:=public.issue_roster_account_activation_v1(director,tournament,roster,replacement,decode(repeat('03',32),'hex'),decode(repeat('04',32),'hex'),now()+interval '30 minutes',extensions.gen_random_uuid());
   if result->>'status'<>'issued' or (select count(*) from app.roster_account_activations where roster_entry_id=roster)<>2 then raise exception 'supported replacement/history failed';end if;
   if exists(select 1 from app.roster_account_links where roster_entry_id=roster) then raise exception 'replacement silently linked account';end if;
  end if;
 end loop;
end $$;
set constraints all immediate;
rollback;
