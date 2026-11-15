-- Local candidate only. No account/role/cohort enrollment or automatic grants.
-- Reuses existing immutable writers. Consent always keeps the real authenticated subject.
begin;
create function app.native_mixed_bootstrap_enabled_v1()returns boolean language sql immutable set search_path=''as $$select false$$;

create function app.native_mixed_bootstrap_service_allowed_v1(actor uuid,sid uuid,tid uuid,eid uuid,mode text,writing boolean)returns boolean
language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$begin
 if app.native_mixed_bootstrap_enabled_v1()is distinct from true or mode is null or mode not in('director','paper-review')or auth.role()is distinct from'service_role'
  or auth.jwt()->>'iss'is distinct from'https://nnhcnvksxgxnpvdqjgpg.supabase.co/auth/v1'
  or app.native_mixed_pilot_permitted_v1(actor,tid,eid,writing)is distinct from true then return false;end if;
 perform 1 from auth.sessions s join auth.users u on u.id=s.user_id where s.id=sid and s.user_id=actor and(s.not_after is null or s.not_after>clock_timestamp())and u.deleted_at is null and(u.banned_until is null or u.banned_until<=clock_timestamp())for share of s,u nowait;if not found then return false;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role=case mode when'director'then'director'else'cross_checker'end for share nowait;return found;
exception when lock_not_available then return false;end$$;

