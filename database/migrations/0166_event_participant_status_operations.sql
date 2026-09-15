-- Audited, event-scoped participant states. These operations intentionally do
-- not manufacture game results; an official must use a separately sourced,
-- game-specific adjudication/correction workflow for any forfeit.

alter table app.event_participants drop constraint event_participants_status_check;
alter table app.event_participants add constraint event_participants_status_check
  check(status in('registered','checked_in','absent','substituted','withdrawn','disqualified'));

create table app.event_participant_status_events(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,event_id uuid not null,
 participant_id uuid not null,sequence integer not null check(sequence>0),operation_kind text not null check(operation_kind in('mark_absent','mark_substituted','withdraw','disqualify','reinstate')),
 prior_status text not null,new_status text not null,reason text not null check(length(trim(reason)) between 1 and 500),
 actor_profile_id uuid not null references app.profiles(id) on delete restrict,operation_receipt_id uuid not null,created_at timestamptz not null default clock_timestamp(),
 foreign key(participant_id,event_id,tournament_id) references app.event_participants(id,event_id,tournament_id) on delete restrict,
 foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id) on delete restrict,
 unique(participant_id,sequence)
);
alter table app.event_participant_status_events enable row level security;alter table app.event_participant_status_events force row level security;revoke all on table app.event_participant_status_events from public,anon,authenticated;
create trigger event_participant_status_events_immutable before update or delete on app.event_participant_status_events for each row execute function app.reject_immutable_history();
create index event_participant_status_events_scope_idx on app.event_participant_status_events(event_id,participant_id,sequence desc);

create or replace function public.get_event_participant_status_workspace_v1(p_actor_id uuid,p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
select case when exists(select 1 from app.tournament_roles role_row where role_row.tournament_id=p_tournament_id and role_row.profile_id=p_actor_id and role_row.role in('director','co_director')) then jsonb_build_object('tournamentName',tournament.name,'events',coalesce((select jsonb_agg(jsonb_build_object('eventId',event_row.id,'name',event_row.name,'playState',app.event_play_state_v1(event_row.id),'participants',coalesce((select jsonb_agg(jsonb_build_object('participantId',participant.id,'displayName',coalesce(roster.claimed_display_name,profile.display_name),'verificationId',coalesce(seating.verification_id,participant.table_seat),'status',participant.status) order by coalesce(roster.claimed_display_name,profile.display_name)) from app.event_participants participant left join app.tournament_roster_entries roster on roster.id=participant.roster_entry_id left join app.profiles profile on profile.id=participant.profile_id left join app.initial_seating_assignments seating on seating.tournament_id=participant.tournament_id and seating.roster_entry_id=participant.roster_entry_id where participant.event_id=event_row.id),'[]'::jsonb)) order by event_row.event_type,event_row.name) from app.events event_row where event_row.tournament_id=tournament.id),'[]'::jsonb)) else null end from app.tournaments tournament where tournament.id=p_tournament_id
$$;
revoke all on function public.get_event_participant_status_workspace_v1(uuid,uuid) from public,anon,authenticated;grant execute on function public.get_event_participant_status_workspace_v1(uuid,uuid) to service_role;

create or replace function public.set_event_participant_status_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_participant_id uuid,p_operation_kind text,p_reason text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_participant app.event_participants%rowtype;v_new text;v_seq integer;v_hash text;v_prior app.operation_receipts%rowtype;v_receipt uuid:=extensions.gen_random_uuid();v_response jsonb;
begin
 if p_actor_id is null or p_idempotency_key is null or p_operation_kind not in('mark_absent','mark_substituted','withdraw','disqualify','reinstate') or length(trim(p_reason)) not between 1 and 500 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 v_new:=case p_operation_kind when 'mark_absent' then 'absent' when 'mark_substituted' then 'substituted' when 'withdraw' then 'withdrawn' when 'disqualify' then 'disqualified' else 'checked_in' end;
 v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('set_event_participant_status_v1',p_actor_id::text,p_tournament_id::text,p_event_id::text,p_participant_id::text,p_operation_kind,trim(p_reason))::text,'utf8'),'sha256'),'hex');
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_idempotency_key::text,0));perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('participant-status:'||p_participant_id::text,0));
 perform 1 from app.tournament_roles role_row where role_row.tournament_id=p_tournament_id and role_row.profile_id=p_actor_id and role_row.role in('director','co_director') for update;if not found then return jsonb_build_object('status','rejected','code','not_director');end if;
 select * into v_prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key;if found then if v_prior.request_hash<>v_hash then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;return v_prior.response_payload;end if;
 select * into v_participant from app.event_participants participant where participant.id=p_participant_id and participant.event_id=p_event_id and participant.tournament_id=p_tournament_id for update;if not found then return jsonb_build_object('status','rejected','code','participant_unavailable');end if;
 if app.event_play_state_v1(p_event_id)='finalized' then return jsonb_build_object('status','rejected','code','event_finalized');end if;
 if p_operation_kind='reinstate' and v_participant.status not in('absent','withdrawn','disqualified','substituted') then return jsonb_build_object('status','rejected','code','invalid_transition');end if;
 if p_operation_kind<>'reinstate' and v_participant.status=v_new then return jsonb_build_object('status','rejected','code','invalid_transition');end if;
 select coalesce(max(status_event.sequence),0)+1 into v_seq from app.event_participant_status_events status_event where status_event.participant_id=p_participant_id;
 v_response:=jsonb_build_object('status','participant_status_recorded','eventId',p_event_id,'participantId',p_participant_id,'participantStatus',v_new,'operationKind',p_operation_kind);
 insert into app.operation_receipts(id,actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(v_receipt,p_actor_id,p_tournament_id,'set_event_participant_status_v1',p_participant_id,v_hash,p_idempotency_key,'accepted',v_response,clock_timestamp());
 insert into app.event_participant_status_events(tournament_id,event_id,participant_id,sequence,operation_kind,prior_status,new_status,reason,actor_profile_id,operation_receipt_id) values(p_tournament_id,p_event_id,p_participant_id,v_seq,p_operation_kind,v_participant.status,v_new,trim(p_reason),p_actor_id,v_receipt);
 update app.event_participants set status=v_new where id=p_participant_id;
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,before_state,after_state) values(p_tournament_id,p_actor_id,v_receipt,'event_participant',p_participant_id,p_operation_kind,jsonb_build_object('status',v_participant.status),v_response);
 return v_response;
end $$;
revoke all on function public.set_event_participant_status_v1(uuid,uuid,uuid,uuid,text,text,uuid) from public,anon,authenticated;grant execute on function public.set_event_participant_status_v1(uuid,uuid,uuid,uuid,text,text,uuid) to service_role;
notify pgrst,'reload schema';
