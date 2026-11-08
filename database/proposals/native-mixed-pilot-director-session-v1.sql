-- Local pilot Director lease. No grants or owner scope authorization.
begin;
create function public.get_native_mixed_pilot_director_session_v1(p_tournament_id uuid,p_event_id uuid,p_action text)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$
declare actor uuid;scope app.native_mixed_pilot_scopes_v1%rowtype;expiry timestamptz;token_exp numeric;writing boolean;
begin
 if auth.role()is distinct from'authenticated'or p_action is null or p_action<>all(array['plan','draw','review','publish','source','operation','cancel','cancellation','transition','simulation-start','simulation-start-operation','simulation-start-source'])then return null;end if;
 actor:=app.native_mixed_game_own_subject_v1();writing:=p_action=any(array['plan','draw','review','publish','cancel','simulation-start']);
 if app.native_mixed_pilot_permitted_v1(actor,p_tournament_id,p_event_id,writing)is distinct from true then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=actor and role='director'for share nowait;if not found then return null;end if;
 select * into scope from app.native_mixed_pilot_scopes_v1 where tournament_id=p_tournament_id and event_id=p_event_id order by version desc limit 1;
 if jsonb_typeof(auth.jwt()->'exp')is distinct from'number'then return null;end if;token_exp:=(auth.jwt()->>'exp')::numeric;
 expiry:=least(scope.expires_at,to_timestamp(token_exp::double precision),clock_timestamp()+interval'5 minutes');if expiry<=clock_timestamp()then return null;end if;
 return jsonb_build_object('kind','native-mixed-director-session-v1','subjectId',actor,'sessionId',auth.jwt()->>'session_id','actorId',actor,
  'tournamentId',p_tournament_id,'eventId',p_event_id,'projectUrl','https://nnhcnvksxgxnpvdqjgpg.supabase.co','projectRef','nnhcnvksxgxnpvdqjgpg','allowedActions',jsonb_build_array(p_action),
  'expiresAt',to_char(expiry at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
exception when lock_not_available or numeric_value_out_of_range then return null;end$$;
alter function public.get_native_mixed_pilot_director_session_v1(uuid,uuid,text)owner to postgres;
revoke all on function public.get_native_mixed_pilot_director_session_v1(uuid,uuid,text)from public,anon,authenticated,service_role;
commit;