create function public.get_native_mixed_bootstrap_session_v1(p_tournament_id uuid,p_event_id uuid,p_mode text,p_writing boolean)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$
declare actor uuid;expiry timestamptz;s app.native_mixed_pilot_scopes_v1%rowtype;begin
 if app.native_mixed_bootstrap_enabled_v1()is distinct from true or auth.role()is distinct from'authenticated'or p_mode is null or p_mode not in('director','paper-review','consent')or p_writing is null then return null;end if;
 actor:=app.native_mixed_game_own_subject_v1();if actor is null or app.native_mixed_pilot_permitted_v1(actor,p_tournament_id,p_event_id,p_writing)is distinct from true then return null;end if;
 if p_mode<>'consent'then perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=actor and role=case p_mode when'director'then'director'else'cross_checker'end for share nowait;if not found then return null;end if;end if;
 select*into s from app.native_mixed_pilot_scopes_v1 where tournament_id=p_tournament_id and event_id=p_event_id order by version desc limit 1;
 expiry:=least(s.expires_at,to_timestamp((auth.jwt()->>'exp')::double precision),clock_timestamp()+interval'5 minutes');if expiry<=clock_timestamp()then return null;end if;
 return jsonb_build_object('kind','native-mixed-bootstrap-session-v1','actorId',actor,'sessionId',auth.jwt()->>'session_id','tournamentId',p_tournament_id,'eventId',p_event_id,'mode',p_mode,'writing',p_writing,'expiresAt',to_char(expiry at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
exception when lock_not_available or invalid_text_representation or numeric_value_out_of_range then return null;end$$;

create function app.native_mixed_bootstrap_template_v1(request jsonb)returns jsonb language sql immutable set search_path=''as $$select request-array['operationId','nonce','reason','simulatedReceivedAt']::text[]$$;
create function app.native_mixed_bootstrap_digest_v1(actor uuid,tid uuid,eid uuid,mode text,action text,template jsonb)returns text language sql immutable set search_path=''as $$select encode(extensions.digest(convert_to(jsonb_build_array('native-mixed-bootstrap-offer-v1',actor,tid,eid,mode,action,template)::text,'utf8'),'sha256'),'hex')$$;

create function app.native_mixed_bootstrap_request_valid_v1(mode text,action text,request jsonb)returns boolean
language sql immutable set search_path=''as $$select coalesce(case
 when mode='director'and action='intent'then app.native_mixed_admission_intent_request_valid_v1(request)
 when mode='director'and action='fund-scope'then app.native_mixed_funding_scope_request_valid_v1(request)
 when mode='director'and action='fund-entry'then app.native_mixed_funding_entry_request_valid_v1(request)
 when mode='director'and action='attendance-scope'then app.native_mixed_attendance_scope_request_valid_v1(request)
 when mode='director'and action='paper-declaration'then app.native_mixed_attendance_declaration_request_valid_v1(request)
 when mode='director'and action='attendance-seal'then app.native_mixed_attendance_seal_request_valid_v1(request)
 when mode='paper-review'and action='paper-review'then app.native_mixed_attendance_review_request_valid_v1(request)
 when mode='consent'and action in('consent-grant','consent-revoke')then app.native_mixed_attendance_consent_request_valid_v1(request)and request->>'decision'=case action when'consent-grant'then'granted'else'revoked'end
 else false end,false)$$;

-- A historical success is proved from request hash, outcome AND immutable child.
-- It is never current readiness. No Director fallback is used for player/reviewer reads.
create function app.native_mixed_bootstrap_proof_v1(actor uuid,tid uuid,eid uuid,mode text,action text,request jsonb)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $$
declare op uuid;j jsonb;r jsonb;family text;v_phase text;bound boolean:=false;h text;begin
 if app.native_mixed_bootstrap_request_valid_v1(mode,action,request)is distinct from true then return null;end if;op:=(request->>'operationId')::uuid;
 if action='intent'then family:='admission';v_phase:='intent';select to_jsonb(o)into j from app.native_mixed_admission_operations_v1 o where actor_id=actor and operation_id=op and tournament_id=tid and event_id=eid and o.phase=v_phase;select result into r from app.native_mixed_admission_outcomes_v1 where actor_id=actor and operation_id=op and tournament_id=tid and event_id=eid;
 elsif action in('fund-scope','fund-entry')then family:='funding';v_phase:=case action when'fund-scope'then'scope'else'entry'end;select to_jsonb(o)into j from app.native_mixed_funding_operations_v1 o where actor_id=actor and operation_id=op and tournament_id=tid and event_id=eid and o.action=v_phase;select result into r from app.native_mixed_funding_outcomes_v1 where actor_id=actor and operation_id=op and tournament_id=tid and event_id=eid;
 else family:='attendance';v_phase:=case action when'attendance-scope'then'scope'when'paper-declaration'then'paper_declaration'when'paper-review'then'paper_review'when'attendance-seal'then'seal'else'consent'end;select to_jsonb(o)into j from app.native_mixed_attendance_operations_v1 o where actor_id=actor and operation_id=op and tournament_id=tid and event_id=eid and o.action=v_phase;select result into r from app.native_mixed_attendance_outcomes_v1 where actor_id=actor and operation_id=op and tournament_id=tid and event_id=eid;end if;
 if j is null or r is null or j->'request_payload'is distinct from request or r->'request'is distinct from request
  or r->>(case when family='admission'then'phase'else'action'end)is distinct from v_phase or r->>'kind'is distinct from'native-mixed-'||family||'-receipt-v1'or r->>'status'is distinct from'accepted'
  or r->>'actorId'is distinct from actor::text or r->>'tournamentId'is distinct from tid::text or r->>'eventId'is distinct from eid::text or r->>'operationId'is distinct from op::text
  or coalesce(r->>'sourceDigest','')!~'^[a-f0-9]{64}$'then return null;end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('native-mixed-'||family||'-v1',v_phase,actor,op,tid,eid,request)::text,'utf8'),'sha256'),'hex');if j->>'request_hash'is distinct from h then return null;end if;
 if exists(select 1 from jsonb_each(r)x where x.key=any(array['normalDrawAuthorized','normalStartAuthorized','ordinaryAttendanceUsed','humanPresenceVerified','actualMoneyReceived','bankReceiptVerified','moneyMoved','refundAuthorized','payoutAuthorized','finalizationAuthorized'])and x.value<>'false'::jsonb)then return null;end if;
 case action
 when'intent'then select exists(select 1 from app.native_mixed_admission_intents_v1 i where i.id=(r->>'intentId')::uuid and i.actor_id=actor and i.operation_id=op and i.tournament_id=tid and i.event_id=eid and i.source_digest=r->>'sourceDigest'and i.nonce=(request->>'nonce')::uuid and i.operational_binding_id=(request->>'expectedOperationalBindingId')::uuid and i.scope_capture=request->'scope'and i.version=(r->>'version')::integer and r->'priorIntentId'=coalesce(to_jsonb(i.prior_intent_id),'null')and r->>'nonce'=i.nonce::text and i.version=(request->>'expectedVersion')::integer+1 and coalesce(to_jsonb(i.prior_intent_id),'null')=request->'expectedPriorIntentId'and i.source_digest=encode(extensions.digest(convert_to(jsonb_build_array('native-mixed-admission-intent-source-v1',tid,eid,i.operational_binding_id,i.base_source_capture,i.scope_capture)::text,'utf8'),'sha256'),'hex'))into bound;
 when'fund-scope'then select exists(select 1 from app.native_mixed_funding_scopes_v1 s where s.id=(r->>'scopeId')::uuid and s.actor_id=actor and s.operation_id=op and s.tournament_id=tid and s.event_id=eid and app.native_mixed_funding_scope_bound_v1(s.id))into bound;
 when'fund-entry'then select exists(select 1 from app.native_mixed_funding_obligations_v1 o where o.id=(r->>'obligationId')::uuid and o.actor_id=actor and o.operation_id=op and o.tournament_id=tid and o.event_id=eid and app.native_mixed_funding_entry_bound_v1(o.id))into bound;
 when'attendance-scope'then select exists(select 1 from app.native_mixed_attendance_scopes_v1 s where s.id=(r->>'scopeId')::uuid and s.actor_id=actor and s.operation_id=op and s.tournament_id=tid and s.event_id=eid and s.nonce=(request->>'nonce')::uuid and s.operational_binding_id=(request->>'expectedOperationalBindingId')::uuid and s.admission_intent_id=(request->>'expectedAdmissionIntentId')::uuid and s.admission_source_digest=request->>'expectedAdmissionSourceDigest'and s.funding_scope_id=(request->>'expectedFundingScopeId')::uuid and s.funding_source_digest=request->>'expectedFundingSourceDigest'and app.native_mixed_attendance_scope_bound_v1(s.id))into bound;
 when'paper-declaration'then select exists(select 1 from app.native_mixed_paper_declarations_v1 d where d.id=(r->>'declarationId')::uuid and d.preparer_id=actor and d.operation_id=op and d.tournament_id=tid and d.event_id=eid and d.scope_id=(request->>'expectedScopeId')::uuid and d.nonce=(request->>'nonce')::uuid and exists(select 1 from app.native_mixed_attendance_scopes_v1 sc where sc.id=d.scope_id and sc.source_digest=request->>'expectedScopeDigest')and (select jsonb_agg(v order by v)from jsonb_array_elements(request->'expectedPaperRosterEntryIds')v)=(select jsonb_agg(x->>'rosterEntryId'order by x->>'rosterEntryId')from jsonb_array_elements(d.entries_capture)x)and app.native_mixed_attendance_declaration_bound_v1(d.id))into bound;
 when'paper-review'then select exists(select 1 from app.native_mixed_paper_reviews_v1 v where v.id=(r->>'reviewId')::uuid and v.reviewer_id=actor and v.operation_id=op and v.tournament_id=tid and v.event_id=eid and v.scope_id=(request->>'expectedScopeId')::uuid and v.declaration_id=(request->>'expectedDeclarationId')::uuid and v.decision=request->>'decision'and exists(select 1 from app.native_mixed_attendance_scopes_v1 sc where sc.id=v.scope_id and sc.source_digest=request->>'expectedScopeDigest')and exists(select 1 from app.native_mixed_paper_declarations_v1 dd where dd.id=v.declaration_id and dd.source_digest=request->>'expectedDeclarationDigest')and app.native_mixed_attendance_review_bound_v1(v.id))into bound;
 when'attendance-seal'then select exists(select 1 from app.native_mixed_attendance_seals_v1 s where s.id=(r->>'sealId')::uuid and s.actor_id=actor and s.operation_id=op and s.tournament_id=tid and s.event_id=eid and s.scope_id=(request->>'expectedScopeId')::uuid and s.declaration_id=(request->>'expectedDeclarationId')::uuid and s.review_id=(request->>'expectedReviewId')::uuid and s.source_digest=r->>'sourceDigest'and s.source_capture#>>'{scope,scopeId}'=s.scope_id::text and s.source_capture#>>'{scope,sourceDigest}'=request->>'expectedScopeDigest'and s.source_capture->>'sourceDigest'=s.source_digest and app.native_mixed_attendance_operation_bound_v1(actor,op,'seal')and s.source_digest=encode(extensions.digest(convert_to(jsonb_build_array('native-mixed-attendance-source-v1',tid,eid,s.source_capture->'scope',s.source_capture->'digitalConsents',s.source_capture->'paperDeclaration',s.source_capture->'paperReview')::text,'utf8'),'sha256'),'hex'))into bound;
 else select exists(select 1 from app.native_mixed_digital_consent_decisions_v1 c where c.id=(r->>'consentId')::uuid and c.actor_id=actor and c.operation_id=op and c.tournament_id=tid and c.event_id=eid and c.profile_id=actor and c.scope_id=(request->>'expectedScopeId')::uuid and c.roster_entry_id=(request->>'rosterEntryId')::uuid and c.version=(request->>'expectedVersion')::integer+1 and coalesce(to_jsonb(c.prior_consent_id),'null')=request->'expectedPriorConsentId'and c.decision=request->>'decision'and c.statement=request->>'statement'and exists(select 1 from app.native_mixed_attendance_scopes_v1 sc where sc.id=c.scope_id and sc.source_digest=request->>'expectedScopeDigest')and app.native_mixed_attendance_consent_bound_v1(c.id))into bound;
 end case;
 if bound is distinct from true then return null;end if;
 return jsonb_build_object('kind','native-mixed-bootstrap-result-v1','actorId',actor,'tournamentId',tid,'eventId',eid,'mode',mode,'action',action,'operationId',op,'request',request,'offerDigest',app.native_mixed_bootstrap_digest_v1(actor,tid,eid,mode,action,app.native_mixed_bootstrap_template_v1(request)),
 'status','accepted','code','step_recorded','receiptDigest',encode(extensions.digest(convert_to(r::text,'utf8'),'sha256'),'hex'),'historicalReceipt',true,'currentSourceVerified',false,'ordinaryAttendanceUsed',false,'humanPresenceVerified',false,'actualMoneyReceived',false,'moneyMoved',false,'payoutAuthorized',false);
exception when invalid_text_representation or numeric_value_out_of_range then return null;end$$;

create function app.native_mixed_bootstrap_offer_v1(actor uuid,tid uuid,eid uuid,mode text)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$
declare b jsonb;f jsonb;p jsonb;entry jsonb;i app.native_mixed_admission_intents_v1%rowtype;fs app.native_mixed_funding_scopes_v1%rowtype;s app.native_mixed_attendance_scopes_v1%rowtype;d app.native_mixed_paper_declarations_v1%rowtype;rv app.native_mixed_paper_reviews_v1%rowtype;c app.native_mixed_digital_consent_decisions_v1%rowtype;sealed app.native_mixed_attendance_seals_v1%rowtype;
 action text;template jsonb;state text:='waiting';message text:='Preparation needs another participant or official.';people jsonb:='[]';amount bigint;completed integer:=0;begin
 if app.native_mixed_bootstrap_enabled_v1()is distinct from true or mode is null or mode not in('director','paper-review','consent')then return null;end if;
 if app.native_mixed_admission_enabled_v1()is distinct from true or app.native_mixed_funding_enabled_v1()is distinct from true or app.native_mixed_attendance_enabled_v1()is distinct from true then return null;end if;
 perform app.lock_native_mixed_attendance_sources_v1();perform app.lock_native_mixed_funding_sources_v1();
 select*into s from app.native_mixed_attendance_scopes_v1 where tournament_id=tid and event_id=eid;
 if mode='consent'then
  if app.native_mixed_attendance_consent_transport_enabled_v1()is distinct from true then return null;end if;
  if s.id is null then message:='The Director has not prepared test participation yet.';
  else
   select value into entry from jsonb_array_elements(s.roster_capture)where value->>'mode'='digital'and value->>'profileId'=actor::text;
   if entry is null then return null;end if;
   select*into c from app.native_mixed_digital_consent_decisions_v1 where scope_id=s.id and roster_entry_id=(entry->>'rosterEntryId')::uuid order by version desc limit 1;
   if c.id is not null and not app.native_mixed_attendance_consent_bound_v1(c.id)then return null;end if;
   if c.decision='granted'then action:='consent-revoke';message:='Your test consent is saved. You may withdraw it.';
   elsif app.native_mixed_attendance_scope_current_v1(s.id)and app.native_mixed_attendance_preactivity_v1(tid,eid)and not exists(select 1 from app.native_mixed_attendance_seals_v1 where scope_id=s.id)then action:='consent-grant';message:='Review and choose whether to join this test.';
   else message:='A new rehearsal is needed before consent can be granted again.';end if;
   if action is not null then template:=jsonb_build_object('kind','native-mixed-digital-consent-v1','expectedScopeId',s.id,'expectedScopeDigest',s.source_digest,'expectedPriorConsentId',c.id,'expectedVersion',coalesce(c.version,0),'rosterEntryId',entry->>'rosterEntryId','decision',case action when'consent-grant'then'granted'else'revoked'end,'statement','test-only-simulation-participation-v1');people:=jsonb_build_array(jsonb_build_object('rosterEntryId',entry->>'rosterEntryId','displayName',(select claimed_display_name from app.tournament_roster_entries where id=(entry->>'rosterEntryId')::uuid)));end if;
  end if;
 else
  if not exists(select 1 from app.tournaments where id=tid and name like'TEST ONLY%')then return null;end if;
  b:=app.native_mixed_admission_base_source_v1(tid,eid);if b->>'status'is distinct from'source_available'then return null;end if;
  select*into i from app.native_mixed_admission_intents_v1 where tournament_id=tid and event_id=eid order by version desc limit 1;
  select*into fs from app.native_mixed_funding_scopes_v1 where tournament_id=tid and event_id=eid;
  select*into d from app.native_mixed_paper_declarations_v1 where scope_id=s.id;
  select*into rv from app.native_mixed_paper_reviews_v1 where scope_id=s.id;
  if mode='paper-review'then
   if d.id is not null and d.preparer_id=actor then message:='A different authorized cross-checker must review this declaration.';
   elsif rv.id is not null then if not app.native_mixed_attendance_review_bound_v1(rv.id)then return null;end if;state:='complete';message:='The fictional paper roster review is recorded.';
   elsif d.id is not null and app.native_mixed_attendance_declaration_bound_v1(d.id)and app.native_mixed_attendance_scope_current_v1(s.id)and app.native_mixed_attendance_preactivity_v1(tid,eid)then action:='paper-review';template:=jsonb_build_object('kind','native-mixed-paper-review-v1','expectedScopeId',s.id,'expectedScopeDigest',s.source_digest,'expectedDeclarationId',d.id,'expectedDeclarationDigest',d.source_digest,'decision','accepted-synthetic-only');message:='Independently review these fictional paper entries.';
   end if;
  elsif i.id is null then action:='intent';template:=jsonb_build_object('kind','native-mixed-admission-intent-v1','expectedOperationalBindingId',b#>>'{binding,id}','expectedPriorIntentId',null,'expectedVersion',0,'scope',jsonb_build_object('environment','test-only-local-candidate','protocol','native-mixed-6d12p-v1','participantCount',18,'digitalCount',6,'paperCount',12,'roundCount',12,'matchCount',108,'scoringEvidence','not-yet-recorded-synthetic-scope','financialEvidence','not-yet-recorded-no-authority'));message:='Confirm the fixed test-only rehearsal setup.';
  elsif i.base_source_capture is distinct from b or app.native_mixed_bootstrap_proof_v1(i.actor_id,tid,eid,'director','intent',(select request_payload from app.native_mixed_admission_operations_v1 where actor_id=i.actor_id and operation_id=i.operation_id))is null then return null;
  elsif fs.id is null then action:='fund-scope';template:=jsonb_build_object('kind','native-mixed-funding-scope-v1','expectedOperationalBindingId',i.operational_binding_id,'expectedAdmissionIntentId',i.id,'expectedAdmissionIntentVersion',i.version,'expectedAdmissionSourceDigest',i.source_digest);message:='Prepare simulated entry tracking. No actual money is received.';
  elsif not app.native_mixed_funding_scope_bound_v1(fs.id)then return null;
  else
   if exists(select 1 from app.native_mixed_funding_obligations_v1 o where o.scope_id=fs.id and not app.native_mixed_funding_entry_bound_v1(o.id))then return null;end if;
   select count(*)into completed from app.native_mixed_funding_obligations_v1 where scope_id=fs.id;
   select value into entry from jsonb_array_elements(b->'roster')x where not exists(select 1 from app.native_mixed_funding_obligations_v1 o where o.scope_id=fs.id and o.roster_entry_id=(x.value->>'rosterEntryId')::uuid)order by value->>'rosterEntryId'limit 1;
   if entry is not null then action:='fund-entry';template:=jsonb_build_object('kind','native-mixed-funding-entry-v1','expectedScopeId',fs.id,'expectedScopeDigest',fs.source_digest,'expectedVersion',0,'rosterEntryId',entry->>'rosterEntryId');amount:=fs.entry_fee_minor;people:=jsonb_build_array(jsonb_build_object('rosterEntryId',entry->>'rosterEntryId','displayName',(select claimed_display_name from app.tournament_roster_entries where id=(entry->>'rosterEntryId')::uuid)));message:='Record one simulated entry. This is not a cash receipt.';
   elsif s.id is null then f:=app.native_mixed_funding_seal_source_v1(tid,eid);if f->>'status'is distinct from'source_available'then return null;end if;action:='attendance-scope';template:=jsonb_build_object('kind','native-mixed-attendance-scope-v1','expectedOperationalBindingId',i.operational_binding_id,'expectedAdmissionIntentId',i.id,'expectedAdmissionSourceDigest',i.source_digest,'expectedFundingScopeId',fs.id,'expectedFundingSourceDigest',f->>'sourceDigest');message:='Prepare test participation; this is not check-in.';
   elsif not app.native_mixed_attendance_scope_bound_v1(s.id)or not app.native_mixed_attendance_scope_current_v1(s.id)then return null;
   elsif d.id is null then action:='paper-declaration';template:=jsonb_build_object('kind','native-mixed-paper-declaration-v1','expectedScopeId',s.id,'expectedScopeDigest',s.source_digest,'expectedPaperRosterEntryIds',(select jsonb_agg(value->>'rosterEntryId'order by value->>'rosterEntryId')from jsonb_array_elements(s.roster_capture)where value->>'mode'='paper'));message:='Declare these twelve paper entries fictional.';
   elsif not app.native_mixed_attendance_declaration_bound_v1(d.id)then return null;
   elsif exists(select 1 from app.native_mixed_attendance_seals_v1 where scope_id=s.id)then
    select*into sealed from app.native_mixed_attendance_seals_v1 where scope_id=s.id;
    if app.native_mixed_bootstrap_proof_v1(sealed.actor_id,tid,eid,'director','attendance-seal',(select request_payload from app.native_mixed_attendance_operations_v1 where actor_id=sealed.actor_id and operation_id=sealed.operation_id))is null then return null;end if;
    p:=app.native_mixed_attendance_source_v1(actor,tid,eid);if p->>'status'='source_available'then state:='complete';message:='Test readiness is currently verified. Registration must close before seating; this screen does not close it.';else message:='The saved readiness seal is no longer current. Do not proceed to seating or Start.';end if;
   elsif rv.id is not null then p:=app.native_mixed_attendance_projection_v1(tid,eid);if p->>'status'='source_available'then action:='attendance-seal';template:=jsonb_build_object('kind','native-mixed-attendance-seal-v1','expectedScopeId',s.id,'expectedScopeDigest',s.source_digest,'expectedDeclarationId',d.id,'expectedReviewId',rv.id);message:='Seal current test readiness. No real attendance is claimed.';else message:='Waiting for all six players to grant their own test consent.';end if;
   else message:='Waiting for player consent and a different cross-checker to review the paper entries.';end if;
  end if;
  if action in('paper-declaration','paper-review')then select jsonb_agg(jsonb_build_object('rosterEntryId',r.id,'displayName',r.claimed_display_name)order by r.id)into people from app.tournament_roster_entries r where r.tournament_id=tid and r.id in(select(value->>'rosterEntryId')::uuid from jsonb_array_elements(s.roster_capture)where value->>'mode'='paper');end if;
 end if;
 if action is not null then state:='offered';end if;
 return jsonb_build_object('kind','native-mixed-bootstrap-offer-v1','actorId',actor,'tournamentId',tid,'eventId',eid,'mode',mode,'tournamentName',(select name from app.tournaments where id=tid),'eventName',(select name from app.events where id=eid and tournament_id=tid),'observedAt',to_char(clock_timestamp()at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'state',state,'message',message,'action',action,'template',template,'offerDigest',case when action is not null then app.native_mixed_bootstrap_digest_v1(actor,tid,eid,mode,action,template)else null end,'people',people,'simulatedAmountMinor',amount,'completedEntries',completed,'writesAvailable',app.native_mixed_pilot_permitted_v1(actor,tid,eid,true),'writeAuthorized',false,'ordinaryAttendanceUsed',false,'humanPresenceVerified',false,'actualMoneyReceived',false,'moneyMoved',false,'payoutAuthorized',false);
exception when lock_not_available then return null;end$$;

create function public.get_native_mixed_bootstrap_offer_v1(p_actor_id uuid,p_session_id uuid,p_tournament_id uuid,p_event_id uuid,p_mode text)returns jsonb language plpgsql security definer set search_path=''as $$begin
 if not app.native_mixed_bootstrap_service_allowed_v1(p_actor_id,p_session_id,p_tournament_id,p_event_id,p_mode,false)then return null;end if;return app.native_mixed_bootstrap_offer_v1(p_actor_id,p_tournament_id,p_event_id,p_mode);end$$;

create function public.execute_native_mixed_bootstrap_v1(p_actor_id uuid,p_session_id uuid,p_tournament_id uuid,p_event_id uuid,p_mode text,p_wire jsonb,p_read_only boolean)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$
declare action text;request jsonb;proof jsonb;offer jsonb;r jsonb;begin
 if p_read_only is null or not app.native_mixed_bootstrap_service_allowed_v1(p_actor_id,p_session_id,p_tournament_id,p_event_id,p_mode,not p_read_only)then return null;end if;
 if jsonb_typeof(p_wire)is distinct from'object'or(select array_agg(k order by k)from jsonb_object_keys(p_wire)k)is distinct from array['action','mode','offerDigest','operationId','request']or p_wire->>'mode'is distinct from p_mode or p_wire->>'operationId'is distinct from p_wire#>>'{request,operationId}'then return null;end if;
 action:=p_wire->>'action';request:=p_wire->'request';if not app.native_mixed_bootstrap_request_valid_v1(p_mode,action,request)then return null;end if;
 if p_wire->>'offerDigest'is distinct from app.native_mixed_bootstrap_digest_v1(p_actor_id,p_tournament_id,p_event_id,p_mode,action,app.native_mixed_bootstrap_template_v1(request))then return null;end if;
 proof:=app.native_mixed_bootstrap_proof_v1(p_actor_id,p_tournament_id,p_event_id,p_mode,action,request);if proof is not null or p_read_only then return proof;end if;
 offer:=app.native_mixed_bootstrap_offer_v1(p_actor_id,p_tournament_id,p_event_id,p_mode);if offer->>'action'is distinct from action or offer->>'offerDigest'is distinct from p_wire->>'offerDigest'or offer->'template'is distinct from app.native_mixed_bootstrap_template_v1(request)then r:=jsonb_build_object('status','rejected');
 else case action
 when'intent'then r:=app.save_native_mixed_admission_intent_v1(p_actor_id,p_tournament_id,p_event_id,request);
 when'fund-scope'then r:=app.save_native_mixed_funding_scope_v1(p_actor_id,p_tournament_id,p_event_id,request);
 when'fund-entry'then r:=app.record_native_mixed_funding_entry_v1(p_actor_id,p_tournament_id,p_event_id,request);
 when'attendance-scope'then r:=app.save_native_mixed_attendance_scope_v1(p_actor_id,p_tournament_id,p_event_id,request);
 when'paper-declaration'then r:=app.record_native_mixed_paper_declaration_v1(p_actor_id,p_tournament_id,p_event_id,request);
 when'paper-review'then r:=app.review_native_mixed_paper_declaration_v1(p_actor_id,p_tournament_id,p_event_id,request);
 when'attendance-seal'then r:=app.seal_native_mixed_attendance_v1(p_actor_id,p_tournament_id,p_event_id,request);end case;end if;
 proof:=app.native_mixed_bootstrap_proof_v1(p_actor_id,p_tournament_id,p_event_id,p_mode,action,request);if proof is not null then return proof;end if;
 return jsonb_build_object('kind','native-mixed-bootstrap-result-v1','actorId',p_actor_id,'tournamentId',p_tournament_id,'eventId',p_event_id,'mode',p_mode,'action',action,'operationId',request->>'operationId','request',request,'offerDigest',p_wire->>'offerDigest','status',case when r->>'status'='retry_exact'and r->>'code'='source_busy'then'retry_exact'else'blocked'end,'code',case when r->>'status'='retry_exact'and r->>'code'='source_busy'then'source_busy'else'step_not_accepted'end,'receiptDigest',null,'historicalReceipt',false,'currentSourceVerified',false,'ordinaryAttendanceUsed',false,'humanPresenceVerified',false,'actualMoneyReceived',false,'moneyMoved',false,'payoutAuthorized',false);
end$$;

create function public.get_native_mixed_own_consent_offer_v1(p_tournament_id uuid,p_event_id uuid)returns jsonb language plpgsql security definer set search_path=''as $$declare actor uuid;begin
 if app.native_mixed_bootstrap_enabled_v1()is distinct from true or auth.role()is distinct from'authenticated'then return null;end if;actor:=app.native_mixed_game_own_subject_v1();if actor is null or not app.native_mixed_pilot_permitted_v1(actor,p_tournament_id,p_event_id,false)then return null;end if;return app.native_mixed_bootstrap_offer_v1(actor,p_tournament_id,p_event_id,'consent');end$$;

create function public.execute_native_mixed_own_consent_v1(p_tournament_id uuid,p_event_id uuid,p_wire jsonb,p_read_only boolean)returns jsonb
language plpgsql security definer set search_path=''as $$declare actor uuid;request jsonb;action text;offer jsonb;proof jsonb;r jsonb;begin
 if app.native_mixed_bootstrap_enabled_v1()is distinct from true or auth.role()is distinct from'authenticated'or p_read_only is null then return null;end if;actor:=app.native_mixed_game_own_subject_v1();if actor is null or not app.native_mixed_pilot_permitted_v1(actor,p_tournament_id,p_event_id,not p_read_only)then return null;end if;
 if jsonb_typeof(p_wire)is distinct from'object'or(select array_agg(k order by k)from jsonb_object_keys(p_wire)k)is distinct from array['action','mode','offerDigest','operationId','request']or p_wire->>'mode'is distinct from'consent'or p_wire->>'operationId'is distinct from p_wire#>>'{request,operationId}'then return null;end if;
 action:=p_wire->>'action';request:=p_wire->'request';if not app.native_mixed_bootstrap_request_valid_v1('consent',action,request)then return null;end if;
 if p_wire->>'offerDigest'is distinct from app.native_mixed_bootstrap_digest_v1(actor,p_tournament_id,p_event_id,'consent',action,app.native_mixed_bootstrap_template_v1(request))then return null;end if;
 proof:=app.native_mixed_bootstrap_proof_v1(actor,p_tournament_id,p_event_id,'consent',action,request);if proof is not null or p_read_only then return proof;end if;
 offer:=app.native_mixed_bootstrap_offer_v1(actor,p_tournament_id,p_event_id,'consent');if offer->>'action'is distinct from action or offer->>'offerDigest'is distinct from p_wire->>'offerDigest'then r:=jsonb_build_object('status','rejected');else r:=public.record_native_mixed_digital_consent_v1(p_tournament_id,p_event_id,request);end if;
 proof:=app.native_mixed_bootstrap_proof_v1(actor,p_tournament_id,p_event_id,'consent',action,request);if proof is not null then return proof;end if;
 return jsonb_build_object('kind','native-mixed-bootstrap-result-v1','actorId',actor,'tournamentId',p_tournament_id,'eventId',p_event_id,'mode','consent','action',action,'operationId',request->>'operationId','request',request,'offerDigest',p_wire->>'offerDigest','status',case when r->>'status'='retry_exact'and r->>'code'='source_busy'then'retry_exact'else'blocked'end,'code',case when r->>'status'='retry_exact'and r->>'code'='source_busy'then'source_busy'else'step_not_accepted'end,'receiptDigest',null,'historicalReceipt',false,'currentSourceVerified',false,'ordinaryAttendanceUsed',false,'humanPresenceVerified',false,'actualMoneyReceived',false,'moneyMoved',false,'payoutAuthorized',false);
end$$;

do $$declare p regprocedure;begin foreach p in array array[
 'app.native_mixed_bootstrap_enabled_v1()'::regprocedure,'app.native_mixed_bootstrap_service_allowed_v1(uuid,uuid,uuid,uuid,text,boolean)'::regprocedure,
 'app.native_mixed_bootstrap_template_v1(jsonb)'::regprocedure,'app.native_mixed_bootstrap_digest_v1(uuid,uuid,uuid,text,text,jsonb)'::regprocedure,
 'app.native_mixed_bootstrap_request_valid_v1(text,text,jsonb)'::regprocedure,'app.native_mixed_bootstrap_proof_v1(uuid,uuid,uuid,text,text,jsonb)'::regprocedure,'app.native_mixed_bootstrap_offer_v1(uuid,uuid,uuid,text)'::regprocedure,
 'public.get_native_mixed_bootstrap_session_v1(uuid,uuid,text,boolean)'::regprocedure,'public.get_native_mixed_bootstrap_offer_v1(uuid,uuid,uuid,uuid,text)'::regprocedure,
 'public.execute_native_mixed_bootstrap_v1(uuid,uuid,uuid,uuid,text,jsonb,boolean)'::regprocedure,'public.get_native_mixed_own_consent_offer_v1(uuid,uuid)'::regprocedure,'public.execute_native_mixed_own_consent_v1(uuid,uuid,jsonb,boolean)'::regprocedure
 ]loop execute format('alter function %s owner to postgres',p);execute format('revoke all on function %s from public,anon,authenticated,service_role',p);end loop;end$$;
commit;
