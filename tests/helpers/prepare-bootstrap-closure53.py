"""Copy the verified byte-preserving candidate, omit four unused UI support proposals."""
from pathlib import Path
import json
old='native-mixed-bootstrap-min3';new='native-mixed-bootstrap-closure53'
d=Path('test-results/'+new+'-20261107');assert not (d/'state.json').exists();d.mkdir(exist_ok=True);(d/'schema').mkdir(exist_ok=True)
for p in Path('test-results/'+old+'-20261107/schema').glob('*.sql'):(d/'schema'/p.name).write_bytes(p.read_bytes())
(d/'proposal-order.json').write_bytes(Path('test-results/'+old+'-20261107/proposal-order.json').read_bytes())
manifest=json.loads(Path('test-results/'+old+'-20261107/derived-schema-manifest.json').read_text())
for x in manifest['files']:x['file']=x['file'].replace(old,new)
(d/'derived-schema-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
cut=['native-mixed-pilot-director-session-v1.sql','native-mixed-pilot-preparation-v1.sql','native-mixed-pilot-draw-reservation-v1.sql','native-mixed-pilot-bootstrap-status-v1.sql']
catalog="select coalesce(jsonb_agg(jsonb_build_object('signature',n.nspname||'.'||p.proname||'('||oidvectortypes(p.proargtypes)||')','definition',pg_get_functiondef(p.oid),'owner',p.proowner::regrole::text,'acl',p.proacl)order by n.nspname,p.proname,p.oid),'[]')from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('app','public');"
for part in ['runtime','setup','flow','scoring','author','run']:
 s=Path('tests/'+old+'-acceptance-local-'+part+'.mjs').read_text(encoding='utf8').replace(old,new).replace('fixture_native_mixed_bootstrap_min3','fixture_native_mixed_bootstrap_closure53')
 if part=='runtime':s=s.replace('state.compatibilitySeed=seedCompatibility', 'state.baselineFunctions=JSON.parse(sql(state,'+json.dumps(catalog)+'));state.compatibilitySeed=seedCompatibility')
 if part in ['author','run']:
  for n in cut:s=s.replace("'"+n+"',",'')
 if part=='author':
  at="assert.equal(read(\"select to_jsonb(app.native_mixed_bootstrap_enabled_v1());\"),false);"
  insert="""
// Least privilege: close every newly introduced function, leaving published functions untouched.
const beforeSignatures=new Set(state.baselineFunctions.map(x=>x.signature)),catalogQuery=CATALOG;
const installedFunctions=read(catalogQuery),newFunctions=installedFunctions.filter(x=>!beforeSignatures.has(x.signature));
assert(newFunctions.length>0);const literalRevokes=newFunctions.map(x=>`revoke all on function ${x.signature}from public,anon,authenticated,service_role;`).join('\\n');
fs.writeFileSync(dir+'/new-function-revokes.sql',literalRevokes);sql('set role postgres;'+literalRevokes);
const definitionChanges=installedFunctions.filter(x=>beforeSignatures.has(x.signature)&&x.definition!==state.baselineFunctions.find(y=>y.signature===x.signature).definition).map(x=>x.signature);
assert.deepEqual(installedFunctions.filter(x=>beforeSignatures.has(x.signature)).map(x=>({signature:x.signature,owner:x.owner,acl:x.acl})),state.baselineFunctions.map(x=>({signature:x.signature,owner:x.owner,acl:x.acl})));
fs.writeFileSync(dir+'/catalog-comparison.json',JSON.stringify({baselineFunctions:state.baselineFunctions.length,newFunctions:newFunctions.length,definitionChanges,existingOwnersAndACLsUnchanged:true},null,2));
""".replace('CATALOG',json.dumps(catalog))
  assert at in s;s=s.replace(at,at+insert)
  at=" const d=surface(actor,'director');"
  insert="""
 const expected={authenticated:new Set(['public.get_native_mixed_bootstrap_session_v1(uuid, uuid, text, boolean)','public.get_native_mixed_own_consent_offer_v1(uuid, uuid)','public.execute_native_mixed_own_consent_v1(uuid, uuid, jsonb, boolean)']),service_role:new Set(['public.get_native_mixed_bootstrap_offer_v1(uuid, uuid, uuid, uuid, text)','public.execute_native_mixed_bootstrap_v1(uuid, uuid, uuid, uuid, text, jsonb, boolean)']),anon:new Set()};
 const privileges=read(`select jsonb_agg(jsonb_build_object('signature',n.nspname||'.'||p.proname||'('||oidvectortypes(p.proargtypes)||')','authenticated',has_function_privilege('authenticated',p.oid,'execute'),'service_role',has_function_privilege('service_role',p.oid,'execute'),'anon',has_function_privilege('anon',p.oid,'execute')))from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('app','public');`);
 for(const row of privileges.filter(x=>!beforeSignatures.has(x.signature)))for(const role of Object.keys(expected))assert.equal(row[role],expected[role].has(row.signature),role+' unexpected function access '+row.signature);
 fs.writeFileSync(dir+'/least-privilege.json',JSON.stringify({newFunctions:newFunctions.length,allowedAuthenticated:[...expected.authenticated],allowedService:[...expected.service_role],anonymous:[],allOtherNewFunctionAccessDenied:true},null,2));checks.push('only three own-authenticated and two scoped service bootstrap functions executable; all other new functions closed');
 for(const[who,mode]of[[flow.seed18[0].profile,'director'],[flow.seed18[0].profile,'paper-review'],[checker,'director']]){const denied=surface(who,mode),r=await denied.call('sourceGET');assert.equal(r.status,403);assert.equal(denied.admins,0);}checks.push('real SQL lease rejects wrong roles before privileged client creation');
"""
  assert at in s;s=s.replace(at,insert+at)
 Path('tests/'+new+'-acceptance-local-'+part+'.mjs').write_text(s,encoding='utf8')
s=Path('tests/helpers/'+old+'-acceptance-db.mjs').read_text(encoding='utf8').replace(old,new).replace('fixture_native_mixed_bootstrap_min3','fixture_native_mixed_bootstrap_closure53');Path('tests/helpers/'+new+'-acceptance-db.mjs').write_text(s,encoding='utf8')
(d/'cut-proposals.json').write_text(json.dumps({'cut':cut,'retainedProposalCount':53,'purpose':'preparation only; accounting exclusions preserved'},indent=2),encoding='utf8')
print('Prepared 53-source local candidate; four support readers/reservation omitted, new function access closed before explicit five grants')
