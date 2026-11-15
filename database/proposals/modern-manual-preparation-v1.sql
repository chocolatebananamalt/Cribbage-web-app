-- PRIVATE DEFAULT OFF. Primary-Director rules -> Start -> ordinary manual
-- generation preparation. Existing actual authoring transactions own authority.
begin;
create function app.modern_manual_preparation_enabled_v1()returns boolean language sql stable set search_path=''as $$select false$$;
create function public.get_modern_manual_preparation_v1(actor uuid,sid uuid,tid uuid,eid uuid)returns jsonb language plpgsql security definer set search_path=''set timezone='UTC'as $$
declare gate jsonb;r app.event_settings_playoff_reviews_v1%rowtype;st app.event_settings_playoff_starts_v1%rowtype;source jsonb;slots jsonb:='[]';players jsonb;i integer;q integer;draft jsonb;regular_format jsonb;final_format jsonb;begin
 if app.modern_manual_preparation_enabled_v1()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 gate:=app.selected_step_pool_playoff_source_v3(actor,tid,eid);if gate->>'status'is distinct from'source_available'then return jsonb_build_object('status','held','code',coalesce(gate->>'code','current_playoff_source_required'));end if;
 select qualifier_count into q from app.qualification_result_versions where id=(gate->>'qualificationId')::uuid and tournament_id=tid and event_id=eid;if q not in(4,5)then return jsonb_build_object('status','held','code','unsupported_qualifier_count');end if;
 draft:=gate#>'{source,settingsBinding,draft}';regular_format:=app.resolve_event_series_format_v1(draft#>'{series,regular}');final_format:=app.resolve_event_series_format_v1(case when draft->>'finalMode'='separate'then draft#>'{series,final}'else draft#>'{series,regular}'end);
 select*into r from app.event_settings_playoff_reviews_v1 where tournament_id=tid and event_id=eid and source_digest=gate->>'sourceDigest'and qualification_id=(gate->>'qualificationId')::uuid order by created_at desc limit 1;
 select*into st from app.event_settings_playoff_starts_v1 where tournament_id=tid and event_id=eid order by version desc limit 1;
 for i in 1..q-1 loop
  source:=case when st.id is not null and st.source_digest=gate->>'sourceDigest'then app.modern_manual_playoff_source_v1(actor,tid,eid,(gate->>'qualificationId')::uuid,i)else jsonb_build_object('status','blocked','code','current_playoff_start_required')end;
  if source->>'status'='source_available'then
   select jsonb_agg(jsonb_build_object('name',qr.display_name_snapshot,'tournamentPlayerId',a.verification_id,'mode',source->'source'->'modes'->(x.n::integer-1))order by x.n)into players from jsonb_array_elements_text(source->'participants')with ordinality x(id,n)join app.event_participants p on p.id=x.id::uuid and p.tournament_id=tid and p.event_id=eid join app.qualification_result_rows qr on qr.result_version_id=(gate->>'qualificationId')::uuid and qr.participant_id=p.id join app.initial_seating_assignments a on a.tournament_id=tid and a.roster_entry_id=p.roster_entry_id;
   if jsonb_array_length(players)<>2 then return null;end if;
   slots:=slots||jsonb_build_array(jsonb_build_object('slot',i,'status','available','sourceDigest',source->'sourceDigest','expectedVersion',source->'currentGenerationVersion','generationId',source->'currentGenerationId','generationCurrent',exists(select 1 from app.modern_manual_playoff_generations_v1 g where g.id=(source->>'currentGenerationId')::uuid and g.source_digest=source->>'sourceDigest'),'round',source->'round','players',players));
  else slots:=slots||jsonb_build_array(jsonb_build_object('slot',i,'status','held','code',coalesce(source->>'code','current_match_source_required')));end if;
 end loop;
 if app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 return jsonb_build_object('kind','modern-manual-preparation-v1','actorId',actor,'tournamentId',tid,'eventId',eid,'sourceDigest',gate->'sourceDigest','qualificationId',gate->'qualificationId','settingsBindingId',gate->'settingsBindingId','reviewId',gate->'reviewId','playStartId',gate->'playStartId','schedulePublicationId',gate->'schedulePublicationId','originalEntrants',gate->'originalEntrants','qualifierCount',q,'regularFormat',regular_format,'finalFormat',final_format,'gateReviewId',r.id,'expectedStartId',st.id,'startedCurrent',st.id is not null and st.source_digest=gate->>'sourceDigest','slots',slots,'moneyMoved',false);
