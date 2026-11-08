-- LOCAL / UNEXECUTED / REVOKED. Read-only normal own-session transport.
-- Install AFTER the closed preparation51 package and unchanged
-- native-mixed-qualification-review-v1.sql. No new flag, cohort or grant.
-- Exact available envelope: {kind:'native-mixed-review-provider-v1',actorId,
-- sessionId,tournamentId,eventId,review:<native-mixed-qualification-finance-review-v1>}.
-- Every unavailable/blocked/denied result is SQL NULL, never an empty review.
begin;
create function public.get_native_mixed_qualification_review_provider_v1(p_tournament_id uuid,p_event_id uuid)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$
declare actor uuid;session_value uuid;st app.native_mixed_simulation_starts_v1%rowtype;review_value jsonb;
begin
 if p_tournament_id is null or p_event_id is null or auth.role()is distinct from'authenticated'then return null;end if;
 actor:=app.native_mixed_game_own_subject_v1();
 if actor is null then return null;end if;
 -- own_subject validates the signed session claim and locks its live user/session.
 session_value:=(auth.jwt()->>'session_id')::uuid;
 perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=actor
  and role in('director','co_director')for share nowait;
 if not found then return null;end if;
 if app.native_mixed_pilot_permitted_v1(actor,p_tournament_id,p_event_id,false)is distinct from true then return null;end if;
 -- UNIQUE(tournament_id,event_id) resolves the authoritative immutable Start.
 -- The caller supplies neither a Start ID nor a privileged actor/session claim.
 select * into st from app.native_mixed_simulation_starts_v1
  where tournament_id=p_tournament_id and event_id=p_event_id for share nowait;
 if not found then return null;end if;
 review_value:=app.native_mixed_qualification_review_v1(p_tournament_id,p_event_id,st.id);
 if review_value->>'kind'is distinct from'native-mixed-qualification-finance-review-v1'
  or review_value->>'status'is distinct from'review_available'
  or review_value->>'tournamentId'is distinct from p_tournament_id::text
  or review_value->>'eventId'is distinct from p_event_id::text
  or review_value->>'startId'is distinct from st.id::text
  or review_value->>'startSourceDigest'is distinct from st.source_digest
 then return null;end if;
 -- Expiry and own-session/cohort authorization are checked again after the full
 -- raw-evidence/funding proof. The API also recaptures before releasing a reply.
 if app.native_mixed_game_own_subject_v1()is distinct from actor
  or(auth.jwt()->>'session_id')is distinct from session_value::text
  or app.native_mixed_pilot_permitted_v1(actor,p_tournament_id,p_event_id,false)is distinct from true
 then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=actor
  and role in('director','co_director')for share nowait;
 if not found then return null;end if;
 return jsonb_build_object('kind','native-mixed-review-provider-v1','actorId',actor,'sessionId',session_value,
  'tournamentId',p_tournament_id,'eventId',p_event_id,'review',review_value);
exception when invalid_text_representation or lock_not_available then return null;end$$;
alter function public.get_native_mixed_qualification_review_provider_v1(uuid,uuid)owner to postgres;
revoke all on function public.get_native_mixed_qualification_review_provider_v1(uuid,uuid)
 from public,anon,authenticated,service_role;
commit;
