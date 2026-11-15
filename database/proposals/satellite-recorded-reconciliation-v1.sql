-- Private read-only candidate. No grant, fund approval, payout or formula policy.
begin;
create function app.satellite_recorded_reconciliation_enabled_v1()returns boolean language sql immutable set search_path=''as $$select false$$;
create function app.get_satellite_recorded_reconciliation_v1(tid uuid,eid uuid)returns jsonb language plpgsql security definer set search_path=''as $$
declare actor uuid:=auth.uid();ledger jsonb;v app.satellite_result_versions%rowtype;participants jsonb;capture jsonb;h text;
begin
 if actor is null or tid is null or eid is null then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=tid for share nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in('director','co_director')order by role for share nowait;if not found then return null;end if;
 if app.satellite_recorded_reconciliation_enabled_v1()is distinct from true then return jsonb_build_object('status','blocked','code','feature_unavailable');end if;
 -- The established reader reserves native receipt, classification and expense sources.
 ledger:=app.get_native_ledger_allocation_v1(tid);
 if ledger->>'status'='retry_exact'then return ledger;end if;
 if ledger->>'status'is distinct from'current'or ledger->>'fundAvailable'is distinct from'true'then return jsonb_build_object('status','blocked','code','current_allocation_required');end if;
 -- Freeze result corrections and event-specific recipient identity for this read.
 lock table app.satellite_result_packages,app.satellite_result_versions,app.event_participants,
 app.native_unrestricted_income_sources_v1,app.native_unrestricted_income_records_v1 in share mode nowait;
 perform 1 from app.events where id=eid and tournament_id=tid and event_type='satellite'and format='standard_singles'and operational_state='active'for share nowait;
 if not found then return jsonb_build_object('status','blocked','code','unsupported_satellite');end if;
 if not(ledger#>'{snapshot,eventIds}'?eid::text)then return jsonb_build_object('status','blocked','code','event_not_in_current_allocation');end if;
 -- Existing income journal is tied to a Main/Con proposal. Never assume absence
 -- of an income adapter means zero known Satellite income, or borrow sibling income.
 if exists(select 1 from app.native_unrestricted_income_records_v1 where tournament_id=tid and event_id=eid)then return jsonb_build_object('status','blocked','code','satellite_income_bridge_required');end if;
 select s.*into v from app.satellite_result_versions s join app.satellite_result_packages p on p.id=s.package_id and p.tournament_id=s.tournament_id and p.event_id=s.event_id where s.tournament_id=tid and s.event_id=eid order by s.version desc limit 1;
 if v.id is null or v.status not in('finalized','corrected')or v.cross_check_complete is distinct from true then return jsonb_build_object('status','blocked','code','reviewed_results_required');end if;
 if app.validate_satellite_result_document_v1(v.placements,v.special_hands,true)<>'valid'then return jsonb_build_object('status','blocked','code','invalid_result_document');end if;
 select coalesce(jsonb_agg(jsonb_build_object('participantId',p.id,'rosterEntryId',p.roster_entry_id)order by p.id),'[]')into participants from app.event_participants p where p.tournament_id=tid and p.event_id=eid and p.status in('registered','checked_in');
 if jsonb_array_length(participants)>10000 or jsonb_array_length(v.placements)>10000 then return jsonb_build_object('status','blocked','code','technical_resource_bound');end if;
 capture:=jsonb_build_object('allocation',ledger,'result',jsonb_build_object('packageId',v.package_id,'versionId',v.id,'version',v.version,'status',v.status,'crossCheckComplete',v.cross_check_complete,'placements',v.placements),'participants',participants);
 h:=encode(extensions.digest(convert_to(jsonb_build_array('satellite-recorded-reconciliation-source-v1',actor,tid,eid,capture)::text,'utf8'),'sha256'),'hex');
 return jsonb_build_object('kind','satellite-recorded-reconciliation-source-v1','status','source_available','actorId',actor,'tournamentId',tid,'eventId',eid,'sourceDigest',h,'capture',capture,'incomeCoverage','not_reviewed','fundCompletenessReviewed',false,'bankReceiptVerified',false,'payoutAuthorized',false,'moneyMoved',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;
alter function app.get_satellite_recorded_reconciliation_v1(uuid,uuid)owner to postgres;
revoke all on function app.satellite_recorded_reconciliation_enabled_v1(),app.get_satellite_recorded_reconciliation_v1(uuid,uuid)from public,anon,authenticated,service_role;
commit;
