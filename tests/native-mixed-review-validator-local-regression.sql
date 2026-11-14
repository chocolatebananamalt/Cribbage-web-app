-- Prepared runtime regression only. No fixture creation or hosted execution.
-- Run after installing the corrected proposal in an explicitly approved local DB.
-- Pure validator checks: no gate enablement, role/grant or data write.
do $regression$
declare v jsonb:=jsonb_build_object(
 'kind','native-mixed-simulation-review-v1','operationId','a1111111-1111-4111-8111-111111111111',
 'drawId','b1111111-1111-4111-8111-111111111111','expectedDrawDigest',repeat('a',64),
 'expectedAttendanceSourceDigest',repeat('b',64),'decision','accepted-test-simulation-only',
 'humanPresenceNotVerified',true,'simulationLayoutReviewed',true,'fictionalPaperAcknowledged',true,
 'reason','TEST ONLY review validator regression');
begin
 if app.native_mixed_simulation_review_request_valid_v1(v)is distinct from true then raise exception 'valid review rejected';end if;
 if app.native_mixed_simulation_review_request_valid_v1(v||'{"unexpected":true}'::jsonb)is distinct from false then raise exception 'extra key accepted';end if;
 if app.native_mixed_simulation_review_request_valid_v1(v-'fictionalPaperAcknowledged')is distinct from false then raise exception 'missing acknowledgment accepted';end if;
 if app.native_mixed_simulation_review_request_valid_v1(v||'{"fictionalPaperAcknowledged":false}'::jsonb)is distinct from false then raise exception 'false acknowledgment accepted';end if;
 if app.native_mixed_simulation_review_request_valid_v1(v||'{"expectedDrawDigest":"invalid"}'::jsonb)is distinct from false then raise exception 'bad digest accepted';end if;
 if app.native_mixed_simulation_review_request_valid_v1(v||'{"decision":"approved"}'::jsonb)is distinct from false then raise exception 'wrong decision accepted';end if;
end $regression$;
