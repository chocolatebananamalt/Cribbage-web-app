-- Attach an already-authorized roster account to an existing unscored event.
-- No roster/seat/schedule/start history is rewritten. LOCAL, not applied hosted.
begin;
create table app.event_account_bindings_v1 (
 id uuid primary key default extensions.gen_random_uuid(),
 tournament_id uuid not null references app.tournaments(id),
 event_id uuid not null,
 participant_id uuid not null unique,
 roster_link_id uuid not null references app.roster_account_links(id),
 profile_id uuid not null references app.profiles(id),
 actor_profile_id uuid not null references app.profiles(id),
 operation_receipt_id uuid not null references app.operation_receipts(id),
 prior_profile_id uuid check(prior_profile_id is null),
 bound_at timestamptz not null default clock_timestamp(),
 foreign key(participant_id,event_id,tournament_id) references app.event_participants(id,event_id,tournament_id)
);
create index event_account_bindings_tournament_idx on app.event_account_bindings_v1(tournament_id);
create index event_account_bindings_link_idx on app.event_account_bindings_v1(roster_link_id);
create index event_account_bindings_profile_idx on app.event_account_bindings_v1(profile_id);
create index event_account_bindings_actor_idx on app.event_account_bindings_v1(actor_profile_id);
create index event_account_bindings_receipt_idx on app.event_account_bindings_v1(operation_receipt_id);
alter table app.event_account_bindings_v1 enable row level security;
alter table app.event_account_bindings_v1 force row level security;
revoke all on app.event_account_bindings_v1 from public,anon,authenticated,service_role;
create trigger event_account_bindings_immutable_v1 before update or delete on app.event_account_bindings_v1
 for each row execute function app.reject_immutable_history();

create function app.event_account_binding_safe_v1(p_event_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from app.canonical_games where event_id=p_event_id and (state<>'pending' or version<>1))
 and not exists(select 1 from app.score_submissions where event_id=p_event_id)
 and not exists(select 1 from app.score_confirmations where event_id=p_event_id)
 and not exists(select 1 from app.card_scorelines where event_id=p_event_id)
 and not exists(select 1 from app.paper_card_captures where event_id=p_event_id)
 and not exists(select 1 from app.paper_game_completions where event_id=p_event_id)
 and not exists(select 1 from app.device_failure_recoveries where event_id=p_event_id)
 and not exists(select 1 from app.game_corrections where event_id=p_event_id)
 and not exists(select 1 from app.offline_score_capabilities where event_id=p_event_id)
 and not exists(select 1 from app.qualification_result_versions where event_id=p_event_id)
 and not exists(select 1 from app.operational_game_forfeits where event_id=p_event_id)
 and not exists(select 1 from app.event_excluded_extra_game_records where event_id=p_event_id)
$$;

-- The guard still denies all scheduled identity changes, except a recorded
-- null -> exact existing roster link account on a wholly unscored event.
create or replace function app.protect_scheduled_event_participant()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  if exists(select 1 from app.event_schedule_publications where event_id=new.event_id)then
   raise exception 'published event participant set is immutable';end if;
  return new;
 elsif tg_op='DELETE' then
  if exists(select 1 from app.event_schedule_publications where event_id=old.event_id)then
   raise exception 'published event participant set is immutable';end if;
  return old;
 end if;
 if exists(select 1 from app.event_schedule_publications where event_id in(old.event_id,new.event_id))
 and (new.tournament_id is distinct from old.tournament_id or new.event_id is distinct from old.event_id
 or new.profile_id is distinct from old.profile_id or new.roster_entry_id is distinct from old.roster_entry_id
 or new.table_seat is distinct from old.table_seat)then
  if old.profile_id is null and new.profile_id is not null
  and new.id=old.id and new.tournament_id=old.tournament_id and new.event_id=old.event_id
  and new.roster_entry_id is not distinct from old.roster_entry_id
  and new.table_seat is not distinct from old.table_seat and new.status=old.status
  and app.event_account_binding_safe_v1(old.event_id)
  and exists(select 1 from app.event_account_bindings_v1 binding
   join app.roster_account_links link on link.id=binding.roster_link_id
   where binding.participant_id=old.id and binding.event_id=old.event_id and binding.tournament_id=old.tournament_id
   and binding.profile_id=new.profile_id and binding.prior_profile_id is null
   and link.tournament_id=old.tournament_id and link.roster_entry_id=old.roster_entry_id and link.profile_id=new.profile_id)
  then return new;end if;
  raise exception 'published event participant identity is immutable';
 end if;
 return new;
end$$;

