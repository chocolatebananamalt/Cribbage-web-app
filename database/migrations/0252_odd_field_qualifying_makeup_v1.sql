begin;
-- LOCAL additive proposal. Director Manual2019 §12.B printed17: an odd field
-- with twelve regular games has twelve distinct sit-outs, paired1/12..6/7.
-- Round13 is a makeup BATCH, never a thirteenth qualifying game or a free win.
-- Existing v1/even/legacy odd publication behavior and immutable history remain.
create table app.odd_field_makeup_games_v1(
 canonical_game_id uuid primary key,
 tournament_id uuid not null,event_id uuid not null,publication_id uuid not null,
 side_a_card_game_number integer not null check(side_a_card_game_number between 1 and 6),
 side_b_card_game_number integer not null check(side_b_card_game_number between 7 and 12),
 policy_version text not null default 'acc-director-manual-2019-12b-even-game-makeup-v1'
   check(policy_version='acc-director-manual-2019-12b-even-game-makeup-v1'),
 director_reason text not null check(length(trim(director_reason)) between 1 and 500 and director_reason !~ '[[:cntrl:]]'),
 actor_id uuid not null references app.profiles(id),operation_receipt_id uuid not null,
 recorded_at timestamptz not null default clock_timestamp(),
 check(side_a_card_game_number+side_b_card_game_number=13),
 foreign key(canonical_game_id,tournament_id,event_id)references app.canonical_games(id,tournament_id,event_id),
 foreign key(publication_id,tournament_id,event_id)references app.event_schedule_publications(id,tournament_id,event_id),
 foreign key(operation_receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),
 unique(event_id,side_a_card_game_number),unique(event_id,side_b_card_game_number)
);
alter table app.odd_field_makeup_games_v1 enable row level security;
alter table app.odd_field_makeup_games_v1 force row level security;
revoke all on app.odd_field_makeup_games_v1 from public,anon,authenticated,service_role;
create trigger odd_field_makeup_games_immutable before update or delete on app.odd_field_makeup_games_v1
for each row execute function app.reject_immutable_history();
create index odd_field_makeup_tournament_idx on app.odd_field_makeup_games_v1(tournament_id,event_id);
create index odd_field_makeup_publication_idx on app.odd_field_makeup_games_v1(publication_id,tournament_id,event_id);
create index odd_field_makeup_receipt_idx on app.odd_field_makeup_games_v1(operation_receipt_id,tournament_id);
create index odd_field_makeup_actor_idx on app.odd_field_makeup_games_v1(actor_id);

