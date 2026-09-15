-- Director-reviewed Satellite packages. Satellite results never contribute
-- MRPs or Main/Consolation qualification.

create table app.satellite_result_packages(
 id uuid primary key,tournament_id uuid not null references app.tournaments(id) on delete restrict,event_id uuid not null,
 created_at timestamptz not null default clock_timestamp(),foreign key(event_id,tournament_id) references app.events(id,tournament_id) on delete restrict,
 unique(event_id),unique(id,tournament_id,event_id)
);
alter table app.satellite_result_packages enable row level security;alter table app.satellite_result_packages force row level security;
revoke all on table app.satellite_result_packages from public,anon,authenticated;
create trigger satellite_result_packages_immutable before update or delete on app.satellite_result_packages for each row execute function app.reject_immutable_history();

create table app.satellite_result_versions(
 id uuid primary key,package_id uuid not null,tournament_id uuid not null,event_id uuid not null,version integer not null check(version>0),
 status text not null check(status in('draft','finalized','reopened','corrected')),
 placements jsonb not null check(jsonb_typeof(placements)='array'),special_hands jsonb not null check(jsonb_typeof(special_hands)='array'),
 director_notes text not null default '' check(length(director_notes)<=2000),cross_check_complete boolean not null,
 mrp_status text not null default 'Not applicable—Satellite event' check(mrp_status='Not applicable—Satellite event'),
 qualification_effect text not null default 'none' check(qualification_effect='none'),
 retention_until date not null check(retention_until>=created_at::date+365),supersedes_version_id uuid,
 approved_by_profile_id uuid references app.profiles(id) on delete restrict,actor_profile_id uuid not null references app.profiles(id) on delete restrict,
 operation_receipt_id uuid not null,created_at timestamptz not null default clock_timestamp(),
 foreign key(package_id,tournament_id,event_id) references app.satellite_result_packages(id,tournament_id,event_id) on delete restrict,
 foreign key(supersedes_version_id) references app.satellite_result_versions(id) on delete restrict,
 foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id) on delete restrict,
 unique(package_id,version),unique(id,tournament_id,event_id)
);
alter table app.satellite_result_versions enable row level security;alter table app.satellite_result_versions force row level security;
revoke all on table app.satellite_result_versions from public,anon,authenticated;
create trigger satellite_result_versions_immutable before update or delete on app.satellite_result_versions for each row execute function app.reject_immutable_history();
create index satellite_result_versions_current_idx on app.satellite_result_versions(package_id,version desc);
create index satellite_result_versions_actor_idx on app.satellite_result_versions(actor_profile_id);

create or replace function app.validate_satellite_result_document_v1(p_placements jsonb,p_special_hands jsonb,p_require_complete boolean)
returns text language plpgsql stable security definer set search_path='' as $$
begin
 if jsonb_typeof(p_placements)<>'array' or jsonb_typeof(p_special_hands)<>'array' then return 'invalid_document';end if;
 if jsonb_array_length(p_placements)<1 and p_require_complete then return 'placements_required';end if;
 if exists(select 1 from jsonb_array_elements(p_placements) item where
   coalesce((item->>'placement')::integer,0)<1 or length(trim(coalesce(item->>'entrantId','')))=0 or length(trim(coalesce(item->>'displayName',''))) not between 1 and 300
   or coalesce((item->>'prizeMinor')::integer,-1)<0 or coalesce((item->>'qPoolMinor')::integer,-1)<0 or coalesce((item->>'sidePoolMinor')::integer,-1)<0
   or jsonb_typeof(item->'crossCheckEvidence')<>'array' or (p_require_complete and jsonb_array_length(item->'crossCheckEvidence')<1)
   or item ? 'mrpPoints' or item ? 'qualifiesFor') then return 'invalid_placement';end if;
 if exists(select 1 from jsonb_array_elements(p_placements) item group by (item->>'placement')::integer having count(*)>1) then return 'duplicate_placement';end if;
 if exists(select 1 from jsonb_array_elements(p_placements) item group by item->>'entrantId' having count(*)>1) then return 'duplicate_entrant';end if;
 if exists(select 1 from jsonb_array_elements(p_special_hands) item where length(trim(coalesce(item->>'entrantId','')))=0 or length(trim(coalesce(item->>'displayName',''))) not between 1 and 300 or coalesce((item->>'hand')::integer,0) not in(28,29) or length(trim(coalesce(item->>'evidenceRef',''))) not between 1 and 500) then return 'invalid_special_hand';end if;
 if p_require_complete and not exists(select 1 from jsonb_array_elements(p_placements) item where (item->>'placement')::integer=1) then return 'winner_required';end if;
 return 'valid';