create function app.reconcile_roster_event_account_v1(p_actor_id uuid,p_tournament_id uuid,p_link_id uuid,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare link app.roster_account_links%rowtype; prior app.operation_receipts%rowtype;
 ep app.event_participants%rowtype; receipt uuid; request_hash text; result jsonb;
 bound integer:=0; blocked integer:=0;
begin
 perform app.roster_account_activation_service_only();
 if p_actor_id is null or p_tournament_id is null or p_link_id is null or p_operation_id is null then
  return jsonb_build_object('status','rejected','code','invalid_request');end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
 perform 1 from app.tournaments where id=p_tournament_id and status='open' for update;
 if not found or not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id
  and profile_id=p_actor_id and role in('director','co_director'))then
  return jsonb_build_object('status','rejected','code','not_director');end if;
 select * into link from app.roster_account_links where id=p_link_id and tournament_id=p_tournament_id;
 if not found then return jsonb_build_object('status','rejected','code','link_unavailable');end if;
 request_hash:=encode(extensions.digest(convert_to(jsonb_build_array('reconcile_roster_event_account_v1',
  p_actor_id,p_tournament_id,p_link_id)::text,'utf8'),'sha256'),'hex');
 select * into prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
 if found then
  if prior.operation_type='reconcile_roster_event_account_v1' and prior.request_hash=request_hash then return prior.response_payload;end if;
  return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 -- Enrollment and link creation both lock the tournament. Scoring locks the
 -- game row. Acquire all affected game rows before inspecting evidence.
 perform 1 from app.events e where e.tournament_id=p_tournament_id and exists(select 1 from app.event_participants p
  where p.event_id=e.id and p.roster_entry_id=link.roster_entry_id) order by e.id for update;
 perform 1 from app.canonical_games g where g.tournament_id=p_tournament_id and exists(select 1 from app.event_participants p
  where p.event_id=g.event_id and p.roster_entry_id=link.roster_entry_id) order by g.id for update;
 -- Compute the immutable receipt only after all relevant rows are locked.
 select count(*) filter(where p.profile_id is null and app.event_account_binding_safe_v1(p.event_id)
  and not exists(select 1 from app.event_participants other where other.event_id=p.event_id and other.profile_id=link.profile_id and other.id<>p.id)),
  count(*) filter(where p.profile_id is distinct from link.profile_id and (p.profile_id is not null or not app.event_account_binding_safe_v1(p.event_id)
  or exists(select 1 from app.event_participants other where other.event_id=p.event_id and other.profile_id=link.profile_id and other.id<>p.id)))
 into bound,blocked from app.event_participants p where p.tournament_id=p_tournament_id and p.roster_entry_id=link.roster_entry_id;
 result:=jsonb_build_object('status',case when blocked>0 then 'binding_review_required' else 'event_accounts_reconciled' end,
  'rosterLinkId',link.id,'boundCount',bound,'blockedCount',blocked);
 insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
 values(p_tournament_id,p_actor_id,'reconcile_roster_event_account_v1',p_link_id,request_hash,p_operation_id,'accepted',result,now()) returning id into receipt;
 for ep in select * from app.event_participants where tournament_id=p_tournament_id and roster_entry_id=link.roster_entry_id order by id for update loop
  if ep.profile_id=link.profile_id then continue;end if;
  if ep.profile_id is not null or not app.event_account_binding_safe_v1(ep.event_id)
   or exists(select 1 from app.event_participants other where other.event_id=ep.event_id and other.profile_id=link.profile_id and other.id<>ep.id)
  then
   insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
   values(p_tournament_id,p_actor_id,receipt,'event_participant',ep.id,'roster_account_binding_blocked',
    jsonb_build_object('eventId',ep.event_id,'rosterLinkId',link.id,'reason','event_evidence_or_identity_conflict','profileId',link.profile_id));
   continue;
  end if;
  insert into app.event_account_bindings_v1(tournament_id,event_id,participant_id,roster_link_id,profile_id,actor_profile_id,operation_receipt_id)
   values(p_tournament_id,ep.event_id,ep.id,link.id,link.profile_id,p_actor_id,receipt);
  update app.event_participants set profile_id=link.profile_id where id=ep.id;
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,before_state,after_state)
   values(p_tournament_id,p_actor_id,receipt,'event_participant',ep.id,'existing_roster_account_attached',
    jsonb_build_object('profileId',null,'rosterEntryId',ep.roster_entry_id,'eventId',ep.event_id),
    jsonb_build_object('profileId',link.profile_id,'rosterLinkId',link.id,'rosterEntryId',ep.roster_entry_id,'eventId',ep.event_id));
 end loop;
 return result;
end$$;

create function public.reconcile_roster_event_account_v1(p_actor_id uuid,p_tournament_id uuid,p_link_id uuid,p_operation_id uuid)
returns jsonb language sql security definer set search_path='' as $$
 select app.reconcile_roster_event_account_v1(p_actor_id,p_tournament_id,p_link_id,p_operation_id)
$$;
create function app.attach_new_roster_link_to_events_v1()returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform app.reconcile_roster_event_account_v1(new.actor_profile_id,new.tournament_id,new.id,extensions.gen_random_uuid());
 return new;
