-- PRIVATE / DEFAULT OFF. Matching normal-cookie RPC surface, EXECUTE revoked.
-- No cohort grants or enablement. Full internal evidence is never returned.
begin;
create function app.selected_step_player_transport_enabled_v3()returns boolean language sql stable set search_path=''as $$select false$$;
create function public.get_selected_step_player_matches_v3(tid uuid)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $body$
declare actor uuid:=app.selected_step_player_actor_v3();g record;view jsonb;matches jsonb:='[]';
begin
 if app.selected_step_player_transport_enabled_v3()is distinct from true or actor is null then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 for g in select gen.id,gen.event_id,gen.qualification_id,gen.slot,e.name from app.playoff_series_generations_v1 gen
  join app.events e on e.id=gen.event_id and e.tournament_id=gen.tournament_id
  where gen.tournament_id=tid and actor in(gen.side_a_profile_id,gen.side_b_profile_id)
   and not exists(select 1 from app.playoff_series_generations_v1 newer where newer.match_id=gen.match_id and newer.version>gen.version)
  order by e.name,gen.slot,gen.id limit 100 loop
  view:=app.get_selected_step_player_view_v3(tid,g.event_id,g.qualification_id,g.slot,g.id);
  if view->>'status'='retry_exact'then return view;end if;
  if view->>'status'='player_game_available'then matches:=matches||jsonb_build_array(jsonb_build_object('eventName',g.name,'view',view));end if;
 end loop;
 if app.selected_step_player_actor_v3()is distinct from actor then return null;end if;
 return jsonb_build_object('status','player_matches_available','tournamentId',tid,'matches',matches);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$body$;
create function public.get_selected_step_player_view_provider_v3(tid uuid,eid uuid,qid uuid,slot_no integer,gid uuid)returns jsonb
language plpgsql security definer set search_path=''as $$begin
 if app.selected_step_player_transport_enabled_v3()is distinct from true then return null;end if;
 return app.get_selected_step_player_view_v3(tid,eid,qid,slot_no,gid);
end$$;
create function public.submit_selected_step_player_action_provider_v3(tid uuid,eid uuid,qid uuid,slot_no integer,request jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$begin
 if app.selected_step_player_transport_enabled_v3()is distinct from true then return null;end if;
 return app.submit_selected_step_player_action_v3(tid,eid,qid,slot_no,request);
end$$;
create function public.get_selected_step_player_action_provider_v3(tid uuid,op uuid)returns jsonb
language plpgsql security definer set search_path=''as $$begin
 if app.selected_step_player_transport_enabled_v3()is distinct from true then return null;end if;
 return app.get_selected_step_player_action_v3(tid,op);
end$$;
do $$declare signature text;begin foreach signature in array array[
 'app.selected_step_player_transport_enabled_v3()','public.get_selected_step_player_matches_v3(uuid)',
 'public.get_selected_step_player_view_provider_v3(uuid,uuid,uuid,integer,uuid)',
 'public.submit_selected_step_player_action_provider_v3(uuid,uuid,uuid,integer,jsonb)','public.get_selected_step_player_action_provider_v3(uuid,uuid)'
 ]loop execute format('alter function %s owner to postgres',signature);execute format('revoke all on function %s from public,anon,authenticated,service_role',signature);end loop;end$$;
commit;
