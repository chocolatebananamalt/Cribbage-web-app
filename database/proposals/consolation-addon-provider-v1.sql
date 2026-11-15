-- PRIVATE RELEASE CANDIDATE. Public cookie wrappers remain separately OFF.
begin;
create function app.consy_addon_provider_enabled_v1()returns boolean language sql immutable set search_path=''as $$select false$$;
revoke all on function app.consy_addon_provider_enabled_v1()from public,anon,authenticated,service_role;
create function public.get_consy_addon_payment_desk_v1(p_tournament_id uuid,p_event_id uuid)returns jsonb language plpgsql security definer set search_path=''as $$
declare m uuid;a app.tournament_setup_activations%rowtype;v app.tournament_setup_event_versions%rowtype;s app.consy_addon_payment_scopes_v1%rowtype;ready boolean;w jsonb;begin
 if app.consy_addon_provider_enabled_v1()is distinct from true or app.consy_addon_payments_enabled_v1()is distinct from true or auth.uid()is null then return null;end if;
 m:=app.lock_consy_addon_context_v1(p_tournament_id,p_event_id);
 select*into a from app.tournament_setup_activations where tournament_id=p_tournament_id and event_id=p_event_id;select*into v from app.tournament_setup_event_versions where id=a.setup_event_version_id;
 if a.id is null or v.entry_fee_cents<=0 or v.event_kind<>'consolation'or v.format_code<>'standard_singles'then return jsonb_build_object('status','blocked','code','unsupported_event');end if;
 select*into s from app.consy_addon_payment_scopes_v1 where tournament_id=p_tournament_id and event_id=p_event_id;
 ready:=not exists(select 1 from app.event_play_starts where event_id=p_event_id and tournament_id=p_tournament_id)
 and exists(select 1 from app.qualification_result_versions q where tournament_id=p_tournament_id and event_id=m and version=(select max(version)from app.qualification_result_versions where tournament_id=p_tournament_id and event_id=m)and app.qualification_resolution_snapshot_current_v1(q.id))
 and app.native_ledger_has_mixed_scope_v1(p_tournament_id)is false;
 if s.id is not null then w:=app.get_consy_addon_workspace_v1(p_tournament_id,p_event_id);end if;
 return jsonb_build_object('status','desk_available','kind','consy-addon-desk-v1','actorId',auth.uid(),'tournamentId',p_tournament_id,'eventId',p_event_id,'mainEventId',m,'activationId',a.id,'setupEventVersionId',v.id,'feeMinor',v.entry_fee_cents,'scopeId',s.id,'ready',ready,'workspace',w,'bankReceiptVerified',false,'moneyMoved',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');when raise_exception then return jsonb_build_object('status','blocked','code','event_unavailable');end$$;
create function public.get_consy_addon_payment_source_v1(p_tournament_id uuid,p_event_id uuid,p_roster_entry_id uuid)returns jsonb language sql volatile security definer set search_path=''as $$select case when app.consy_addon_provider_enabled_v1()and app.consy_addon_payments_enabled_v1()then app.get_consy_addon_receipt_source_v1(p_tournament_id,p_event_id,p_roster_entry_id)else null end$$;
create function app.consy_addon_command_reply_v1(tid uuid,eid uuid,op uuid,req jsonb,recovery boolean)returns jsonb language plpgsql security definer set search_path=''as $$
declare stored jsonb;rec app.operation_receipts%rowtype;typ text;result jsonb;state text;message text;begin
 if app.consy_addon_provider_enabled_v1()is distinct from true or auth.uid()is null or not exists(select 1 from app.tournament_roles where tournament_id=tid and profile_id=auth.uid()and role in('director','co_director'))then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return null;end if;
 if op is null or req->>'operationId'is distinct from op::text or coalesce(req->>'kind','')not in('consy-addon-scope-v1','consy-addon-receipt-v1')then return null;end if;
 if not pg_try_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||op::text,0))then state:='retry_exact';
 else
  if not recovery then
   begin
    if req->>'kind'='consy-addon-scope-v1'then result:=app.open_consy_addon_scope_v1(tid,eid,req);else result:=app.record_consy_addon_receipt_v1(tid,eid,(req->>'rosterEntryId')::uuid,req);end if;
   exception when raise_exception then
    message:=sqlerrm;
    if message not in('consy_addon_invalid_request','consy_addon_link_required','consy_addon_link_changed','consy_addon_tournament_unavailable','consy_addon_scope_exists','consy_addon_binding_changed','consy_addon_event_started','consy_addon_mixed_domain_unsupported','consy_addon_optional_domain_unsupported','consy_addon_main_qualification_required','consy_addon_invalid_received_at','consy_addon_physical_identity_conflict','payment method is not accepted for this tournament')then raise;end if;
    -- The failed private call is rolled back; retain the outer nonce lock.
    perform 1 from app.tournaments where id=tid for update nowait;
    perform 1 from app.tournament_roles where tournament_id=tid and profile_id=auth.uid()and role in('director','co_director')order by role for share nowait;if not found then return null;end if;
    typ:=case req->>'kind'when'consy-addon-scope-v1'then'consy_addon_scope_v1'else'consy_addon_receipt_v1'end;
    result:=(app.finish_consy_addon_operation_v1(tid,eid,op,typ,req,jsonb_build_object('status','rejected','code',case when message='payment method is not accepted for this tournament'then'payment_method_not_accepted'else message end)))->'result';
   end;
  end if;
  perform 1 from app.tournaments where id=tid for share nowait;
  perform 1 from app.tournament_roles where tournament_id=tid and profile_id=auth.uid()and role in('director','co_director')order by role for share nowait;if not found then return null;end if;
  typ:=case req->>'kind'when'consy-addon-scope-v1'then'consy_addon_scope_v1'else'consy_addon_receipt_v1'end;
  select*into rec from app.operation_receipts where actor_profile_id=auth.uid()and client_operation_id=op;
  if rec.id is not null and(rec.tournament_id<>tid or rec.target_id<>eid or rec.operation_type<>typ or rec.request_hash is distinct from encode(extensions.digest(convert_to(jsonb_build_array(typ,auth.uid(),tid,eid,op,req)::text,'utf8'),'sha256'),'hex')or rec.response_payload->'request'is distinct from req)then
   return jsonb_build_object('kind','consy-addon-command-reply-v1','actorId',auth.uid(),'tournamentId',tid,'eventId',eid,'operationId',op,'request',req,'status','held','outcome',null,'moneyMoved',false,'bankReceiptVerified',false);
  end if;
  stored:=app.get_consy_addon_operation_v1(tid,eid,op);
  if stored is null then state:=case when recovery then'not_found'else'retry_exact'end;
  elsif stored->'request'is distinct from req then state:='held';stored:=null;
  else state:=case when stored->>'status'='rejected'then'rejected'when stored->>'status'in('scope_opened','consolation_addon_recorded')then'accepted'else'held'end;end if;
 end if;
 return jsonb_build_object('kind','consy-addon-command-reply-v1','actorId',auth.uid(),'tournamentId',tid,'eventId',eid,'operationId',op,'request',req,'status',state,'outcome',stored,'moneyMoved',false,'bankReceiptVerified',false);