end$$;
create trigger attach_new_roster_link_to_events_v1 after insert on app.roster_account_links
 for each row execute function app.attach_new_roster_link_to_events_v1();

revoke all on function app.event_account_binding_safe_v1(uuid),app.reconcile_roster_event_account_v1(uuid,uuid,uuid,uuid),
 app.attach_new_roster_link_to_events_v1(),app.protect_scheduled_event_participant() from public,anon,authenticated,service_role;
revoke all on function public.reconcile_roster_event_account_v1(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.reconcile_roster_event_account_v1(uuid,uuid,uuid,uuid) to service_role;

-- Extra-game evidence does not own a canonical game row. Share the event lock
-- so its insert cannot race a pristine-event account assignment.
create function app.lock_extra_game_binding_boundary_v1()returns trigger language plpgsql security definer set search_path='' as $$
begin perform 1 from app.events where id=new.event_id and tournament_id=new.tournament_id for update;return new;end$$;
revoke all on function app.lock_extra_game_binding_boundary_v1()from public,anon,authenticated,service_role;
create trigger lock_extra_game_binding_boundary_v1 before insert on app.event_excluded_extra_game_records
 for each row execute function app.lock_extra_game_binding_boundary_v1();

-- Private operational read model for the witnessed roster/account activation
-- ceremony. It exposes the selected roster label and lifecycle IDs to a
-- current director or co-director, but never the credential digest, salt, or
-- expected witness phrase.

create or replace function public.get_roster_account_activation_workspace_v1(
  p_actor_id uuid,
  p_tournament_id uuid
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform app.roster_account_activation_service_only();
  if p_actor_id is null or p_tournament_id is null or not exists (
    select 1 from app.tournament_roles role_row
    where role_row.tournament_id = p_tournament_id
      and role_row.profile_id = p_actor_id
      and role_row.role in ('director', 'co_director')
  ) then
    return null;
  end if;

  select jsonb_build_object(
    'tournamentName', tournament.name,
    'eventBindingIssues', coalesce((select jsonb_agg(jsonb_build_object('participantId',participant.id,
      'playerName',roster.claimed_display_name,'eventName',event.name,'reason','Event account assignment needs director review') order by participant.id)
      from app.event_participants participant join app.roster_account_links link on link.tournament_id=participant.tournament_id
      and link.roster_entry_id=participant.roster_entry_id join app.tournament_roster_entries roster on roster.id=participant.roster_entry_id
      join app.events event on event.id=participant.event_id where participant.tournament_id=tournament.id
      and participant.profile_id is distinct from link.profile_id),'[]'::jsonb),
    'rosterEntries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'rosterEntryId', roster.id,
        'displayName', roster.claimed_display_name,
        'activation', case when live_activation.id is null then null else jsonb_build_object(
          'activationId', live_activation.id,
          'state', case when live_activation.expires_at <= now() then 'expired' else live_activation.state end,
          'expiresAt', live_activation.expires_at
        ) end
      ) order by roster.claimed_normalized_name, roster.id)
      from app.tournament_roster_entries roster
      left join lateral (
        select activation.id, activation.state, activation.expires_at
        from app.roster_account_activations activation
        where activation.tournament_id = roster.tournament_id
          and activation.roster_entry_id = roster.id
          and activation.state in ('issued', 'pending')
        order by activation.issued_at desc, activation.id
        limit 1
      ) live_activation on true
      where roster.tournament_id = tournament.id
        and not exists (
          select 1 from app.roster_account_links link_row
          where link_row.tournament_id = roster.tournament_id
            and link_row.roster_entry_id = roster.id
        )
    ), '[]'::jsonb),
    'pendingRequests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'requestId', request_row.id,
        'activationId', activation.id,
        'rosterEntryId', roster.id,
        'rosterDisplayName', roster.claimed_display_name,
        'requestedAt', request_row.requested_at,
        'expiresAt', activation.expires_at,
        'canApprove', request_row.profile_id <> p_actor_id
      ) order by request_row.requested_at, request_row.id)
      from app.roster_account_activation_requests request_row
      join app.roster_account_activations activation
        on activation.id = request_row.activation_id
        and activation.tournament_id = request_row.tournament_id
      join app.tournament_roster_entries roster
        on roster.id = activation.roster_entry_id
        and roster.tournament_id = activation.tournament_id
      where request_row.tournament_id = tournament.id
        and request_row.state = 'pending'
        and activation.state = 'pending'
        and activation.expires_at > now()
    ), '[]'::jsonb)
  ) into v_result
  from app.tournaments tournament
  where tournament.id = p_tournament_id
    and tournament.status in ('draft', 'open');

  return v_result;
end;
$$;

revoke all on function public.get_roster_account_activation_workspace_v1(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_roster_account_activation_workspace_v1(uuid, uuid)
  to service_role;

commit;