exception when invalid_text_representation or numeric_value_out_of_range then return 'invalid_document';
end $$;
revoke all on function app.validate_satellite_result_document_v1(jsonb,jsonb,boolean) from public,anon,authenticated;

create or replace function public.preview_satellite_results_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_placements jsonb,p_special_hands jsonb,p_director_notes text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_code text;v_event app.events%rowtype;
begin
 if p_actor_id is null or length(coalesce(p_director_notes,''))>2000 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 if not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director')) then return jsonb_build_object('status','rejected','code','not_director');end if;
 select * into v_event from app.events where id=p_event_id and tournament_id=p_tournament_id and event_type='satellite';if not found then return jsonb_build_object('status','rejected','code','satellite_unavailable');end if;
 v_code:=app.validate_satellite_result_document_v1(p_placements,p_special_hands,true);if v_code<>'valid' then return jsonb_build_object('status','rejected','code',v_code);end if;
 return jsonb_build_object('status','satellite_results_preview','eventId',p_event_id,'eventName',v_event.name,'format',v_event.format,'scoringMethod',v_event.scoring_method,
   'placements',p_placements,'specialHands',p_special_hands,'totalPrizeMinor',(select coalesce(sum((item->>'prizeMinor')::integer),0) from jsonb_array_elements(p_placements)item),
   'totalQPoolMinor',(select coalesce(sum((item->>'qPoolMinor')::integer),0) from jsonb_array_elements(p_placements)item),
   'totalSidePoolMinor',(select coalesce(sum((item->>'sidePoolMinor')::integer),0) from jsonb_array_elements(p_placements)item),
   'crossCheckComplete',true,'mrpStatus','Not applicable—Satellite event','qualificationEffect','none','automaticAccSubmission',false);
end $$;
revoke all on function public.preview_satellite_results_v1(uuid,uuid,uuid,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.preview_satellite_results_v1(uuid,uuid,uuid,jsonb,jsonb,text) to service_role;

create or replace function public.save_satellite_results_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_package_id uuid,p_version_id uuid,p_action text,p_placements jsonb,p_special_hands jsonb,p_director_notes text,p_expected_version integer,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_hash text;v_prior app.operation_receipts%rowtype;v_receipt uuid:=extensions.gen_random_uuid();v_current app.satellite_result_versions%rowtype;v_next integer;v_status text;v_preview jsonb;v_response jsonb;v_require_complete boolean;
begin
 if p_actor_id is null or p_package_id is null or p_version_id is null or p_idempotency_key is null or p_action not in('save_draft','finalize','reopen','correct') or p_expected_version<0 or length(coalesce(p_director_notes,''))>2000 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('save_satellite_results_v1',p_actor_id::text,p_tournament_id::text,p_event_id::text,p_package_id::text,p_version_id::text,p_action,p_placements,p_special_hands,p_director_notes,p_expected_version)::text,'utf8'),'sha256'),'hex');
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_idempotency_key::text,0));perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('satellite-results:'||p_event_id::text,0));
 perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director') for update;if not found then return jsonb_build_object('status','rejected','code','not_director');end if;
 select * into v_prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key;if found then if v_prior.request_hash<>v_hash then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;return v_prior.response_payload;end if;
 if not exists(select 1 from app.events where id=p_event_id and tournament_id=p_tournament_id and event_type='satellite') then return jsonb_build_object('status','rejected','code','satellite_unavailable');end if;
 select version_row.* into v_current from app.satellite_result_packages package join app.satellite_result_versions version_row on version_row.package_id=package.id where package.event_id=p_event_id order by version_row.version desc limit 1;
 if coalesce(v_current.version,0)<>p_expected_version then return jsonb_build_object('status','rejected','code','stale_version');end if;
 if p_expected_version=0 and exists(select 1 from app.satellite_result_packages where id=p_package_id or event_id=p_event_id) then return jsonb_build_object('status','rejected','code','package_conflict');end if;
 if p_expected_version>0 and v_current.package_id<>p_package_id then return jsonb_build_object('status','rejected','code','package_conflict');end if;
 if p_action in('finalize','correct') and p_expected_version=0 then return jsonb_build_object('status','rejected','code','draft_required');end if;
 if p_action='reopen' and v_current.status not in('finalized','corrected') then return jsonb_build_object('status','rejected','code','finalized_version_required');end if;
 if p_action='correct' and v_current.status<>'reopened' then return jsonb_build_object('status','rejected','code','reopened_version_required');end if;
 if p_action='save_draft' and p_expected_version>0 and v_current.status not in('draft','reopened') then return jsonb_build_object('status','rejected','code','version_locked');end if;
 v_require_complete:=p_action in('finalize','correct');
 if app.validate_satellite_result_document_v1(p_placements,p_special_hands,v_require_complete)<>'valid' then return jsonb_build_object('status','rejected','code',app.validate_satellite_result_document_v1(p_placements,p_special_hands,v_require_complete));end if;
 if v_require_complete then v_preview:=public.preview_satellite_results_v1(p_actor_id,p_tournament_id,p_event_id,p_placements,p_special_hands,p_director_notes);if v_preview->>'status'<>'satellite_results_preview' then return v_preview;end if;end if;
 v_next:=p_expected_version+1;v_status:=case p_action when 'save_draft' then case when v_current.status='reopened' then 'reopened' else 'draft' end when 'finalize' then 'finalized' when 'reopen' then 'reopened' else 'corrected' end;
 v_response:=jsonb_build_object('status','satellite_results_saved','eventId',p_event_id,'packageId',p_package_id,'versionId',p_version_id,'version',v_next,'resultStatus',v_status,'crossCheckComplete',v_require_complete,'mrpStatus','Not applicable—Satellite event','qualificationEffect','none','retentionUntil',(current_date+interval '12 months')::date);
 insert into app.operation_receipts(id,actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(v_receipt,p_actor_id,p_tournament_id,'save_satellite_results_v1',p_package_id,v_hash,p_idempotency_key,'accepted',v_response,clock_timestamp());
 if p_expected_version=0 then insert into app.satellite_result_packages(id,tournament_id,event_id) values(p_package_id,p_tournament_id,p_event_id);end if;
 insert into app.satellite_result_versions(id,package_id,tournament_id,event_id,version,status,placements,special_hands,director_notes,cross_check_complete,retention_until,supersedes_version_id,approved_by_profile_id,actor_profile_id,operation_receipt_id)
 values(p_version_id,p_package_id,p_tournament_id,p_event_id,v_next,v_status,p_placements,p_special_hands,coalesce(p_director_notes,''),v_require_complete,(current_date+interval '12 months')::date,case when p_expected_version>0 then v_current.id else null end,case when v_require_complete then p_actor_id else null end,p_actor_id,v_receipt);
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,before_state,after_state) values(p_tournament_id,p_actor_id,v_receipt,'satellite_result_package',p_package_id,'satellite_results_'||p_action,case when p_expected_version>0 then jsonb_build_object('version',v_current.version,'status',v_current.status) else null end,v_response);
 return v_response;