exception when lock_not_available then return jsonb_build_object('kind','consy-addon-command-reply-v1','actorId',auth.uid(),'tournamentId',tid,'eventId',eid,'operationId',op,'request',req,'status','retry_exact','outcome',null,'moneyMoved',false,'bankReceiptVerified',false);end$$;
create function public.record_consy_addon_payment_command_v1(p_tournament_id uuid,p_event_id uuid,p_operation_id uuid,p_request jsonb)returns jsonb language sql volatile security definer set search_path=''as $$select app.consy_addon_command_reply_v1(p_tournament_id,p_event_id,p_operation_id,p_request,false)$$;
create function public.get_consy_addon_payment_command_v1(p_tournament_id uuid,p_event_id uuid,p_operation_id uuid,p_request jsonb)returns jsonb language sql volatile security definer set search_path=''as $$select app.consy_addon_command_reply_v1(p_tournament_id,p_event_id,p_operation_id,p_request,true)$$;
revoke all on function app.consy_addon_command_reply_v1(uuid,uuid,uuid,jsonb,boolean)from public,anon,authenticated,service_role;
do $$declare p regprocedure;begin foreach p in array array['public.get_consy_addon_payment_desk_v1(uuid,uuid)'::regprocedure,'public.get_consy_addon_payment_source_v1(uuid,uuid,uuid)'::regprocedure,'public.record_consy_addon_payment_command_v1(uuid,uuid,uuid,jsonb)'::regprocedure,'public.get_consy_addon_payment_command_v1(uuid,uuid,uuid,jsonb)'::regprocedure]loop execute format('alter function %s owner to postgres',p);execute format('revoke all on function %s from public,anon,service_role',p);execute format('grant execute on function %s to authenticated',p);end loop;end$$;
commit;
