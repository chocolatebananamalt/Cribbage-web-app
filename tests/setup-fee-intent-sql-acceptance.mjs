import assert from 'node:assert/strict';
export async function verifySetupFeeIntent({sql,read,prepareLegacy=false,legacy=null}){
 const actor='a2690000-0000-4000-8000-000000000001',id=(p,n)=>`${p}2690000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const json=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb",checks=[];
 const status=(r,s)=>assert.equal(r?.status,s,JSON.stringify(r));
 if(prepareLegacy)sql(`insert into auth.users(id,email)values('${actor}','explicit-fee-director@test.invalid');`);
 const event=(n,fee=3000,free)=>({clientRowId:id('c',n),eventKind:'main',displayName:'Main',startsAt:'2027-02-03T09:00',timezone:'Pacific/Honolulu',styleCode:'Standard',formatCode:'standard_singles',gameCount:12,entryFeeCents:fee,feeIncludesNote:'',payoutNote:'',qualificationNote:'',eligibilityNote:'',mugginsStatus:'unset',qPools:[],...(free===undefined?{}:{freeEntry:free})});
 const payload=e=>({tournamentName:'TEST ONLY explicit fee',city:'Honolulu',venue:'TEST ONLY Hall \u2014 1 Test Lane \u00b7 96801',venueName:'TEST ONLY Hall',venueStreet:'1 Test Lane',venuePostalCode:'96801',stateTerritory:'Hawaii',startsAt:'2027-02-03T09:00',endsAt:'2027-02-03T18:00',timezone:'Pacific/Honolulu',tournamentDirectorPublicName:'Test Director',tournamentDirectorFirstName:'Test',tournamentDirectorLastName:'Director',tournamentContactPhone:'',tournamentContactEmail:'',tournamentMailingAddress:'',mainSanctioningFeeRateCents:300,consolationSanctioningFeeRateCents:100,mainSanctioningFeeOverrideReason:'',mainSanctioningFeeOverrideReference:'',consolationSanctioningFeeOverrideReason:'',consolationSanctioningFeeOverrideReference:'',officials:[{profileId:actor,role:'director'}],events:[e]});
 const shell=n=>{const tid=id('b',n);sql(`insert into app.tournaments(id,director_profile_id,name,status,registration_status)values('${tid}','${actor}','TEST ONLY explicit fee ${n}','draft','closed');insert into app.tournament_roles(tournament_id,profile_id,role)values('${tid}','${actor}','director');`);return tid;};
 const save=(tid,p,op,version=0,fn='save_tournament_setup_version')=>read(`select public.${fn}('${tid}',${version},${json(p)},'${op}');`);
 const workspace=tid=>read(`select public.get_tournament_setup_workspace('${tid}');`);
 if(prepareLegacy){
  const tid=shell(90),e=event(90,0);e.qPools=[{poolTypeCode:'Equal (Pays All Equally)',entryFeeCents:100,note:'TEST ONLY historical small fee'}];const p=payload(e),op=id('d',90),saved=save(tid,p,op);status(saved,'setup_draft_saved');
  const sideEvents=[{...e,sidePools:[{poolTypeCode:'TEST ONLY historical Side',entryFeeCents:100,note:''}]}];status(read(`select public.configure_tournament_setup_side_pools_v1('${actor}','${tid}','${saved.revisionId}',${json(sideEvents)});`),'setup_side_pools_configured');
  const active=read(`select public.finalize_tournament_setup_and_open_registration_v1('${actor}','${tid}','${saved.revisionId}',1,true,'${id('e',90)}');`);status(active,'tournament_setup_activated');
  status(read(`select public.materialize_tournament_setup_side_pools_v1('${actor}','${tid}','${saved.revisionId}');`),'setup_side_pools_materialized');
  const eventId=read(`select to_jsonb(event_id)from app.tournament_setup_activations where tournament_id='${tid}';`),oldPool=id('f',90),oldAdd=`select public.add_event_side_pool_v1('${actor}','${tid}','${eventId}','${oldPool}','TEST ONLY','TEST ONLY old operational Side',100,'${id('e',91)}');`,oldAdded=read(oldAdd);status(oldAdded,'side_pool_added');
  return {tid,p,op,saved,sideEvents,eventId,oldPool,oldAdd,oldAdded};
 }
 const minimum=read("select app.setup_paid_fee_minimum_v1('main');");assert.ok(minimum>=100);
 assert.deepEqual(save(legacy.tid,legacy.p,legacy.op),legacy.saved);
 assert.equal('freeEntry'in workspace(legacy.tid).current.events[0],false);
 assert.equal(read(`select count(*)::integer from app.tournament_setup_event_versions where free_entry is not null;`),0);
 assert.deepEqual(read(legacy.oldAdd),legacy.oldAdded);
 status(read(`select public.configure_tournament_setup_side_pools_v1('${actor}','${legacy.tid}','${legacy.saved.revisionId}',${json(legacy.sideEvents)});`),'rejected'); // finalized remains closed, unchanged contract
 checks.push('old accepted zero-fee setup replays exactly; legacy marker remains NULL/omitted without inference');
 let n=1;
 for(const fee of[undefined,'','  ',null,'0','100',0,-1,1,100,minimum-1]){
  const tid=shell(n),e=event(n,fee,false);if(fee===undefined)delete e.entryFeeCents;
  status(save(tid,payload(e),id('d',n)),'rejected');assert.equal(read(`select count(*)::integer from app.tournament_setup_revisions where tournament_id='${tid}';`),0);n++;
 }
 for(const flag of[undefined,false,null,'true']){const tid=shell(n);status(save(tid,payload(event(n,0,flag)),id('d',n)),'rejected');n++;}
 const paidTid=shell(n),paid=save(paidTid,payload(event(n,minimum)),id('d',n));status(paid,'setup_draft_saved');assert.equal(workspace(paidTid).current.events[0].freeEntry,false);n++;
 const freeTid=shell(n),freeEvent=event(n,0,true),freePayload=payload(freeEvent),freeOp=id('d',n),freeSaved=save(freeTid,freePayload,freeOp);status(freeSaved,'setup_draft_saved');assert.equal(workspace(freeTid).current.events[0].freeEntry,true);
 assert.deepEqual(save(freeTid,freePayload,freeOp),freeSaved);assert.equal(save(freeTid,payload({...freeEvent,freeEntry:false}),freeOp).code,'idempotency_conflict');
 status(read(`select public.activate_tournament_setup_v2('${actor}','${freeTid}','${freeSaved.revisionId}',1,'${id('e',n)}');`),'tournament_setup_activated');n++;
 const contradictory=shell(n);status(save(contradictory,payload(event(n,3000,true)),id('d',n)),'rejected');n++;
 checks.push('missing/blank/whitespace/string/null/zero/negative/under-minimum paid fees rejected; explicit free zero and valid paid accepted with hashed replay/conflict');
 // Exact legacy alias request shapes all reach the same hardened bottom writer.
 const aliases=['save_tournament_setup_version_legacy','save_tournament_setup_version_structured_contact','save_tournament_setup_version_before_state_territory','save_tournament_setup_version_before_structured_details','save_tournament_setup_version_before_optional_contact','save_tournament_setup_version'];
 for(const alias of aliases){
  const tid=shell(n),p=payload(event(n,0,false));
  p.tournamentContactPhone='0000000';p.tournamentContactEmail='fixture@example.invalid';
  if(!['save_tournament_setup_version_before_optional_contact','save_tournament_setup_version'].includes(alias))for(const key of['venueName','venueStreet','venuePostalCode','tournamentDirectorFirstName','tournamentDirectorLastName'])delete p[key];
  if(['save_tournament_setup_version_legacy','save_tournament_setup_version_structured_contact','save_tournament_setup_version_before_state_territory'].includes(alias)){delete p.stateTerritory;delete p.tournamentDirectorPublicName;}
  if(['save_tournament_setup_version_legacy','save_tournament_setup_version_structured_contact'].includes(alias)){for(const key of['mainSanctioningFeeRateCents','consolationSanctioningFeeRateCents','mainSanctioningFeeOverrideReason','mainSanctioningFeeOverrideReference','consolationSanctioningFeeOverrideReason','consolationSanctioningFeeOverrideReference'])delete p[key];p.sanctioningFeeCents=null;}
  if(alias==='save_tournament_setup_version_legacy'){for(const key of['tournamentContactPhone','tournamentContactEmail','tournamentMailingAddress'])delete p[key];p.contactDetails='';}
  const result=save(tid,p,id('d',n),0,alias);assert.equal(result.code,'invalid_event',alias+': '+JSON.stringify(result));n++;
 }
 checks.push('all six existing public setup writer/legacy alias shapes reject an implicit zero at the hardened bottom writer');
 for(const poolFee of[undefined,'','  ',null,'500',-500,0,1,100,499,750,500,1000]){
  const tid=shell(n),e=event(n,3000,false);e.qPools=[{poolTypeCode:'Equal (Pays All Equally)',entryFeeCents:poolFee,note:''}];const r=save(tid,payload(e),id('d',n));status(r,typeof poolFee==='number'&&poolFee>=500&&poolFee%500===0?'setup_draft_saved':'rejected');n++;
  const stid=shell(n),se=event(n,3000,false),ss=save(stid,payload(se),id('d',n));status(ss,'setup_draft_saved');const sr=read(`select public.configure_tournament_setup_side_pools_v1('${actor}','${stid}','${ss.revisionId}',${json([{...se,sidePools:[{poolTypeCode:'TEST ONLY Side',entryFeeCents:poolFee,note:''}]}])});`);status(sr,typeof poolFee==='number'&&poolFee>=500&&poolFee%500===0?'setup_side_pools_configured':'rejected');n++;
 }
 checks.push('new configured Q/Side fees enforce positive500-unit boundaries including500 and1000 success and750 rejection');
 const guarded=query=>{let rejected=false;try{sql(query);}catch(error){assert.match(String(error),/invalid setup event|invalid setup q pool|invalid side pools/);rejected=true;}assert.ok(rejected,'raw new fee insert must fail');};
 guarded(`insert into app.tournament_setup_event_versions select (jsonb_populate_record(null::app.tournament_setup_event_versions,to_jsonb(s)||jsonb_build_object('id','${id('f',800)}','client_row_id','${id('f',801)}','ordinal',2,'event_kind','satellite','display_name','TEST ONLY implicit raw zero','entry_fee_cents',0,'free_entry',null))).*from app.tournament_setup_event_versions s where s.setup_revision_id='${paid.revisionId}';`);
 guarded(`insert into app.tournament_setup_q_pool_versions(tournament_id,setup_revision_id,setup_event_version_id,slot,pool_type_code,entry_fee_cents,note)select tournament_id,setup_revision_id,id,1,'TEST ONLY raw Q',750,''from app.tournament_setup_event_versions where setup_revision_id='${paid.revisionId}';`);
 guarded(`insert into app.tournament_setup_side_pool_versions(tournament_id,setup_revision_id,setup_event_version_id,slot,pool_type_code,entry_fee_cents,note,actor_profile_id,operation_receipt_id)select s.tournament_id,s.setup_revision_id,s.id,1,'TEST ONLY raw Side',750,'','${actor}',r.operation_receipt_id from app.tournament_setup_event_versions s join app.tournament_setup_revisions r on r.id=s.setup_revision_id where r.id='${paid.revisionId}';`);
 checks.push('raw base/Q/Side inserts cannot bypass explicit intent or500-unit rules');
 for(const fee of[0,100,499,750,500,1000]){const pool=id('f',300+n),r=read(`select public.add_event_side_pool_v1('${actor}','${freeTid}',(select event_id from app.tournament_setup_activations where tournament_id='${freeTid}'),'${pool}','TEST ONLY','TEST ONLY operational ${n}',${fee},'${id('e',300+n)}');`);status(r,fee>=500&&fee%500===0?'side_pool_added':'rejected');n++;}
 status(read(`select public.retire_event_side_pool_v1('${actor}','${legacy.tid}','${legacy.eventId}','${legacy.oldPool}','TEST ONLY retire historical small fee without changing money','${id('e',202)}');`),'side_pool_retired');
 checks.push('operational Side add cannot bypass positive500 units; old accepted small-fee add replay and immutable retirement remain valid');
 const replacement=read(`select public.change_event_lifecycle_v1('${actor}','${legacy.tid}','${legacy.eventId}','replace','TEST ONLY source-bound historical fee preservation','${id('e',201)}');`);status(replacement,'event_replaced');
 assert.deepEqual(read(`select jsonb_build_array(s.entry_fee_cents,s.free_entry,(select entry_fee_cents from app.tournament_setup_q_pool_versions where setup_event_version_id=s.id))from app.tournament_setup_activations a join app.tournament_setup_event_versions s on s.id=a.setup_event_version_id where a.event_id='${replacement.replacementEventId}';`),[0,null,100]);
 checks.push('reviewed source-bound replacement preserves historical unknown free marker and old sub500 Q fee');
 // Public amendment hashes new cards including their explicit free choice.
 const latest=workspace(legacy.tid).current,appendEvent={...event(210,0,true),eventKind:'satellite',displayName:'TEST ONLY explicit free Satellite',gameCount:9};
 const appended=read(`select public.append_tournament_setup_events_v1('${actor}','${legacy.tid}','${latest.revisionId}',${latest.version},${json([appendEvent])},'${id('e',210)}');`);status(appended,'tournament_setup_amended');
 const current=workspace(legacy.tid).current.events;assert.equal(current.find(e=>e.clientRowId===appendEvent.clientRowId).freeEntry,true);assert.equal('freeEntry'in current.find(e=>e.clientRowId===legacy.p.events[0].clientRowId),false);
 const now=workspace(legacy.tid).current,consolation={...event(211,100,false),eventKind:'consolation',displayName:'TEST ONLY paid Consolation',gameCount:9};
 status(read(`select public.append_tournament_setup_events_v1('${actor}','${legacy.tid}','${now.revisionId}',${now.version},${json([consolation])},'${id('e',211)}');`),'tournament_setup_amended');
 const after=workspace(legacy.tid).current,badConsolation={...event(212,99,false),eventKind:'satellite',displayName:'TEST ONLY too small Satellite',gameCount:9};
 status(read(`select public.append_tournament_setup_events_v1('${actor}','${legacy.tid}','${after.revisionId}',${after.version},${json([badConsolation])},'${id('e',212)}');`),'rejected');
 checks.push('new appended free Satellite records intent while exact old-event carryover keeps historical unknown');
 const probe=(who=actor,tid=legacy.tid,kind='append_tournament_setup_events_v1',key=id('e',210))=>read(`select public.has_accepted_setup_amendment_operation_v1('${who}','${tid}','${kind}','${key}');`);
 assert.equal(probe(),true);assert.equal(probe(id('a',999)),false);assert.equal(probe(actor,paidTid),false);assert.equal(probe(actor,legacy.tid,'save_tournament_setup_version'),false);assert.equal(probe(actor,legacy.tid,'append_tournament_setup_events_v1',id('e',999)),false);assert.equal(probe(actor,legacy.tid,'append_tournament_setup_events_v1',id('e',212)),false);
 assert.equal(read(`set request.jwt.claim.role='authenticated';select public.has_accepted_setup_amendment_operation_v1('${actor}','${legacy.tid}','append_tournament_setup_events_v1','${id('e',210)}');`),false);
 assert.deepEqual(read("select jsonb_build_array(has_function_privilege('anon','public.has_accepted_setup_amendment_operation_v1(uuid,uuid,text,uuid)','EXECUTE'),has_function_privilege('authenticated','public.has_accepted_setup_amendment_operation_v1(uuid,uuid,text,uuid)','EXECUTE'),has_function_privilege('service_role','public.has_accepted_setup_amendment_operation_v1(uuid,uuid,text,uuid)','EXECUTE'));"),[false,false,true]);
 const altered={...appendEvent,freeEntry:false};assert.equal(read(`select public.append_tournament_setup_events_v1('${actor}','${legacy.tid}','${latest.revisionId}',${latest.version},${json([altered])},'${id('e',210)}');`).code,'idempotency_conflict');
 checks.push('service-only accepted amendment probe rejects wrong actor/tournament/kind/key, absent/rejected receipt and human role; probe never bypasses full writer hash');
 return {checks,minimumMinor:minimum,actualMoneyMoved:false};
}
