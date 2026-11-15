-- A replacement is an exceptional pre-play recovery action.  It must retain
-- the original evidence while carrying eligible enrollment and the
-- tournament-level payment-credit view into the replacement.  Payment events
-- are deliberately tournament-scoped and immutable; this ledger records the
-- transfer reference rather than duplicating or moving money.

create table app.event_replacement_transfer_records (
  id uuid primary key default extensions.gen_random_uuid(),
  event_change_operation_id uuid not null references app.event_change_operations(id) on delete restrict,
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  source_event_id uuid not null,
  replacement_event_id uuid not null,
  transfer_kind text not null check (transfer_kind in (
    'individual_enrollment', 'tournament_payment_credit',
    'team_enrollment', 'team_financial_contribution'
  )),
  source_record_id uuid not null,
  destination_record_id uuid,
  roster_entry_id uuid references app.tournament_roster_entries(id) on delete restrict,
  payment_event_id uuid references app.roster_payment_events(id) on delete restrict,
  amount_minor integer not null default 0 check (amount_minor between 0 and 100000000),
  transferred_at timestamptz not null default clock_timestamp(),
  foreign key (source_event_id, tournament_id) references app.events(id, tournament_id) on delete restrict,
  foreign key (replacement_event_id, tournament_id) references app.events(id, tournament_id) on delete restrict,
  unique (event_change_operation_id, transfer_kind, source_record_id)
);
alter table app.event_replacement_transfer_records enable row level security;
alter table app.event_replacement_transfer_records force row level security;
revoke all on table app.event_replacement_transfer_records from public, anon, authenticated;
create trigger event_replacement_transfer_records_immutable
before update or delete on app.event_replacement_transfer_records
for each row execute function app.reject_immutable_history();
create index event_replacement_transfer_records_change_idx
  on app.event_replacement_transfer_records(event_change_operation_id, transferred_at);

create or replace function app.record_event_replacement_payment_credit(
  p_change_id uuid, p_tournament_id uuid, p_source_event_id uuid,
  p_replacement_event_id uuid, p_source_record_id uuid, p_roster_entry_id uuid
) returns void language plpgsql security definer set search_path='' as $$
declare v_payment app.roster_payment_events%rowtype;
begin
  if p_roster_entry_id is null then return; end if;
  select payment.* into v_payment
  from app.roster_payment_events payment
  where payment.tournament_id=p_tournament_id and payment.roster_entry_id=p_roster_entry_id
  order by payment.version desc limit 1;
  if found and v_payment.event_type='received' then
    insert into app.event_replacement_transfer_records(
      event_change_operation_id,tournament_id,source_event_id,replacement_event_id,
      transfer_kind,source_record_id,destination_record_id,roster_entry_id,payment_event_id,amount_minor
    ) values (
      p_change_id,p_tournament_id,p_source_event_id,p_replacement_event_id,
      'tournament_payment_credit',v_payment.id,v_payment.id,p_roster_entry_id,v_payment.id,v_payment.amount_minor
    ) on conflict (event_change_operation_id,transfer_kind,source_record_id) do nothing;
  end if;
end $$;
revoke all on function app.record_event_replacement_payment_credit(uuid,uuid,uuid,uuid,uuid,uuid) from public, anon, authenticated;

create or replace function app.transfer_event_replacement_membership_and_credit()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_participant app.event_participants%rowtype;
  v_new_participant_id uuid;
  v_team app.event_teams%rowtype;
  v_new_team_id uuid;
  v_source_entry app.event_team_entries%rowtype;
  v_new_entry_id uuid;
  v_entry_version app.event_team_entry_versions%rowtype;
  v_member app.event_team_members%rowtype;
  v_contribution app.event_team_financial_contributions%rowtype;
  v_new_contribution_id uuid;
