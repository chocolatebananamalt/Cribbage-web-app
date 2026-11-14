-- PREPARED ONLY; no DB execution in source phase. Requires an approved local DB.
-- Validator-only statements; no flags, grants or records.
do $test$declare v jsonb:=jsonb_build_object(
 'kind','native-mixed-simulation-start-v1','operationId','cd130000-0000-4000-8000-000000000004',
 'expectedContextId','cd130000-0000-4000-8000-000000000005',
 'expectedScheduleSourceDigest',repeat('a',64),'expectedAttendanceSourceDigest',repeat('b',64),
 'statement','fictional-test-only-no-ordinary-attendance-v1','reason','TEST ONLY Start request regression');
begin
 if app.native_mixed_simulation_start_request_valid_v1(v)is distinct from true then raise exception 'valid request rejected';end if;
 if app.native_mixed_simulation_start_request_valid_v1(v||'{"scoringAuthorized":true}'::jsonb)is distinct from false then raise exception 'authority field accepted';end if;
 if app.native_mixed_simulation_start_request_valid_v1(v-'statement')is distinct from false then raise exception 'missing statement accepted';end if;
 if app.native_mixed_simulation_start_request_valid_v1(v||jsonb_build_object('expectedScheduleSourceDigest',repeat('1',64)::numeric))is distinct from false then raise exception 'numeric schedule digest accepted';end if;
 if app.native_mixed_simulation_start_request_valid_v1(v||jsonb_build_object('expectedAttendanceSourceDigest',repeat('1',64)::numeric))is distinct from false then raise exception 'numeric attendance digest accepted';end if;
 if app.native_mixed_simulation_start_request_valid_v1(v||'{"reason":" "}'::jsonb)is distinct from false then raise exception 'blank reason accepted';end if;
end $test$;
