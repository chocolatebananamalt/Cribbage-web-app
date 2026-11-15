-- LOCAL, UNEXECUTED, OPT-IN PERMISSION CANDIDATE ONLY.
--
-- This separate transport is the only proposed authenticated entrypoint for a
-- Digital participant's own consent decision. It has no actor parameter,
-- derives the subject from auth.uid(), and cannot be used by service_role to
-- impersonate a player. Installing or enabling it needs separate provider and
-- hosted-change approval; the private core remains fully revoked.
begin;

create function app.native_mixed_attendance_consent_transport_enabled_v1()returns boolean
language sql immutable set search_path=''as $$select false$$;

create function public.record_native_mixed_digital_consent_v1(
 p_tournament_id uuid,p_event_id uuid,p_request jsonb
)returns jsonb
language plpgsql security definer set search_path=''as $$
declare actor uuid:=auth.uid();role_name text;begin
 if app.native_mixed_attendance_consent_transport_enabled_v1()is distinct from true
 then return jsonb_build_object('status','rejected','code','feature_unavailable');end if;
 role_name:=coalesce(nullif(current_setting('request.jwt.claim.role',true),''),
  (nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','');
 if actor is null or role_name<>'authenticated'then return null;end if;
 return app.record_native_mixed_digital_consent_v1(p_tournament_id,p_event_id,p_request);
end$$;

alter function app.native_mixed_attendance_consent_transport_enabled_v1()owner to postgres;
alter function public.record_native_mixed_digital_consent_v1(uuid,uuid,jsonb)owner to postgres;
revoke all on function app.native_mixed_attendance_consent_transport_enabled_v1()from public,anon,authenticated,service_role;
revoke all on function public.record_native_mixed_digital_consent_v1(uuid,uuid,jsonb)from public,anon,authenticated,service_role;
grant execute on function public.record_native_mixed_digital_consent_v1(uuid,uuid,jsonb)to authenticated;
commit;
