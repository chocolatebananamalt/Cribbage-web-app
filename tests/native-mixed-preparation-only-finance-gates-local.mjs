// Read-only probe of the already approved active disposable fixture.
import fs from'node:fs';import assert from'node:assert/strict';
import{dir,read}from'./helpers/native-mixed-bootstrap-min3-acceptance-db.mjs';
const names=['native_playoff_final_awards_enabled_v1','operational_event_finance_proposals_enabled_v1','native_optional_final_awards_enabled_v2','native_optional_finance_proposals_enabled_v2','native_optional_finance_provider_enabled_v2','native_optional_finance_source_adoption_enabled_v2','native_optional_finance_source_enabled_v2','native_optional_income_enabled_v2','native_optional_pool_ownership_enabled_v2','native_optional_recorded_fund_enabled_v2'];
const installed=read('select coalesce(jsonb_agg(n order by n),\'[]\')from unnest(array['+names.map(n=>`'${n}'`).join(',')+']::text[])n where to_regprocedure(\'app.\'||n||\'()\')is not null;');
assert.deepEqual(names.filter(n=>!installed.includes(n)),['native_optional_finance_provider_enabled_v2']);
const flags=read('select jsonb_build_object('+installed.map(n=>`'${n}',app.${n}()`).join(',')+');');assert.deepEqual(flags,Object.fromEntries(installed.map(n=>[n,false])));
fs.writeFileSync(dir+'/finance-gates.json',JSON.stringify({observedAt:new Date().toISOString(),flags,providerNotInstalled:true,readOnly:true,hosted:false},null,2));console.log('PASS nine Finance/award gates disabled; broader Finance provider gate absent');
