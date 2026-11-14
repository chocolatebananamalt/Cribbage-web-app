import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import vm from'node:vm';import ts from'typescript';
const tid='aaaa0000-0000-4000-8000-000000000001',eid='aaaa0000-0000-4000-8000-000000000002';
// Execute the actual server page offline with dependency spies. This tests
// admission/control flow, not provider sessions, rendering or database proof.
function page(file='src/app/tournament/[tournamentId]/results/page.tsx'){const state={gate:false,preparationGate:false,roles:['director'],calls:[],url:'https://nnhcnvksxgxnpvdqjgpg.supabase.co',gateAfterSummary:null};
 const summary=async()=>{state.calls.push('summary');if(state.gateAfterSummary!==null)state.gate=state.gateAfterSummary;return{tournamentName:'Fictional',events:[{eventId:eid,name:'Fictional Main',eventType:'main',format:'singles',participantCount:18}]};};
 const dependencies={
  'next/navigation':{notFound:()=>{throw Error('NOT_FOUND');}},
  'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},
  'validation':{isUuid:v=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v)},
  'require-tournament-access':{requireTournamentAccess:async()=>{state.calls.push('access');return{role:state.roles[0],roles:state.roles,user:{id:tid}};}},
  'event-summary':{getTournamentResultEventSummary:summary},
  'native-mixed-proposed-mrp-v1':{nativeMixedProposedMrpEnabledV1:()=>false},
  'native-mixed-event-results-v1':{nativeMixedEventResultsEnabledV1:()=>state.gate},
  'native-mixed-pilot-preparation-v1':{nativeMixedPreparationPageEnabledV1:()=>state.preparationGate},
  'native-mixed-finance-route-gates-v1':{nativeMixedMainFinanceRouteEnabledV1:()=>true,nativeMixedPoolDirectorRouteEnabledV1:()=>true},
  'native-mixed-pool-player-route-v1':{nativeMixedPoolPlayerRouteEnabledV1:()=>false,prepareNativeMixedPoolPlayerRouteV1:async({params})=>params},
  'native-mixed-playoff-own-route-v1':{nativeMixedPlayoffOwnRouteEnabledV1:()=>false},
  'native-mixed-review-read-v1':{nativeMixedReviewUiEnabledV1:()=>true},
  'integrated-test-target.ts':{integratedTestBackendOrigin:()=> 'https://nnhcnvksxgxnpvdqjgpg.supabase.co',integratedTestBackendRef:()=> 'nnhcnvksxgxnpvdqjgpg'},
  'env':{getPublicSupabaseEnv:()=>({url:state.url})},
  'server':{createClient:async()=>{state.calls.push('normalClient');return{auth:{getClaims:async()=>({data:{claims:{session_id:eid}}})}};}},
  'native-mixed-event-results-read-v1':{readNativeMixedEventResultsV1:async()=>{state.calls.push('nativeRead');return null;}},
 };
 const source=fs.readFileSync(file,'utf8'),js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,compiledModule={exports:{}};
 vm.runInNewContext(js,{module:compiledModule,exports:compiledModule.exports,URL,require:name=>dependencies[name]??dependencies[name.split('/').at(-1)]??new Proxy({},{get:(_o,key)=>()=>{state.calls.push(String(key));throw Error('UNEXPECTED_DEPENDENCY:'+name+':'+String(key));}})});
 return{state,run:query=>compiledModule.exports.default({params:Promise.resolve({tournamentId:tid,eventId:eid}),searchParams:Promise.resolve(query)})};
}
const links=tree=>{const found=[];function visit(x){if(Array.isArray(x)){x.forEach(visit);return;}if(!x||typeof x!=='object')return;if(x.props?.href)found.push({href:x.props.href,label:x.props.children});visit(x.props?.children);}visit(tree);return found;};
test('closed explicit practice request cannot fall through to ordinary results or construct a native client',async()=>{const p=page();await assert.rejects(p.run({event:eid,practice:'mixed'}),/NOT_FOUND/);assert(!p.state.calls.includes('summary'));assert(!p.state.calls.includes('normalClient'));});
test('unknown empty repeated mode and missing event reject before ordinary reads',async()=>{for(const query of[{event:eid,practice:''},{event:eid,practice:'other'},{event:eid,practice:['mixed','mixed']},{practice:'mixed'}]){const p=page();p.state.gate=true;await assert.rejects(p.run(query),/NOT_FOUND/);assert(!p.state.calls.includes('summary'));}});
test('explicit practice requires existing official access; ordinary selection remains available',async()=>{for(const role of['player','viewer','cross_checker']){const p=page();p.state.gate=true;p.state.roles=[role];await assert.rejects(p.run({event:eid,practice:'mixed'}),/NOT_FOUND/);assert(!p.state.calls.includes('summary'));}const p=page();await p.run({});assert.deepEqual(p.state.calls,['access','summary']);});
test('native branch rechecks gate and project before SDK; valid intent never falls into ordinary handlers',async()=>{const revoked=page();revoked.state.gate=true;revoked.state.gateAfterSummary=false;await assert.rejects(revoked.run({event:eid,practice:'mixed'}),/NOT_FOUND/);assert(!revoked.state.calls.includes('normalClient'));const wrong=page();wrong.state.gate=true;wrong.state.url='https://wrong.example';await assert.rejects(wrong.run({event:eid,practice:'mixed'}),/NOT_FOUND/);assert(!wrong.state.calls.includes('normalClient'));const ok=page();ok.state.gate=true;await ok.run({event:eid,practice:'mixed'});assert.deepEqual(ok.state.calls,['access','summary','normalClient','nativeRead']);});
test('Director section links retain exact event and explicit practice intent only when Results is enabled',async()=>{for(const file of['rehearsal-prepare/[eventId]','rehearsal-review/[eventId]','rehearsal/[eventId]/finance','rehearsal/[eventId]/pool-policies']){const p=page(`src/app/tournament/[tournamentId]/${file}/page.tsx`);p.state.preparationGate=true;assert(!links(await p.run({})).some(x=>x.label==='Practice Results'));p.state.gate=true;const actual=links(await p.run({})).filter(x=>x.label==='Practice Results');assert.equal(actual.length,1,file);assert.equal(actual[0].href,`/tournament/${tid}/results?event=${eid}&practice=mixed`);}});
test('Results does not advertise a closed preparation destination',async()=>{const p=page();p.state.gate=true;const query={event:eid,practice:'mixed'};assert(!links(await p.run(query)).some(x=>x.label==='Back to Rehearsal Preparation'));p.state.preparationGate=true;assert.equal(links(await p.run(query)).find(x=>x.label==='Back to Rehearsal Preparation')?.href,`/tournament/${tid}/rehearsal-prepare/${eid}`);});
