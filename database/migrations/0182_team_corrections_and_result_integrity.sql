-- Policy-aware team corrections and corrected team ranking.

alter table app.event_team_score_corrections
  add column base_game_version integer not null default 1 check(base_game_version>0),
  add column policy_version integer not null default 0 check(policy_version>=0),
  add column reason_required boolean not null default false,
  add column required_approvals smallint not null default 0 check(required_approvals between 0 and 1);
alter table app.event_team_score_corrections add constraint event_team_score_corrections_policy_fk
  foreign key(tournament_id,policy_version) references app.correction_policy_versions(tournament_id,version) on delete restrict;

create table app.event_team_score_correction_reviews(
  id uuid primary key,
  correction_id uuid not null references app.event_team_score_corrections(id) on delete restrict,
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  event_id uuid not null,
  team_game_id uuid not null references app.event_team_games(id) on delete restrict,
  reviewer_profile_id uuid not null references app.profiles(id) on delete restrict,
  approved boolean not null,
  operation_receipt_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  foreign key(event_id,tournament_id) references app.events(id,tournament_id) on delete restrict,
  foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id) on delete restrict,
  unique(correction_id,reviewer_profile_id)
);
alter table app.event_team_score_correction_reviews enable row level security;
alter table app.event_team_score_correction_reviews force row level security;
revoke all on table app.event_team_score_correction_reviews from public,anon,authenticated;
create trigger event_team_score_correction_reviews_immutable before update or delete on app.event_team_score_correction_reviews for each row execute function app.reject_immutable_history();

-- The original reciprocal score remains recoverable in the immutable
-- correction row. Only the private correction RPC may replace the current
-- derived scoreline used by standings.
drop trigger if exists event_team_scorelines_immutable on app.event_team_scorelines;

