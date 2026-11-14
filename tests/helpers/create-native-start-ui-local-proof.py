"""Derive one isolated acceptance fixture from the frozen previous local proof."""
from pathlib import Path
import re
old, new = 'native-mixed-pilot-prep1082', 'native-mixed-start-ui'
folder=Path(f'test-results/{new}-20261107')
assert not (folder/'state.json').exists(), 'Never overwrite an existing fixture run'
def adapt(s):
    return s.replace(old, new).replace('fixture_native_mixed_pilot_prep1082', 'fixture_native_mixed_start_ui')
for part in ['runtime','setup','flow','scoring','run']:
    source=adapt(Path(f'tests/{old}-acceptance-local-{part}.mjs').read_text(encoding='utf8'))
    if part=='run':
        source=source.replace("'database/proposals/native-mixed-pilot-draw-reservation-v1.sql'", "'database/proposals/native-mixed-pilot-draw-reservation-v1.sql','database/proposals/native-mixed-pilot-bootstrap-status-v1.sql','src/lib/seating/native-mixed-start-session-v1.ts','src/lib/seating/native-mixed-bootstrap-status-v1.ts','src/components/native-mixed-start-panel-v1.tsx','src/components/native-mixed-bootstrap-status-v1.tsx'")
    if part=='scoring':
        source=source.replace("else if(action==='full')", """else if(action==='start-ui-smoke')await withGates(()=>{
 cache.gameResults??={};cache.scoringRequests??=[];
 const results=[],seen=new Set();for(let round=1;round<=12;round++){for(const[i,g]of cache.scheduleSource.canonicalGames.entries()){if(g.round!==round)continue;const row=finishGameBatch(g,i);results.push(row);seen.add(row.pairing);}if(seen.size===3)break;}
 assert.deepEqual([...seen].sort(),['DD','DP','PP']);const totals=counts(),expected=results.reduce((n,g)=>n+(g.pairing==='PP'?2:4),0);assert.equal(totals.entries,expected);assert.equal(totals.operations,expected);assert.equal(totals.audits,expected);
 const ordinary=read(`select jsonb_build_object('starts',(select count(*)from app.event_play_starts),'submissions',(select count(*)from app.score_submissions),'confirmations',(select count(*)from app.score_confirmations),'lines',(select count(*)from app.card_scorelines),'paperCompletions',(select count(*)from app.paper_game_completions));`);assert.deepEqual(ordinary,{starts:0,submissions:0,confirmations:0,lines:0,paperCompletions:0});
 cache.startUISmoke={results,totals,ordinary,full108Claimed:false};persist();console.log('PASS Start UI subsequent qualifying rounds include all three modes; ordinary records unchanged');
});
else if(action==='full')""")
    Path(f'tests/{new}-acceptance-local-{part}.mjs').write_text(source,encoding='utf8')