-- Exact private construction oracle. No client supplies identity, score or a
-- makeup's original card number. Both sides retain their own missed card line.
create function app.derive_odd_field_makeup_plan_v1(t uuid,e uuid,regular jsonb,seats jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare n integer;tc integer;sc integer;sitouts jsonb;result jsonb;
begin
 if jsonb_typeof(regular) is distinct from 'array' or jsonb_typeof(seats) is distinct from 'array' then return null;end if;
 if jsonb_array_length(regular)<>96 or jsonb_array_length(seats)<>6 then return null;end if;
 if exists(select 1 from jsonb_array_elements(regular)m where jsonb_typeof(m)is distinct from'object')
  or exists(select 1 from jsonb_array_elements(seats)m where jsonb_typeof(m)is distinct from'object')then return null;end if;
 select count(*)into n from app.event_participants where event_id=e and tournament_id=t;
 if n<>17 or exists(select 1 from app.event_participants where event_id=e and tournament_id=t and status<>'checked_in')then return null;end if;
 select table_count,seats_per_table into tc,sc from app.initial_seating_publications where tournament_id=t;
 if tc is null or tc*sc<17 then return null;end if;
 if(select count(distinct coalesce(s.verification_id,p.table_seat))from app.event_participants p left join app.initial_seating_assignments s
  on s.tournament_id=p.tournament_id and s.roster_entry_id=p.roster_entry_id where p.tournament_id=t and p.event_id=e)<>17 then return null;end if;
 if exists(select 1 from jsonb_array_elements(regular)m where jsonb_typeof(m)is distinct from'object'
   or(select count(*)from jsonb_object_keys(m))<>5
   or not(m?'gameNumber'and m?'sideAVerificationId'and m?'sideBVerificationId'and m?'sideATableSeat'and m?'sideBTableSeat')
   or jsonb_typeof(m->'gameNumber')is distinct from'number' or(m->>'gameNumber')!~'^(?:[1-9]|1[0-2])$'
   or jsonb_typeof(m->'sideAVerificationId')is distinct from'string' or(m->>'sideAVerificationId')!~'^[A-Z]-[1-9][0-9]*$'
   or jsonb_typeof(m->'sideBVerificationId')is distinct from'string' or(m->>'sideBVerificationId')!~'^[A-Z]-[1-9][0-9]*$'
   or jsonb_typeof(m->'sideATableSeat')is distinct from'string' or(m->>'sideATableSeat')!~'^[A-Z]-[1-9][0-9]*$'
   or jsonb_typeof(m->'sideBTableSeat')is distinct from'string' or(m->>'sideBTableSeat')!~'^[A-Z]-[1-9][0-9]*$')then return null;end if;
 if exists(select 1 from jsonb_array_elements(seats)m where jsonb_typeof(m)is distinct from'object'
   or(select count(*)from jsonb_object_keys(m))<>2 or not(m?'sideATableSeat'and m?'sideBTableSeat')
   or jsonb_typeof(m->'sideATableSeat')is distinct from'string' or(m->>'sideATableSeat')!~'^[A-Z]-[1-9][0-9]*$'
   or jsonb_typeof(m->'sideBTableSeat')is distinct from'string' or(m->>'sideBTableSeat')!~'^[A-Z]-[1-9][0-9]*$')then return null;end if;
 -- Validate ids, uniqueness and physical positions separately from syntax.
 if exists(with sides as(select(m->>'gameNumber')::integer r,m->>'sideAVerificationId'id,m->>'sideATableSeat'seat from jsonb_array_elements(regular)m
   union all select(m->>'gameNumber')::integer,m->>'sideBVerificationId',m->>'sideBTableSeat'from jsonb_array_elements(regular)m)
   select 1 from sides where not exists(select 1 from app.event_participants p left join app.initial_seating_assignments s
    on s.tournament_id=p.tournament_id and s.roster_entry_id=p.roster_entry_id
    where p.tournament_id=t and p.event_id=e and coalesce(s.verification_id,p.table_seat)=sides.id))then return null;end if;
 if(select count(distinct(m->>'gameNumber')::integer)from jsonb_array_elements(regular)m)<>12
   or exists(with sides as(select(m->>'gameNumber')::integer r,m->>'sideAVerificationId'id,m->>'sideATableSeat'seat from jsonb_array_elements(regular)m
    union all select(m->>'gameNumber')::integer,m->>'sideBVerificationId',m->>'sideBTableSeat'from jsonb_array_elements(regular)m)
    select 1 from sides group by r having count(*)<>16 or count(distinct id)<>16 or count(distinct seat)<>16)then return null;end if;
 -- The deliberately supported zero-anchor option must also be observable in
 -- the imported physical seats, not merely asserted by a checkbox.
 if exists(with sides as(select m->>'sideAVerificationId'id,m->>'sideATableSeat'seat from jsonb_array_elements(regular)m
  union all select m->>'sideBVerificationId',m->>'sideBTableSeat'from jsonb_array_elements(regular)m)
  select 1 from sides group by id having count(distinct seat)<2)then return null;end if;
 if exists(select 1 from(select m from jsonb_array_elements(regular)m union all select m from jsonb_array_elements(seats)m)x
   where left(m->>'sideATableSeat',1)<>left(m->>'sideBTableSeat',1)
    or m->>'sideATableSeat'=m->>'sideBTableSeat'
    or ascii(left(m->>'sideATableSeat',1))-64 not between 1 and tc
    or split_part(m->>'sideATableSeat','-',2)::numeric not between 1 and sc
    or split_part(m->>'sideBTableSeat','-',2)::numeric not between 1 and sc)then return null;end if;
 if(select count(distinct seat)from(select m->>'sideATableSeat'seat from jsonb_array_elements(seats)m
   union all select m->>'sideBTableSeat'from jsonb_array_elements(seats)m)x)<>12 then return null;end if;
 with roster as(select coalesce(s.verification_id,p.table_seat)id from app.event_participants p left join app.initial_seating_assignments s
  on s.tournament_id=p.tournament_id and s.roster_entry_id=p.roster_entry_id where p.tournament_id=t and p.event_id=e),
 missing as(select r,id from generate_series(1,12)r cross join roster where not exists(select 1 from jsonb_array_elements(regular)m
  where(m->>'gameNumber')::integer=r and id in(m->>'sideAVerificationId',m->>'sideBVerificationId')))
 select jsonb_agg(jsonb_build_object('gameNumber',r,'verificationId',id)order by r)into sitouts from missing;
 if jsonb_array_length(sitouts)<>12 or(select count(distinct x->>'verificationId')from jsonb_array_elements(sitouts)x)<>12 then return null;end if;
 select jsonb_agg(jsonb_build_object('gameNumber',13,'sideAVerificationId',sitouts->(i-1)->>'verificationId',
  'sideBVerificationId',sitouts->(12-i)->>'verificationId','sideATableSeat',seats->(i-1)->>'sideATableSeat',
  'sideBTableSeat',seats->(i-1)->>'sideBTableSeat','sideACardGameNumber',i,'sideBCardGameNumber',13-i)order by i)
 into result from generate_series(1,6)i;
 return result;
end $$;
revoke all on function app.derive_odd_field_makeup_plan_v1(uuid,uuid,jsonb,jsonb)from public,anon,authenticated,service_role;

create function app.odd_field_makeup_schedule_current_v1(e uuid)returns boolean
language sql stable security definer set search_path='' as $$
 with p as(select * from app.event_schedule_publications where event_id=e),
 rows as(select g.*,r.round_number,m.side_a_card_game_number,m.side_b_card_game_number
  from app.canonical_games g join app.rounds r on r.id=g.round_id left join app.odd_field_makeup_games_v1 m on m.canonical_game_id=g.id where g.event_id=e),
 regular as(select jsonb_build_object('gameNumber',x.round_number,'sideAVerificationId',coalesce(sa.verification_id,a.table_seat),
  'sideBVerificationId',coalesce(sb.verification_id,b.table_seat),'sideATableSeat',x.side_a_table_seat_snapshot,'sideBTableSeat',x.side_b_table_seat_snapshot)m
  from rows x join app.event_participants a on a.id=x.side_a_participant_id join app.event_participants b on b.id=x.side_b_participant_id
  left join app.initial_seating_assignments sa on sa.tournament_id=a.tournament_id and sa.roster_entry_id=a.roster_entry_id
  left join app.initial_seating_assignments sb on sb.tournament_id=b.tournament_id and sb.roster_entry_id=b.roster_entry_id where x.round_number<=12),
 makeup as(select x.*,coalesce(sa.verification_id,a.table_seat)a_id,coalesce(sb.verification_id,b.table_seat)b_id
  from rows x join app.event_participants a on a.id=x.side_a_participant_id join app.event_participants b on b.id=x.side_b_participant_id
  left join app.initial_seating_assignments sa on sa.tournament_id=a.tournament_id and sa.roster_entry_id=a.roster_entry_id
  left join app.initial_seating_assignments sb on sb.tournament_id=b.tournament_id and sb.roster_entry_id=b.roster_entry_id where x.round_number=13),
 derived as(select app.derive_odd_field_makeup_plan_v1(p.tournament_id,e,(select jsonb_agg(m)from regular),
  (select jsonb_agg(jsonb_build_object('sideATableSeat',side_a_table_seat_snapshot,'sideBTableSeat',side_b_table_seat_snapshot)order by side_a_card_game_number)from makeup))data from p)
 select coalesce((select p.game_count=12 and p.participant_count=17 and p.match_count=102
  and(select count(*)from rows)=102 and(select count(*)from makeup)=6
  and(select count(*)from app.odd_field_makeup_games_v1 where event_id=e and publication_id=p.id)=6
  and(select count(*)from app.rounds where event_id=e)=13
  and derived.data is not null
  and not exists(select 1 from makeup x where not exists(select 1 from jsonb_array_elements(derived.data)y
    where(y->>'sideACardGameNumber')::integer=x.side_a_card_game_number and(y->>'sideBCardGameNumber')::integer=x.side_b_card_game_number
     and y->>'sideAVerificationId'=x.a_id and y->>'sideBVerificationId'=x.b_id))
  and not exists(select 1 from app.event_participants ep where ep.event_id=e
    and(select count(*)from rows x where ep.id in(x.side_a_participant_id,x.side_b_participant_id))<>12)
  from p cross join derived),false)
$$;
revoke all on function app.odd_field_makeup_schedule_current_v1(uuid)from public,anon,authenticated,service_role;

create function public.publish_odd_field_makeup_schedule_v1(a uuid,t uuid,e uuid,request jsonb,op uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare h text;prior app.operation_receipts%rowtype;rec uuid:=extensions.gen_random_uuid();pub uuid:=extensions.gen_random_uuid();
 plan jsonb;allmatches jsonb;m jsonb;gid uuid;rid uuid;aid uuid;bid uuid;rn integer;idx integer:=0;response jsonb;code text;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role'then return null;end if;
 if a is null or t is null or e is null or op is null or jsonb_typeof(request)is distinct from'object'then
  return jsonb_build_object('status','rejected','code','invalid_request');end if;
 if(select count(*)from jsonb_object_keys(request))<>5 or not(request?'regularMatches'and request?'makeupSeats'and request?'reason'and request?'reviewed'and request?'anchorCount')
  or request->'anchorCount'is distinct from'0'::jsonb
  or request->'reviewed' is distinct from'true'::jsonb or jsonb_typeof(request->'reason')is distinct from'string'
  or length(trim(request->>'reason'))not between 1 and 500 or request->>'reason'~'[[:cntrl:]]'then
  return jsonb_build_object('status','rejected','code','invalid_request');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('publish_odd_field_makeup_schedule_v1',a,t,e,request)::text,'utf8'),'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended(a::text||':'||op::text,0));
 perform 1 from app.tournaments where id=t and status='open'for update;
 if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable');end if;
 perform 1 from app.tournament_roles where tournament_id=t and profile_id=a and role in('director','co_director')for update;
 if not found then return jsonb_build_object('status','rejected','code','not_director');end if;
 select * into prior from app.operation_receipts where actor_profile_id=a and client_operation_id=op;
 if found then if prior.request_hash=h and prior.operation_type='publish_odd_field_makeup_schedule_v1'then return prior.response_payload;
  else return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;end if;
 perform app.lock_event_attendance_lifecycle_v1(e);
 perform 1 from app.events x join app.ruleset_versions rv on rv.id=x.ruleset_version_id and rv.tournament_id=x.tournament_id
  join app.tournament_setup_activations ac on ac.event_id=x.id and ac.tournament_id=x.tournament_id
  join app.tournament_setup_event_versions sev on sev.id=ac.setup_event_version_id and sev.tournament_id=ac.tournament_id
  where x.id=e and x.tournament_id=t and x.operational_state='active'and x.event_type='main'and x.format='standard_singles'
   and x.scoring_method='digital'and rv.approved_at is not null and sev.game_count=12 for update of x;
 if not found then code:='unsupported_event';
 elsif not exists(select 1 from app.tournaments where id=t and registration_status='closed')then code:='registration_open';
 elsif exists(select 1 from app.event_schedule_publications where event_id=e)or exists(select 1 from app.rounds where event_id=e)
   or exists(select 1 from app.canonical_games where event_id=e)or exists(select 1 from app.event_play_starts where event_id=e)then code:='schedule_already_published';
 else plan:=app.derive_odd_field_makeup_plan_v1(t,e,request->'regularMatches',request->'makeupSeats');
  if plan is null then code:='invalid_schedule';end if;
 end if;
 if code is not null then
  response:=jsonb_build_object('status','rejected','code',code);
  insert into app.operation_receipts(id,actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
   values(rec,a,t,'publish_odd_field_makeup_schedule_v1',e,h,op,'rejected',response,clock_timestamp());return response;
 end if;
 response:=jsonb_build_object('status','odd_field_schedule_published','eventId',e,'publicationId',pub,
  'gameCount',12,'participantCount',17,'regularMatchCount',96,'makeupMatchCount',6,'matchCount',102);
 insert into app.operation_receipts(id,actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
  values(rec,a,t,'publish_odd_field_makeup_schedule_v1',pub,h,op,'accepted',response,clock_timestamp());
 insert into app.event_schedule_publications(id,tournament_id,event_id,source_method,game_count,participant_count,match_count,schedule_digest,actor_profile_id,operation_receipt_id)
  values(pub,t,e,'director_entry',12,17,102,h,a,rec);
 insert into app.rounds(tournament_id,event_id,round_number)select t,e,i from generate_series(1,13)i;
 allmatches:=(request->'regularMatches')||plan;
 for m in select value from jsonb_array_elements(allmatches)loop
  idx:=idx+1;rn:=(m->>'gameNumber')::integer;gid:=extensions.gen_random_uuid();
  select id into rid from app.rounds where event_id=e and round_number=rn;
  select p.id into aid from app.event_participants p left join app.initial_seating_assignments s on s.tournament_id=p.tournament_id and s.roster_entry_id=p.roster_entry_id
   where p.event_id=e and p.tournament_id=t and coalesce(s.verification_id,p.table_seat)=m->>'sideAVerificationId';
  select p.id into bid from app.event_participants p left join app.initial_seating_assignments s on s.tournament_id=p.tournament_id and s.roster_entry_id=p.roster_entry_id
   where p.event_id=e and p.tournament_id=t and coalesce(s.verification_id,p.table_seat)=m->>'sideBVerificationId';
  insert into app.canonical_games(id,tournament_id,event_id,round_id,match_instance,side_a_participant_id,side_b_participant_id,side_a_table_seat_snapshot,side_b_table_seat_snapshot)
   values(gid,t,e,rid,1,aid,bid,m->>'sideATableSeat',m->>'sideBTableSeat');
  insert into app.event_schedule_games(publication_id,tournament_id,event_id,canonical_game_id,import_row_number)values(pub,t,e,gid,idx);
  if rn=13 then insert into app.odd_field_makeup_games_v1(canonical_game_id,tournament_id,event_id,publication_id,side_a_card_game_number,side_b_card_game_number,director_reason,actor_id,operation_receipt_id)
   values(gid,t,e,pub,(m->>'sideACardGameNumber')::integer,(m->>'sideBCardGameNumber')::integer,trim(request->>'reason'),a,rec);end if;
 end loop;
 if not app.odd_field_makeup_schedule_current_v1(e)then raise exception 'odd field publication invariant failed';end if;
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
  values(t,a,rec,'event_schedule_publication',pub,'odd_field_makeup_schedule_published',response);
 return response;
end $$;
revoke all on function public.publish_odd_field_makeup_schedule_v1(uuid,uuid,uuid,jsonb,uuid)from public,anon,authenticated;
grant execute on function public.publish_odd_field_makeup_schedule_v1(uuid,uuid,uuid,jsonb,uuid)to service_role;

create function public.get_odd_field_makeup_workspace_v1(a uuid,t uuid,e uuid)returns jsonb
language sql stable security definer set search_path='' as $$
 select case when coalesce(auth.jwt()->>'role','')='service_role'and exists(select 1 from app.tournament_roles where tournament_id=t and profile_id=a and role in('director','co_director','cross_checker','judge'))
 and exists(select 1 from app.events where id=e and tournament_id=t)then jsonb_build_object('tournamentId',t,'eventId',e,
 'current',app.odd_field_makeup_schedule_current_v1(e),'policyVersion','acc-director-manual-2019-12b-even-game-makeup-v1',
 'qualifyingGameCount',12,'makeupBatchNumber',13,'makeups',coalesce((select jsonb_agg(jsonb_build_object(
 'canonicalGameId',m.canonical_game_id,'publicationId',m.publication_id,'sideACardGameNumber',m.side_a_card_game_number,
 'sideBCardGameNumber',m.side_b_card_game_number,'reason',m.director_reason,'recordedAt',m.recorded_at,'actorId',m.actor_id)order by m.side_a_card_game_number)
 from app.odd_field_makeup_games_v1 m where m.tournament_id=t and m.event_id=e),'[]'::jsonb))else null end
$$;
revoke all on function public.get_odd_field_makeup_workspace_v1(uuid,uuid,uuid)from public,anon,authenticated;
grant execute on function public.get_odd_field_makeup_workspace_v1(uuid,uuid,uuid)to service_role;

create function public.reconcile_odd_field_makeup_schedule_v1(a uuid,t uuid,e uuid,request jsonb,op uuid)returns jsonb
language sql stable security definer set search_path='' as $$
 select case when coalesce(auth.jwt()->>'role','')='service_role'and exists(select 1 from app.tournament_roles where tournament_id=t and profile_id=a and role in('director','co_director'))then
 jsonb_build_object('authorized',true,'result',(select case when r.request_hash=encode(extensions.digest(convert_to(jsonb_build_array('publish_odd_field_makeup_schedule_v1',a,t,e,request)::text,'utf8'),'sha256'),'hex')
  and r.operation_type='publish_odd_field_makeup_schedule_v1'and r.tournament_id=t then r.response_payload else jsonb_build_object('status','rejected','code','idempotency_conflict')end
  from app.operation_receipts r where r.actor_profile_id=a and r.client_operation_id=op))else null end
$$;
revoke all on function public.reconcile_odd_field_makeup_schedule_v1(uuid,uuid,uuid,jsonb,uuid)from public,anon,authenticated;
grant execute on function public.reconcile_odd_field_makeup_schedule_v1(uuid,uuid,uuid,jsonb,uuid)to service_role;

-- Sanitized own-game / official context: no reason, receipt, actor or other
-- fixture metadata is disclosed to a player. Original scheduling identity stays
-- unchanged; only scorecard display uses these per-side line numbers.
create function public.get_game_scorecard_number_context_v1(a uuid,t uuid,g uuid)returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('gameId',cg.id,'eventId',cg.event_id,'schedulingBatchNumber',r.round_number,
  'sideACardGameNumber',coalesce(m.side_a_card_game_number,r.round_number),
  'sideBCardGameNumber',coalesce(m.side_b_card_game_number,r.round_number),'isMakeup',m.canonical_game_id is not null)
 from app.canonical_games cg join app.rounds r on r.id=cg.round_id
 left join app.odd_field_makeup_games_v1 m on m.canonical_game_id=cg.id
 where cg.id=g and cg.tournament_id=t and coalesce(auth.jwt()->>'role','')='service_role'
  and(exists(select 1 from app.tournament_roles tr where tr.tournament_id=t and tr.profile_id=a and tr.role in('director','co_director','cross_checker','judge'))
   or exists(select 1 from app.event_participants ep where ep.id in(cg.side_a_participant_id,cg.side_b_participant_id)and ep.profile_id=a))
  and(m.canonical_game_id is null or app.odd_field_makeup_schedule_current_v1(cg.event_id))
$$;
revoke all on function public.get_game_scorecard_number_context_v1(uuid,uuid,uuid)from public,anon,authenticated;
grant execute on function public.get_game_scorecard_number_context_v1(uuid,uuid,uuid)to service_role;

create function app.scorecard_game_number_v1(g uuid,p uuid)returns integer
language sql stable security definer set search_path='' as $$
 select case when m.canonical_game_id is null then r.round_number
  when not app.odd_field_makeup_schedule_current_v1(cg.event_id)then null
  when p=cg.side_a_participant_id then m.side_a_card_game_number else m.side_b_card_game_number end
 from app.canonical_games cg join app.rounds r on r.id=cg.round_id
 left join app.odd_field_makeup_games_v1 m on m.canonical_game_id=cg.id
 where cg.id=g and p in(cg.side_a_participant_id,cg.side_b_participant_id)
$$;
revoke all on function app.scorecard_game_number_v1(uuid,uuid)from public,anon,authenticated,service_role;
create function app.makeup_card_context_v1(g uuid)returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('gameId',cg.id,'eventId',cg.event_id,'schedulingBatchNumber',r.round_number,
  'sideACardGameNumber',m.side_a_card_game_number,'sideBCardGameNumber',m.side_b_card_game_number,'isMakeup',true)
 from app.canonical_games cg join app.rounds r on r.id=cg.round_id join app.odd_field_makeup_games_v1 m on m.canonical_game_id=cg.id
 where cg.id=g and app.odd_field_makeup_schedule_current_v1(cg.event_id)
$$;
revoke all on function app.makeup_card_context_v1(uuid)from public,anon,authenticated,service_role;
-- Optional projection is emitted ONLY for new mapped makeup games. Old API
-- rows, including ordinary game13 in a longer event, retain their exact shape.
do $projection$
declare d text;old text;replacement text;
begin
 select pg_get_functiondef('public.get_assigned_game_context(uuid)'::regprocedure)into d;
 old:='else payload||jsonb_build_object(';
 replacement:='else payload||case when exists(select 1 from app.odd_field_makeup_games_v1 where canonical_game_id=p_game_id)
  then jsonb_build_object(''cardNumbers'',app.makeup_card_context_v1(p_game_id))else ''{}''::jsonb end||jsonb_build_object(';
 if(length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'Expected exact assigned-game projection seam';end if;
 execute replace(d,old,replacement);
 select pg_get_functiondef('public.get_my_assigned_games_v1(uuid)'::regprocedure)into d;
 old:='item.game||jsonb_build_object(';
 replacement:='item.game||case when exists(select 1 from app.odd_field_makeup_games_v1 where canonical_game_id=game.id)
  then jsonb_build_object(''cardNumbers'',app.makeup_card_context_v1(game.id))else ''{}''::jsonb end||jsonb_build_object(';
 if(length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'Expected exact my-games projection seam';end if;
 execute replace(d,old,replacement);
end $projection$;
-- Same authorized reader and exact DTO; only a new mapped makeup fills its
-- original blank card line. Legacy rows/order remain numerically identical.
do $card$
declare d text;old text:='''roundNumber'', round_row.round_number,';
 new text:='''roundNumber'', app.scorecard_game_number_v1(game.id,player_participant.id),';
 old_order text:='order by round_row.round_number, game.match_instance';
begin
 select pg_get_functiondef('public.get_player_scorecard(uuid,uuid)'::regprocedure)into d;
 if(length(d)-length(replace(d,old,'')))/length(old)<>2
  or(length(d)-length(replace(d,old_order,'')))/length(old_order)<>2 then raise exception 'Expected exact scorecard reader seams';end if;
 execute replace(replace(d,old,new),old_order,'order by app.scorecard_game_number_v1(game.id,player_participant.id), game.match_instance');
end $card$;

-- Preserve every outer attendance, identity, sanctions and exact replay guard.
-- Only a fully validated new makeup publication has one extra scheduling batch.
do $patch$
declare d text;old text:='select count(*) into v_actual_games from app.rounds round_row
    where round_row.tournament_id=p_tournament_id and round_row.event_id=p_event_id;';
 replacement text:='select count(*) - case when app.odd_field_makeup_schedule_current_v1(p_event_id) then 1 else 0 end into v_actual_games from app.rounds round_row
    where round_row.tournament_id=p_tournament_id and round_row.event_id=p_event_id;';
begin
 select pg_get_functiondef('public.start_event_play_v1_legacy(uuid,uuid,uuid,uuid,text,integer,integer,boolean,uuid)'::regprocedure)into d;
 if(length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'Expected exact legacy start count seam';end if;
 execute replace(d,old,replacement);
end $patch$;
notify pgrst,'reload schema';
commit;
