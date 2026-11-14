import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const sql=fs.readFileSync('database/proposals/native-mixed-pool-preparation-read-v1.sql','utf8');
test('new preparation source is atomic, default off, revoked, read only and leaves existing functions alone',()=>{
 assert.match(sql,/^begin;$/m);assert.match(sql,/commit;\s*$/);
 assert.match(sql,/select false/);assert.doesNotMatch(sql,/create or replace|insert into|update |delete from|grant execute|grant usage/i);
 assert.match(sql,/from public,anon,authenticated,service_role/);
});
test('own current Director/session/pilot required before source and again before return',()=>{
 assert.match(sql,/role='director'for share nowait/);
 assert.equal(sql.split('app.native_mixed_pool_actor_v1()').length-1,2);
 assert.equal(sql.split('app.native_mixed_pilot_permitted_v1(actor,tid,eid,false)').length-1,2);
 assert(sql.indexOf("role='director'")<sql.indexOf('funding:=app.native_mixed_funding_seal_source_v1'));
 assert.match(sql,/transaction_isolation.*read committed/);
});
test('pool identifiers derive from saved admission event and existing supported method resolver',()=>{
 assert.match(sql,/intent.setup_event_capture->>'id'/);
 assert.match(sql,/app.native_mixed_pool_setup_v1\(tid,eid,candidate.kind,candidate.pool_id,funding\)/);
 assert.match(sql,/'supported',v_amount_supported/);
 assert.doesNotMatch(sql,/amountPolicy|native_mixed_pool_amounts_v1\(/);
});
test('selected rounding comes only from current funding capture; unknown legacy never defaults',()=>{
 assert(sql.includes("v_latest_prize:=scope_row.source_capture#>'{baseSource,latestPrize}'"));
 assert(sql.includes("case when candidate.kind='q'then'qPool'else'sidePool'end"));
 assert(sql.includes("v_rounding_text not in('1','5','10')"));assert(sql.includes('v_rounding_text::integer*100'));
 assert(sql.includes("'roundingStatus',case when v_latest_prize is null then'unknown_legacy'else'saved_latest'end"));
 assert(sql.includes("'roundingSourceDigest',v_rounding_digest"));assert.doesNotMatch(sql,/coalesce\(v_rounding_(?:text|unit)/);
});
test('preparation amount readiness mirrors current writer fee admission without calculating awards',()=>{
 assert(sql.includes('candidate.fee in(1000,2000,5000,10000)'));assert(sql.includes('candidate.fee>=500 and candidate.fee%500=0'));assert(sql.includes('candidate.fee>0 and candidate.fee%100=0'));
 const writer=fs.readFileSync('database/proposals/native-mixed-pool-finance-v1.sql','utf8');assert(writer.includes('not in(1000,2000,5000,10000)'));assert(writer.includes('::integer%500<>0'));assert(writer.includes('::integer%100<>0'));
});
test('paper projection contains explicit narrow fields without whole records or contact/profile/ACC disclosure',()=>{
 const projection=sql.slice(sql.indexOf("select coalesce(jsonb_agg(jsonb_build_object('participantId'"),sql.indexOf('if jsonb_array_length(paper)'));
 for(const field of['participantId','rosterEntryId','displayName','fixedTournamentId','simulationOnly'])assert(projection.includes(`'${field}'`));
 assert.doesNotMatch(projection,/to_jsonb|claimed_email|claimed_acc|claimed_normalized|profileId'\s*,/);
 assert.match(sql,/p.profile_id is null/);assert.match(sql,/r.scorecard_type='paper'/);
 assert.match(sql,/jsonb_array_length\(paper\)<>12/);
 assert.match(sql,/in share mode nowait/);
});
test('fixed IDs require reviewed exact publication sidecar; pre-draw IDs remain pending',()=>{
 assert.match(sql,/app.native_mixed_simulation_publication_bound_v1\(v_context_id\)is distinct from true/);
 assert.match(sql,/select ss.assignments_capture into assignments from app.native_mixed_simulation_seating_sidecars_v1 ss where ss.context_id=v_context_id/);
 assert.match(sql,/value->>'rosterEntryId'=r.id::text and value->>'participantId'=p.id::text/);
 assert.match(sql,/v_context_id is null then 'pending'else 'published'/);
 assert.doesNotMatch(sql,/a.verification_id|set_config\(|native_mixed_simulation_schedule_source_v1\(/);
 assert.match(sql,/x->>'fixedTournamentId'is null/);
});
test('publication lookup local identifier cannot collide with publication_id columns',()=>{
 assert.match(sql,/v_context_id uuid/);
 assert.match(sql,/select c.id into v_context_id from app.native_mixed_simulation_publication_contexts_v1 c where c.tournament_id=tid and c.event_id=eid/);
 assert.doesNotMatch(sql,/\bpublication_id\b|where context_id=/);
});
test('saved label and fee remain visible even for unsupported definitions; raw records never projected',()=>{
 assert.match(sql,/q.pool_type_code saved_label,q.entry_fee_cents fee/);
 assert.match(sql,/s.pool_type_code,s.entry_fee_cents/);
 assert.match(sql,/'label',left\(regexp_replace\(trim\(candidate.saved_label\),'\[\[:cntrl:\]\]','','g'\),160\)/);
 assert.match(sql,/'feeMinor',candidate.fee/);
 assert.doesNotMatch(sql,/'setup',source|'definition',source|to_jsonb\(/);
});
test('Director-only six digital labels derive exact funded roster/account identities, never contact/profile fields',()=>{
 const projection=sql.slice(sql.indexOf('-- Six linked digital roster labels'),sql.indexOf('if jsonb_array_length(digital)'));
 for(const field of['participantId','rosterEntryId','displayName','fixedTournamentId','fixedIdStatus'])assert(projection.includes(`'${field}'`));
 assert(projection.includes("p.profile_id::text=x->>'profileId'"));assert(projection.includes('app.roster_account_links l'));assert(projection.includes("r.scorecard_type='digital'"));
 assert.doesNotMatch(projection,/'profileId'\s*,|'accountLinkId'\s*,|claimed_email|claimed_acc|to_jsonb\(/);
 assert(sql.includes('jsonb_array_length(digital)<>6'));assert(sql.includes("'digitalParticipants',digital"));
});
test('preStart is locked actual absence, never inferred from empty policy/fund or unavailable source',()=>{
 assert(sql.includes('app.native_mixed_simulation_starts_v1,app.event_play_starts'));
 assert(sql.includes('v_pre_start:=not exists(select 1 from app.native_mixed_simulation_starts_v1 ns where ns.tournament_id=tid and ns.event_id=eid)'));
 assert(sql.includes('and not exists(select 1 from app.event_play_starts os where os.tournament_id=tid and os.event_id=eid)'));
 assert(sql.includes("'preStart',v_pre_start"));assert.doesNotMatch(sql,/coalesce\(v_pre_start|v_pre_start\s*:=\s*true/);
});
