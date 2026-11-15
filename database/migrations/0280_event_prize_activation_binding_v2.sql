-- LOCAL proposal. Opt-in V2 declarations bind their own event at activation.
-- Exact accepted historical activations remain replayable; no backfill.
begin;
create table app.event_prize_schedule_bindings_v2(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,event_id uuid not null,
 client_row_id uuid not null,activation_id uuid not null references app.tournament_setup_activations(id),
 setup_event_version_id uuid not null references app.tournament_setup_event_versions(id),
 declaration_version_id uuid not null,settings_fingerprint text not null check(settings_fingerprint~'^[a-f0-9]{64}$'),
 recorded_at timestamptz not null default clock_timestamp(),unique(event_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(declaration_version_id,tournament_id,client_row_id)references app.setup_prize_schedule_versions_v2(id,tournament_id,client_row_id)
);
alter table app.event_prize_schedule_bindings_v2 enable row level security;
alter table app.event_prize_schedule_bindings_v2 force row level security;
revoke all on app.event_prize_schedule_bindings_v2 from public,anon,authenticated,service_role;
create trigger event_prize_schedule_bindings_v2_immutable before update or delete on app.event_prize_schedule_bindings_v2 for each row execute function app.reject_immutable_history();
create index event_prize_schedule_bindings_v2_activation_idx on app.event_prize_schedule_bindings_v2(activation_id);
create index event_prize_schedule_bindings_v2_setup_idx on app.event_prize_schedule_bindings_v2(setup_event_version_id);
create index event_prize_schedule_bindings_v2_declaration_idx on app.event_prize_schedule_bindings_v2(declaration_version_id,tournament_id,client_row_id);

create function app.event_prize_declaration_readiness_v2(tid uuid,rid uuid)returns jsonb
language plpgsql stable security definer set search_path=''as $$
declare e record;settings jsonb;rule app.setup_prize_schedule_versions_v2%rowtype;latest uuid;
begin
 if not exists(select 1 from app.setup_prize_schedule_versions_v2 where tournament_id=tid)then return jsonb_build_object('status','legacy');end if;
 select id into latest from app.tournament_setup_revisions where tournament_id=tid order by version desc limit 1;
 if latest is distinct from rid then return jsonb_build_object('status','blocked','code','stale_setup_revision');end if;
 for e in select*from app.tournament_setup_event_versions where tournament_id=tid and setup_revision_id=rid and event_kind in('main','consolation')and entry_fee_cents>0 order by ordinal loop
  settings:=app.event_prize_settings_v2(tid,e.client_row_id);
  if not app.event_prize_settings_supported_v2(settings)then return jsonb_build_object('status','blocked','code','unsupported_event_declaration');end if;
  select*into rule from app.setup_prize_schedule_versions_v2 where tournament_id=tid and client_row_id=e.client_row_id order by version desc limit 1;
  if not found or rule.settings_fingerprint is distinct from app.event_prize_settings_digest_v2(settings)then return jsonb_build_object('status','blocked','code','event_declaration_required','clientRowId',e.client_row_id);end if;
 end loop;
 return jsonb_build_object('status','ready');
end$$;
revoke all on function app.event_prize_declaration_readiness_v2(uuid,uuid)from public,anon,authenticated,service_role;

create function app.bind_event_prize_declaration_v2(tid uuid,eid uuid,activation uuid,setup_id uuid)returns void
language plpgsql security definer set search_path=''as $$
declare e app.tournament_setup_event_versions%rowtype;rule app.setup_prize_schedule_versions_v2%rowtype;readiness jsonb;
begin
 select*into e from app.tournament_setup_event_versions where id=setup_id and tournament_id=tid;
 if not found then raise exception 'schedule_revision_required';end if;
 readiness:=app.event_prize_declaration_readiness_v2(tid,e.setup_revision_id);
 if readiness->>'status'<>'ready'then raise exception 'schedule_revision_required';end if;
 if e.event_kind not in('main','consolation')or e.entry_fee_cents=0 then return;end if;
 select*into rule from app.setup_prize_schedule_versions_v2 where tournament_id=tid and client_row_id=e.client_row_id order by version desc limit 1;
 if not found then raise exception 'schedule_revision_required';end if;
 insert into app.event_prize_schedule_bindings_v2(tournament_id,event_id,client_row_id,activation_id,setup_event_version_id,declaration_version_id,settings_fingerprint)
 values(tid,eid,e.client_row_id,activation,setup_id,rule.id,rule.settings_fingerprint);
end$$;
revoke all on function app.bind_event_prize_declaration_v2(uuid,uuid,uuid,uuid)from public,anon,authenticated,service_role;

do $patch$declare definition text;anchor text:='perform 1 from app.tournaments where id=new.tournament_id for update;';begin
 definition:=pg_get_functiondef('app.bind_prize_schedule_on_activation_v1()'::regprocedure);
 if position(anchor in definition)=0 then raise exception 'Reviewed activation binding anchor changed';end if;
 definition:=replace(definition,anchor,anchor||E'\n if exists(select 1 from app.setup_prize_schedule_versions_v2 where tournament_id=new.tournament_id)then\n perform app.bind_event_prize_declaration_v2(new.tournament_id,new.event_id,new.id,new.setup_event_version_id);return new;end if;');
 execute definition;
end$patch$;
notify pgrst,'reload schema';
commit;