create or replace function app.apply_event_team_correction_v1(p_correction_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare c app.event_team_score_corrections%rowtype; g app.event_team_games%rowtype; winning uuid; losing uuid;
begin
  select * into c from app.event_team_score_corrections where id=p_correction_id;
  if not found then raise exception 'team correction not found'; end if;
  select * into g from app.event_team_games where id=c.team_game_id for update;
  if g.version<>c.base_game_version or g.state not in('verified','corrected') then raise exception 'stale team game version'; end if;
  winning:=case when c.corrected_winner_side='a' then g.side_a_team_entry_id else g.side_b_team_entry_id end;
  losing:=case when c.corrected_winner_side='a' then g.side_b_team_entry_id else g.side_a_team_entry_id end;
  update app.event_team_scorelines set
    is_winner=team_entry_id=winning, margin=c.corrected_margin,
    plus_points=case when team_entry_id=winning then c.corrected_margin else 0 end,
    minus_points=case when team_entry_id=losing then c.corrected_margin else 0 end,
    game_points=case when team_entry_id=winning then case when c.corrected_margin>=31 then 3 else 2 end else 0 end
  where team_game_id=g.id;
  update app.event_team_games set state='corrected',winner_side=c.corrected_winner_side,margin=c.corrected_margin,version=version+1 where id=g.id;
end $$;
revoke all on function app.apply_event_team_correction_v1(uuid) from public,anon,authenticated;

create or replace function public.propose_event_team_score_correction_v1(
  p_actor_id uuid,p_tournament_id uuid,p_game_id uuid,p_correction_id uuid,p_expected_game_version integer,
  p_winner_side text,p_margin integer,p_reason text,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare g app.event_team_games%rowtype; policy app.correction_policy_versions%rowtype; seq integer; h text; prior app.operation_receipts%rowtype; receipt uuid:=extensions.gen_random_uuid(); response jsonb;
begin
  if coalesce(auth.role(),'')<>'service_role' or p_winner_side not in('a','b') or p_margin not between 1 and 121 or p_expected_game_version is null then return jsonb_build_object('status','rejected','code','invalid_request'); end if;
  h:=encode(extensions.digest(convert_to(jsonb_build_array('propose_event_team_score_correction_v1',p_actor_id,p_game_id,p_correction_id,p_expected_game_version,p_winner_side,p_margin,coalesce(p_reason,''))::text,'utf8'),'sha256'),'hex');
  select * into prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
  if found then if prior.request_hash<>h then return jsonb_build_object('status','rejected','code','idempotency_conflict'); end if; return prior.response_payload; end if;
  select * into g from app.event_team_games where id=p_game_id and tournament_id=p_tournament_id for update;
  if not found then return jsonb_build_object('status','rejected','code','game_not_found'); end if;
  if g.state not in('verified','corrected') then return jsonb_build_object('status','rejected','code','invalid_game_state'); end if;
  if g.version<>p_expected_game_version then return jsonb_build_object('status','rejected','code','stale_game_version'); end if;
  if g.winner_side=p_winner_side and g.margin=p_margin then return jsonb_build_object('status','rejected','code','unchanged_correction'); end if;
  if not app.team_actor_is_official_v1(p_actor_id,p_tournament_id,p_game_id) then return jsonb_build_object('status','rejected','code','independent_official_required'); end if;
  select * into policy from app.correction_policy_versions where tournament_id=p_tournament_id order by version desc limit 1;
  if not found then return jsonb_build_object('status','rejected','code','policy_unavailable'); end if;
  if policy.reason_required and nullif(trim(coalesce(p_reason,'')),'') is null then return jsonb_build_object('status','rejected','code','reason_required'); end if;
  if exists(select 1 from app.event_team_score_corrections c where c.team_game_id=p_game_id and c.base_game_version=p_expected_game_version and not exists(select 1 from app.event_team_score_correction_reviews review where review.correction_id=c.id and not review.approved)) then return jsonb_build_object('status','rejected','code','pending_correction_exists'); end if;
  select coalesce(max(sequence),0)+1 into seq from app.event_team_score_corrections where team_game_id=p_game_id;
  response:=jsonb_build_object('status',case when policy.required_approvals=0 then 'team_correction_applied' else 'team_correction_pending' end,'gameId',p_game_id,'correctionId',p_correction_id,'version',case when policy.required_approvals=0 then g.version+1 else g.version end,'requiredApprovals',policy.required_approvals);
  insert into app.operation_receipts(id,actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(receipt,p_actor_id,p_tournament_id,'propose_event_team_score_correction_v1',p_correction_id,h,p_operation_id,'accepted',response,clock_timestamp());
  insert into app.event_team_score_corrections(id,tournament_id,event_id,team_game_id,sequence,previous_winner_side,previous_margin,corrected_winner_side,corrected_margin,reason,actor_profile_id,operation_receipt_id,base_game_version,policy_version,reason_required,required_approvals) values(p_correction_id,p_tournament_id,g.event_id,g.id,seq,g.winner_side,g.margin,p_winner_side,p_margin,nullif(trim(p_reason),''),p_actor_id,receipt,g.version,policy.version,policy.reason_required,policy.required_approvals);
  if policy.required_approvals=0 then perform app.apply_event_team_correction_v1(p_correction_id); end if;
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,before_state,after_state) values(p_tournament_id,p_actor_id,receipt,'event_team_game',p_game_id,case when policy.required_approvals=0 then 'team_correction_applied' else 'team_correction_pending' end,jsonb_build_object('winnerSide',g.winner_side,'margin',g.margin,'version',g.version),response);
  return response;
end $$;

create or replace function public.review_event_team_score_correction_v1(
  p_actor_id uuid,p_tournament_id uuid,p_correction_id uuid,p_review_id uuid,p_approved boolean,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c app.event_team_score_corrections%rowtype; h text; prior app.operation_receipts%rowtype; receipt uuid:=extensions.gen_random_uuid(); response jsonb;
begin
  if coalesce(auth.role(),'')<>'service_role' then return jsonb_build_object('status','rejected','code','invalid_request'); end if;
  h:=encode(extensions.digest(convert_to(jsonb_build_array('review_event_team_score_correction_v1',p_actor_id,p_correction_id,p_review_id,p_approved)::text,'utf8'),'sha256'),'hex');
  select * into prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
  if found then if prior.request_hash<>h then return jsonb_build_object('status','rejected','code','idempotency_conflict'); end if; return prior.response_payload; end if;
  select * into c from app.event_team_score_corrections where id=p_correction_id and tournament_id=p_tournament_id;
  if not found or c.required_approvals<>1 then return jsonb_build_object('status','rejected','code','review_not_available'); end if;
  if c.actor_profile_id=p_actor_id or not app.team_actor_is_official_v1(p_actor_id,p_tournament_id,c.team_game_id) then return jsonb_build_object('status','rejected','code','independent_reviewer_required'); end if;
  if exists(select 1 from app.event_team_score_correction_reviews where correction_id=c.id) then return jsonb_build_object('status','rejected','code','already_reviewed'); end if;
  response:=jsonb_build_object('status',case when p_approved then 'team_correction_applied' else 'team_correction_rejected' end,'correctionId',c.id,'gameId',c.team_game_id,'version',case when p_approved then c.base_game_version+1 else c.base_game_version end);
  insert into app.operation_receipts(id,actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(receipt,p_actor_id,p_tournament_id,'review_event_team_score_correction_v1',p_review_id,h,p_operation_id,'accepted',response,clock_timestamp());
  insert into app.event_team_score_correction_reviews(id,correction_id,tournament_id,event_id,team_game_id,reviewer_profile_id,approved,operation_receipt_id) values(p_review_id,c.id,p_tournament_id,c.event_id,c.team_game_id,p_actor_id,p_approved,receipt);
  if p_approved then perform app.apply_event_team_correction_v1(c.id); end if;
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,p_actor_id,receipt,'event_team_correction',c.id,case when p_approved then 'team_correction_approved' else 'team_correction_rejected' end,response);
  return response;
end $$;

revoke all on function public.propose_event_team_score_correction_v1(uuid,uuid,uuid,uuid,integer,text,integer,text,uuid) from public,anon,authenticated;
grant execute on function public.propose_event_team_score_correction_v1(uuid,uuid,uuid,uuid,integer,text,integer,text,uuid) to service_role;
revoke all on function public.review_event_team_score_correction_v1(uuid,uuid,uuid,uuid,boolean,uuid) from public,anon,authenticated;
grant execute on function public.review_event_team_score_correction_v1(uuid,uuid,uuid,uuid,boolean,uuid) to service_role;

-- Ranking follows the existing ACC card ordering: game points, games won,
-- net spread, total plus spread, then stable display name. Results contain
-- both members and Satellite events never yield qualification or MRPs.
create or replace function public.get_event_team_results_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
with summaries as (
  select t.name tournament_name,e.id event_id,e.name event_name,e.format,e.event_type,te.id team_entry_id,team.display_name team_name,
    coalesce(sum(sl.game_points),0)::integer game_points,coalesce(count(*) filter(where sl.is_winner),0)::integer games_won,
    coalesce(sum(sl.plus_points),0)::integer plus_points,coalesce(sum(sl.minus_points),0)::integer minus_points,
    coalesce(sum(sl.plus_points-sl.minus_points),0)::integer net_points
  from app.events e join app.tournaments t on t.id=e.tournament_id join app.event_team_entries te on te.event_id=e.id join app.event_teams team on team.id=te.team_id
  left join app.event_team_scorelines sl on sl.team_entry_id=te.id
  left join app.event_team_games g on g.id=sl.team_game_id and g.state in('verified','corrected')
  where e.id=p_event_id and e.tournament_id=p_tournament_id group by t.name,e.id,e.name,e.format,e.event_type,te.id,team.display_name
), ranked as (
  select *,row_number() over(order by game_points desc,games_won desc,net_points desc,plus_points desc,team_name) position,count(*) over() total_count from summaries
)
select case when coalesce(auth.role(),'')='service_role' and exists(select 1 from app.tournament_roles role where role.tournament_id=p_tournament_id and role.profile_id=p_actor_id) then jsonb_build_object(
 'tournamentName',(array_agg(r.tournament_name))[1],'eventId',(array_agg(r.event_id))[1],'eventName',(array_agg(r.event_name))[1],'format',(array_agg(r.format))[1],'eventType',(array_agg(r.event_type))[1],
 'qualificationCount',case when (array_agg(r.event_type))[1]='satellite' then 0 else ceil(count(*)::numeric/4.0)::integer end,
 'mrps',case when (array_agg(r.event_type))[1]='satellite' then 'not_applicable_satellite' else 'eligible_after_review' end,
 'entries',coalesce(jsonb_agg(jsonb_build_object('rank',r.position,'teamEntryId',r.team_entry_id,'teamName',r.team_name,'members',(select jsonb_agg(jsonb_build_object('name',m.claimed_display_name,'accNumber',m.claimed_acc_number) order by tm.member_role) from app.event_team_members tm join app.tournament_roster_entries m on m.id=tm.roster_entry_id where tm.team_id=(select team_id from app.event_team_entries where id=r.team_entry_id)),'gamePoints',r.game_points,'gamesWon',r.games_won,'plusSpreadPoints',r.plus_points,'minusSpreadPoints',r.minus_points,'netSpreadPoints',r.net_points,'qualifies',r.event_type<>'satellite' and r.position<=ceil(r.total_count::numeric/4.0)::integer) order by r.position),'[]'::jsonb)) else null end
from ranked r
$$;
revoke all on function public.get_event_team_results_v1(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_event_team_results_v1(uuid,uuid,uuid) to service_role;

alter function public.get_event_team_workspace_v1(uuid,uuid) rename to get_event_team_workspace_base_v2;
create or replace function public.get_event_team_workspace_v1(p_actor_id uuid,p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
with base as (select public.get_event_team_workspace_base_v2(p_actor_id,p_tournament_id) value),
events as (select coalesce(jsonb_agg(jsonb_set(ev,'{pendingCorrections}',coalesce((
  select jsonb_agg(jsonb_build_object('correctionId',c.id,'gameId',c.team_game_id,'editorProfileId',c.actor_profile_id,'winnerSide',c.corrected_winner_side,'margin',c.corrected_margin,'reason',c.reason,'baseGameVersion',c.base_game_version) order by c.created_at)
  from app.event_team_score_corrections c
  where c.event_id=(ev->>'eventId')::uuid and c.required_approvals=1
    and not exists(select 1 from app.event_team_score_correction_reviews review where review.correction_id=c.id)
),'[]'::jsonb),true) order by ev->>'name'),'[]'::jsonb) value
from base,lateral jsonb_array_elements(coalesce(base.value->'events','[]'::jsonb)) ev)
select case when base.value is null then null else jsonb_set(base.value,'{events}',events.value,true) end from base,events
$$;
revoke all on function public.get_event_team_workspace_base_v2(uuid,uuid) from public,anon,authenticated;
revoke all on function public.get_event_team_workspace_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_event_team_workspace_v1(uuid,uuid) to service_role;

notify pgrst,'reload schema';