Path(f'tests/helpers/{new}-acceptance-db.mjs').write_text(adapt(Path(f'tests/helpers/{old}-acceptance-db.mjs').read_text(encoding='utf8')),encoding='utf8')
source=adapt(Path(f'tests/{old}-acceptance-local-author.mjs').read_text(encoding='utf8'))
source="import{NativeMixedStartSessionV1}from'../src/lib/seating/native-mixed-start-session-v1.ts';\nimport{readNativeMixedBootstrapStatusV1}from'../src/lib/seating/native-mixed-bootstrap-status-v1.ts';\n"+source
source=source.replace("'native-mixed-pilot-preparation-v1.sql']", "'native-mixed-pilot-preparation-v1.sql','native-mixed-pilot-draw-reservation-v1.sql','native-mixed-pilot-bootstrap-status-v1.sql']")
source=source.replace("'public.get_native_mixed_pilot_preparation_v1(uuid,uuid,uuid,uuid)'];", "'public.get_native_mixed_pilot_preparation_v1(uuid,uuid,uuid,uuid)','public.reserve_native_mixed_pilot_draw_v1(uuid,uuid,uuid,uuid,jsonb)','public.get_native_mixed_pilot_bootstrap_v1(uuid,uuid,uuid,uuid)'];")
source=source.replace("'get_native_mixed_pilot_preparation_v1','execute", "'get_native_mixed_pilot_bootstrap_v1','get_native_mixed_pilot_preparation_v1','execute")
source=source.replace('let allowed=true,dropDraw=true;', 'let allowed=true,dropDraw=true,dropStart=true;')
source=source.replace("try{\n for(const g of originals)","try{\n sql('grant execute on function public.record_native_mixed_digital_consent_v1(uuid,uuid,jsonb)to authenticated;');\n for(const g of originals)")
source=source.replace("if(suffix==='/preparation')", "if(suffix==='/bootstrap')r=await preparation.bootstrapGET(request,base);else if(suffix==='/preparation')")
source=source.replace("else if(suffix.startsWith('/start/'))r=await handlers.simulatedStartPOST", "else if(suffix.startsWith('/start/')&&suffix.endsWith('/operation'))r=await handlers.simulatedStartOperationPOST(request,{params:Promise.resolve({id:tid,eventId:eid,operationId:suffix.split('/')[2]})});else if(suffix.startsWith('/start/')&&suffix.endsWith('/source'))r=await handlers.simulatedStartedSourcePOST(request,{params:Promise.resolve({id:tid,eventId:eid,operationId:suffix.split('/')[2]})});else if(suffix.startsWith('/start/'))r=await handlers.simulatedStartPOST")
source=source.replace("calls.push({path:suffix,method:init.method,status:r.status});", "if(suffix.startsWith('/start/')&&!suffix.endsWith('/operation')&&!suffix.endsWith('/source')&&dropStart&&r.status===200){dropStart=false;calls.push({path:suffix,method:init.method,status:r.status});throw Error('SIMULATED START REPLY LOST AFTER REAL COMMIT');}calls.push({path:suffix,method:init.method,status:r.status});")
source,count=re.subn(r"if\(phase==='plan'\)\{\r?\n const request=\{kind:'native-mixed-simulation-draw-v1'[\s\S]*?checks.push\('durable draw reservation[^\n]*\n\}", '', source)
assert count==1
begin=source.index(' const startRequest=')
end=source.index(' // The full scorer expects',begin)
source=source[:begin]+"""
 const bootstrap=readNativeMixedBootstrapStatusV1(await http.bootstrap(),scope);assert(bootstrap);assert.equal(bootstrap.currentReadinessVerified,true);assert.equal(bootstrap.records.grantedConsentCount,6);assert.equal(bootstrap.readOnly,true);
 const defaults=read(`select jsonb_build_object('auth',has_function_privilege('authenticated','public.get_native_mixed_pilot_bootstrap_v1(uuid,uuid,uuid,uuid)','execute'),'anon',has_function_privilege('anon','public.get_native_mixed_pilot_bootstrap_v1(uuid,uuid,uuid,uuid)','execute'));`);assert.deepEqual(defaults,{auth:false,anon:false});
 const startOptions={retained,currentContext:()=>allowed?context:null,canRead:()=>allowed,canWrite:()=>allowed,readiness:http.bootstrap,source:http.source,execute:http.start,operation:http.startOperation,started:http.started,makeId:()=>randomUUID()};
 let start=new NativeMixedStartSessionV1(startOptions);await start.activate(context);assert(await start.prepare());const startModels=[start.getSnapshot()];assert.equal(await start.submit(false),false);assert.equal(await start.submit(true),false);startModels.push(start.getSnapshot());assert.equal(start.getSnapshot().phase,'attempted');assert.equal(await start.retryExact(),false);
 start=new NativeMixedStartSessionV1(startOptions);await start.activate(context);assert.equal(await start.prepare(),false);assert.equal(await start.retryExact(),false);assert(await start.check());assert.equal(start.getSnapshot().currentStarted,true);startModels.push(start.getSnapshot());cache.start=start.getSnapshot().receipt;persist();assert.equal(sql(`select count(*)from app.native_mixed_simulation_starts_v1 where event_id='${eid}'`),'1');
 assert.equal(calls.filter(c=>/^\\/start\\/[^/]+$/.test(c.path)&&c.method==='POST').length,1);checks.push('retained Start UI confirmed; committed reply loss; reload check without resend; fresh source revalidated');
 const secondDevice=new NativeMixedStartSessionV1({...startOptions,retained:{read:async()=>null,transition:async()=>{throw Error('No second-device Start storage write allowed');}},makeId:()=>{throw Error('No second Start nonce allowed');}});await secondDevice.activate(context);assert.equal(await secondDevice.prepare(),false);assert.equal(secondDevice.getSnapshot().status,'blocked');checks.push('second device sees existing Start before nonce creation or storage write');
 const p=flow.seed18[0],prior=flow.consent_0,revoke={...flow.req_consent_0,operationId:randomUUID(),decision:'revoked',expectedPriorConsentId:prior.consentId,expectedVersion:prior.version};
 const afterRevocation=sql('begin;'+claims(p.profile,'authenticated',cache.sessionIds[p.profile])+`select public.record_native_mixed_digital_consent_v1('${tid}','${eid}',${json(revoke)});`+claims(actor)+`select public.get_native_mixed_pilot_bootstrap_v1('${actor}','${session}','${tid}','${eid}');reset role;rollback;`).split('\\n').filter(Boolean).map(JSON.parse);assert.equal(afterRevocation[0].status,'accepted');assert.equal(afterRevocation[1].currentReadinessVerified,false);assert.equal(afterRevocation[1].records.grantedConsentCount,5);assert(readNativeMixedBootstrapStatusV1(afterRevocation[1],scope));
 const foreign=read(claims(actor)+`select public.get_native_mixed_pilot_bootstrap_v1('${checker}','${session}','${tid}','${eid}');`);assert.equal(foreign,null);assert.equal(readNativeMixedBootstrapStatusV1(await http.bootstrap(),scope).currentReadinessVerified,true);
 fs.writeFileSync(dir+'/start-ui-actual-models.json',JSON.stringify({snapshots:startModels,bootstrap,revokedBootstrap:afterRevocation[1]},null,2));checks.push('read-only bootstrap tracks own consent revocation, never ordinary attendance; foreign-session read denied');
"""+source[end:]
start=source.index(" for(const[name,args]of[['full'")
end=source.index(' verifyCompatibility',start)
source=source[:start]+""" const probe=spawnSync(process.execPath,['--conditions=react-server','--experimental-strip-types','tests/native-mixed-start-ui-acceptance-local-scoring.mjs','start-ui-smoke'],{encoding:'utf8',windowsHide:true,maxBuffer:32e6});fs.writeFileSync(dir+'/scoring-probe.log',probe.stdout+probe.stderr);assert.equal(probe.status,0,probe.stderr||probe.stdout);checks.push('three mixed scoring modes complete after retained Start');
"""+source[end:]
source=source.replace('full scoped108 after fresh page pipeline plus independent oracle and populated preservation','scoped Start UI plus scoring probe and populated preservation; no new full108 claim')
Path(f'tests/{new}-acceptance-local-author.mjs').write_text(source,encoding='utf8')
folder.mkdir(exist_ok=True)
(folder/'proposal-order.json').write_bytes(Path(f'test-results/{old}-20261107/proposal-order.json').read_bytes())
print('Prepared one local fictional Start UI acceptance fixture')
