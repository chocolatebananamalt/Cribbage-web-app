-- UNEXECUTED private activation-source reader. No activation/write/grant.
-- Requires event-settings-workspace-v3.sql. Existing declaration guards remain.
begin;
create function app.get_event_settings_activation_source_v4(p_tournament_id uuid)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $$
declare a uuid:=auth.uid();w jsonb;rid uuid;s app.event_settings_snapshots_v3%rowtype;
 links app.setup_event_link_versions_v1%rowtype;settings_hash text;legacy_rows jsonb;legacy_pins jsonb;configured_rows jsonb;unresolved boolean;
begin
 if a is null then return jsonb_build_object('status','blocked','code','authentication_required');end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=p_tournament_id for share nowait;
 if not found then return jsonb_build_object('status','blocked','code','tournament_unavailable');end if;
 perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=a and role in('director','co_director')order by role for key share nowait;
 if not found then return jsonb_build_object('status','blocked','code','not_director');end if;
 w:=app.get_event_settings_workspace_v3(p_tournament_id);
 if w->>'status'='retry_exact'then return w;end if;
 if w->>'actorId'is distinct from a::text or w->>'tid'is distinct from p_tournament_id::text or jsonb_typeof(w->'currentSnapshot')is distinct from'object'then return jsonb_build_object('status','blocked','code','settings_source_unavailable');end if;
 rid:=(w#>>'{base,setupRevisionId}')::uuid;
 select*into s from app.event_settings_snapshots_v3 where tournament_id=p_tournament_id and setup_revision_id=rid;
 select*into links from app.setup_event_link_versions_v1 where tournament_id=p_tournament_id and setup_revision_id=rid;
 if s.id is null or links.id is null or not links.complete then return jsonb_build_object('status','blocked','code','association_or_settings_unavailable');end if;
 -- Preserve the old paid-event requirement only for legacy settings. A free
 -- event must not gain a new prize-declaration requirement through this reader.
 select coalesce(jsonb_agg(e.client_row_id order by e.client_row_id),'[]')into legacy_rows
 from app.tournament_setup_event_versions e join lateral jsonb_array_elements(s.effective_settings)x on x->>'eventClientRowId'=e.client_row_id::text
 where e.tournament_id=p_tournament_id and e.setup_revision_id=rid and e.event_kind in('main','consolation')and e.entry_fee_cents>0 and x->>'mode'='legacy_checks_required';
 select coalesce(jsonb_agg(jsonb_build_object('clientRowId',e.client_row_id,'declarationId',d.id,'settingsFingerprint',d.settings_fingerprint)order by e.client_row_id),'[]')into legacy_pins
 from app.tournament_setup_event_versions e join lateral jsonb_array_elements(legacy_rows)x on x#>>'{}'=e.client_row_id::text
 join lateral(select*from app.setup_prize_schedule_versions_v2 v where v.tournament_id=e.tournament_id and v.client_row_id=e.client_row_id order by v.version desc limit 1)d on true
 where e.tournament_id=p_tournament_id and e.setup_revision_id=rid and app.event_prize_settings_supported_v2(app.event_prize_settings_v2(p_tournament_id,e.client_row_id))
 and d.settings_fingerprint=app.event_prize_settings_digest_v2(app.event_prize_settings_v2(p_tournament_id,e.client_row_id));
 unresolved:=jsonb_array_length(legacy_pins)<>jsonb_array_length(legacy_rows);
 select coalesce(jsonb_agg(jsonb_build_object('eventClientRowId',e.client_row_id,'setupEventVersionId',e.id,'eventKind',e.event_kind,'draft',x->'draft')order by e.client_row_id),'[]')into configured_rows
 from app.tournament_setup_event_versions e join lateral jsonb_array_elements(s.effective_settings)x on x->>'eventClientRowId'=e.client_row_id::text
 where e.tournament_id=p_tournament_id and e.setup_revision_id=rid and x->>'mode'='configured';
 settings_hash:=encode(extensions.digest(convert_to(jsonb_build_array('event-settings-activation-source-v4',p_tournament_id,rid,s.id,s.effective_settings,links.association_hash,legacy_rows,legacy_pins)::text,'utf8'),'sha256'),'hex');
 return jsonb_build_object('status','source_available','kind','event-settings-activation-source-v4','actorId',a,'tournamentId',p_tournament_id,
  'setupRevisionId',rid,'setupVersion',w#>'{base,setupVersion}','settingsSnapshotId',s.id,'settingsDigest',settings_hash,'associationHash',links.association_hash,
  'snapshot',w->'currentSnapshot','configuredRows',configured_rows,'legacyDeclarationRequiredRows',legacy_rows,'legacyDeclarationPins',legacy_pins,
  'legacyDeclarationsCurrent',not unresolved,'perEventContextReviewRequired',jsonb_array_length(configured_rows)>0,'activationAllowed',false,'moneyMoved',false);
 -- No fabricated duration/sanctioning/approval records, and no old activation
 -- call that would bypass settings review. The versioned context/review store
 -- and operational binding writer remain separate implementation requirements.
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
end$$;
alter function app.get_event_settings_activation_source_v4(uuid)owner to postgres;
revoke all on function app.get_event_settings_activation_source_v4(uuid)from public,anon,authenticated,service_role;
commit;