begin
  if new.operation_kind <> 'replace' then return new; end if;
  if new.replacement_event_id is null then
    raise exception using errcode='P0001', message='replacement event unavailable';
  end if;

  -- Do not move history.  Create replacement-scoped participant records for
  -- enrolled people only; prior withdrawals, disqualifications, and
  -- substitutions stay attached to the retired source event for review.
  for v_participant in
    select * from app.event_participants
    where tournament_id=new.tournament_id and event_id=new.original_event_id
      and status in ('registered','checked_in','absent')
    order by id
  loop
    v_new_participant_id:=extensions.gen_random_uuid();
    insert into app.event_participants(id,tournament_id,event_id,profile_id,table_seat,status,roster_entry_id)
    values(v_new_participant_id,new.tournament_id,new.replacement_event_id,
      v_participant.profile_id,v_participant.table_seat,v_participant.status,v_participant.roster_entry_id);
    insert into app.event_replacement_transfer_records(
      event_change_operation_id,tournament_id,source_event_id,replacement_event_id,
      transfer_kind,source_record_id,destination_record_id,roster_entry_id
    ) values(new.id,new.tournament_id,new.original_event_id,new.replacement_event_id,
      'individual_enrollment',v_participant.id,v_new_participant_id,v_participant.roster_entry_id);
    perform app.record_event_replacement_payment_credit(new.id,new.tournament_id,
      new.original_event_id,new.replacement_event_id,v_participant.id,v_participant.roster_entry_id);
  end loop;

  -- Team events keep their independently registered teams, members, scorer
  -- choice, and contribution history.  The copied rows are new replacement
  -- records; the original never changes and can still be audited or refunded.
  for v_team in
    select * from app.event_teams
    where tournament_id=new.tournament_id and event_id=new.original_event_id
    order by id
  loop
    v_new_team_id:=extensions.gen_random_uuid();
    insert into app.event_teams(id,tournament_id,event_id,display_name,created_by_profile_id)
    values(v_new_team_id,new.tournament_id,new.replacement_event_id,v_team.display_name,v_team.created_by_profile_id);
    insert into app.event_replacement_transfer_records(
      event_change_operation_id,tournament_id,source_event_id,replacement_event_id,
      transfer_kind,source_record_id,destination_record_id
    ) values(new.id,new.tournament_id,new.original_event_id,new.replacement_event_id,
      'team_enrollment',v_team.id,v_new_team_id);

    for v_member in select * from app.event_team_members where team_id=v_team.id order by id loop
      insert into app.event_team_members(id,team_id,tournament_id,event_id,roster_entry_id,profile_id,acc_number_snapshot,member_role,claimed_at)
      values(extensions.gen_random_uuid(),v_new_team_id,new.tournament_id,new.replacement_event_id,
        v_member.roster_entry_id,v_member.profile_id,v_member.acc_number_snapshot,v_member.member_role,v_member.claimed_at);
      perform app.record_event_replacement_payment_credit(new.id,new.tournament_id,
        new.original_event_id,new.replacement_event_id,v_member.id,v_member.roster_entry_id);
    end loop;

    select * into v_source_entry from app.event_team_entries where team_id=v_team.id for update;
    if found then
      v_new_entry_id:=extensions.gen_random_uuid();
      insert into app.event_team_entries(id,team_id,tournament_id,event_id,entry_fee_minor,scorecard_type,digital_scoring_enabled)
      values(v_new_entry_id,v_new_team_id,new.tournament_id,new.replacement_event_id,
        v_source_entry.entry_fee_minor,v_source_entry.scorecard_type,v_source_entry.digital_scoring_enabled);
      select * into v_entry_version from app.event_team_entry_versions
        where team_entry_id=v_source_entry.id order by version desc limit 1;
      if found then
        insert into app.event_team_entry_versions(
          team_entry_id,tournament_id,event_id,version,scorecard_type,designated_scorer_profile_id,
          actor_profile_id,operation_receipt_id,reason,scorer_resolution_status
        ) values(
          v_new_entry_id,new.tournament_id,new.replacement_event_id,1,v_entry_version.scorecard_type,
          v_entry_version.designated_scorer_profile_id,new.actor_profile_id,new.operation_receipt_id,
          'Transferred with pre-play event replacement',v_entry_version.scorer_resolution_status
        );
      end if;
      for v_contribution in select * from app.event_team_financial_contributions where team_entry_id=v_source_entry.id order by id loop
        v_new_contribution_id:=extensions.gen_random_uuid();
        insert into app.event_team_financial_contributions(id,team_entry_id,roster_entry_id,tournament_id,amount_minor,contribution_type)
        values(v_new_contribution_id,v_new_entry_id,v_contribution.roster_entry_id,new.tournament_id,
          v_contribution.amount_minor,v_contribution.contribution_type);
        insert into app.event_replacement_transfer_records(
          event_change_operation_id,tournament_id,source_event_id,replacement_event_id,
          transfer_kind,source_record_id,destination_record_id,roster_entry_id,amount_minor
        ) values(new.id,new.tournament_id,new.original_event_id,new.replacement_event_id,
          'team_financial_contribution',v_contribution.id,v_new_contribution_id,
          v_contribution.roster_entry_id,v_contribution.amount_minor);
      end loop;
    end if;
  end loop;
  return new;
end $$;
revoke all on function app.transfer_event_replacement_membership_and_credit() from public, anon, authenticated;
create trigger event_change_operations_transfer_replacement_membership
after insert on app.event_change_operations
for each row execute function app.transfer_event_replacement_membership_and_credit();

notify pgrst, 'reload schema';