exception when lock_not_available then return jsonb_build_object('status','held','code','source_busy');end$$;
create function public.execute_modern_manual_preparation_v1(actor uuid,sid uuid,tid uuid,eid uuid,action text,op uuid,request jsonb,checking boolean)returns jsonb language plpgsql security definer set search_path=''set timezone='UTC'as $$
declare old app.event_settings_playoff_operations_v1%rowtype;g app.modern_manual_playoff_generations_v1%rowtype;result jsonb;begin
 if app.modern_manual_preparation_enabled_v1()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true or action is null or action not in('review','start','generate')or op is null or checking is null then return null;end if;
 if not pg_try_advisory_xact_lock(hashtextextended('modern-manual-preparation:'||actor||':'||op,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 if action in('review','start')then
  select*into old from app.event_settings_playoff_operations_v1 where actor_id=actor and operation_id=op;
  if old.operation_id is not null then
   if old.tournament_id<>tid or old.event_id<>eid or old.request_payload is distinct from request then result:=jsonb_build_object('status','rejected','code','operation_conflict');else result:=old.result;end if;
  elsif checking then result:=jsonb_build_object('status','unknown','code','operation_not_found');
  elsif request->>'operationId'is distinct from op::text or request->>'kind'is distinct from(case when action='review'then'selected-step-playoff-review-v3'else'selected-step-playoff-start-v3'end)then result:=jsonb_build_object('status','rejected','code','invalid_request');
  elsif action='start'and exists(select 1 from app.modern_manual_playoff_games_v1 played_game join app.modern_manual_playoff_evidence_v1 played_entry on played_entry.game_id=played_game.id where played_game.tournament_id=tid and played_game.event_id=eid)then result:=jsonb_build_object('status','blocked','code','manual_play_requires_separate_restart_review');
  elsif action='review'then result:=app.review_selected_step_playoffs_v3(actor,sid,tid,eid,request);
  else result:=app.start_selected_step_playoffs_v3(actor,sid,tid,eid,request);end if;
 else
  select*into g from app.modern_manual_playoff_generations_v1 where actor_id=actor and operation_id=op;
  if g.id is not null then
   if g.tournament_id<>tid or g.event_id<>eid or g.request is distinct from request then result:=jsonb_build_object('status','rejected','code','operation_conflict');else result:=jsonb_build_object('status','generation_recorded','generationId',g.id,'operationId',op);end if;
  elsif checking then result:=jsonb_build_object('status','unknown','code','operation_not_found');else result:=app.create_modern_manual_playoff_generation_v1(actor,sid,tid,eid,op,request);end if;
 end if;
 if app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 return jsonb_build_object('kind','modern-manual-preparation-reply-v1','actorId',actor,'tournamentId',tid,'eventId',eid,'action',action,'operationId',op,'request',request,'result',result,'historicalReceipt',true,'currentSourceVerified',false,'moneyMoved',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;
do $$declare s text;begin foreach s in array array['app.modern_manual_preparation_enabled_v1()','public.get_modern_manual_preparation_v1(uuid,uuid,uuid,uuid)','public.execute_modern_manual_preparation_v1(uuid,uuid,uuid,uuid,text,uuid,jsonb,boolean)']loop execute format('alter function %s owner to postgres',s);execute format('revoke all on function %s from public,anon,authenticated,service_role',s);end loop;end$$;
commit;