end $$;
revoke all on function public.save_satellite_results_v1(uuid,uuid,uuid,uuid,uuid,text,jsonb,jsonb,text,integer,uuid) from public,anon,authenticated;
grant execute on function public.save_satellite_results_v1(uuid,uuid,uuid,uuid,uuid,text,jsonb,jsonb,text,integer,uuid) to service_role;

create or replace function public.get_satellite_results_workspace_v1(p_actor_id uuid,p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select case when exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director','cross_checker','viewer','player')) then jsonb_build_object(
  'tournamentName',tournament.name,'events',coalesce((select jsonb_agg(jsonb_build_object('eventId',event_row.id,'name',event_row.name,'format',event_row.format,'scoringMethod',event_row.scoring_method,
   'participants',coalesce((select jsonb_agg(jsonb_build_object('participantId',participant.id,'displayName',coalesce(roster.claimed_display_name,profile.display_name)) order by coalesce(roster.claimed_display_name,profile.display_name)) from app.event_participants participant left join app.tournament_roster_entries roster on roster.id=participant.roster_entry_id left join app.profiles profile on profile.id=participant.profile_id where participant.event_id=event_row.id),'[]'::jsonb),
   'current',case when current.id is null then null else jsonb_build_object('packageId',current.package_id,'versionId',current.id,'version',current.version,'status',current.status,'placements',current.placements,'specialHands',current.special_hands,'directorNotes',current.director_notes,'crossCheckComplete',current.cross_check_complete,'mrpStatus',current.mrp_status,'qualificationEffect',current.qualification_effect,'retentionUntil',current.retention_until,'approvedBy',approver.display_name,'approvedAt',current.created_at) end
  ) order by event_row.name) from app.events event_row left join app.satellite_result_packages package on package.event_id=event_row.id left join lateral(select * from app.satellite_result_versions version_row where version_row.package_id=package.id order by version_row.version desc limit 1)current on true left join app.profiles approver on approver.id=current.approved_by_profile_id where event_row.tournament_id=tournament.id and event_row.event_type='satellite'),'[]'::jsonb)
 ) else null end from app.tournaments tournament where tournament.id=p_tournament_id
$$;
revoke all on function public.get_satellite_results_workspace_v1(uuid,uuid) from public,anon,authenticated;grant execute on function public.get_satellite_results_workspace_v1(uuid,uuid) to service_role;

notify pgrst,'reload schema';
