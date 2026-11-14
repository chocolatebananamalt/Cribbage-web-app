import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {isolatedApplicationTestEnvironment} from './helpers/isolated-application-test-environment.mjs';

test('unit subprocess environment removes only deployment target and provider secret bindings',()=>{
  const source={PATH:'preserved-path',Path:'preserved-Windows-path',NODE_ENV:'test',NODE_OPTIONS:'preserved-options',CI:'true',UNRELATED_SETTING:'preserved',
    SUPABASE_URL:'fixture-value',SUPABASE_SECRET_KEY:'fixture-value',Supabase_Access_Token:'fixture-value',NEXT_PUBLIC_SUPABASE_URL:'fixture-value',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'fixture-value',NEXT_PUBLIC_CRIBBAGE_TEST_APP:'fictional',CRIBBAGE_TEST_APP_BRANCH:'fixture-value',CRIBBAGE_FICTIONAL_DRAW_BOUNDARY:'1',VERCEL_ENV:'production',Vercel_Git_Commit_Ref:'fixture-value',EVENT_PRIZE_SETUP_TEST_PROJECT_ENABLED_V1:'true',EVENT_PRIZE_SETUP_PRODUCTION_PROJECT_ENABLED_V1:'true'};
  const before={...source},isolated=isolatedApplicationTestEnvironment(source);
  assert.deepEqual(isolated,{PATH:'preserved-path',Path:'preserved-Windows-path',NODE_ENV:'test',NODE_OPTIONS:'preserved-options',CI:'true',UNRELATED_SETTING:'preserved'});
  assert.deepEqual(source,before,'the build/deployment parent environment is unchanged');
});

test('isolated subprocess is default closed but explicit fictional fixtures still enable real target gates',()=>{
  const inherited={...process.env,NEXT_PUBLIC_CRIBBAGE_TEST_APP:'fictional',NEXT_PUBLIC_SUPABASE_URL:'https://fictional-test.supabase.co',NEXT_PUBLIC_CRIBBAGE_TEST_BACKEND_URL:'https://fictional-test.supabase.co',SUPABASE_SECRET_KEY:'fixture-value',VERCEL_ENV:'production',EVENT_PRIZE_SETUP_TEST_PROJECT_ENABLED_V1:'true'};
  const script=`import assert from 'node:assert/strict';import {integratedTestUiEnabled} from './src/lib/integrated-test-target.ts';
    assert.equal(integratedTestUiEnabled(),false);assert.equal(process.env.SUPABASE_SECRET_KEY,undefined);assert.equal(process.env.VERCEL_ENV,undefined);
    Object.assign(process.env,{NEXT_PUBLIC_CRIBBAGE_TEST_APP:'fictional',NEXT_PUBLIC_SUPABASE_URL:'https://localhost:54321',NEXT_PUBLIC_CRIBBAGE_TEST_BACKEND_URL:'https://localhost:54321',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'fixture-public',SUPABASE_SECRET_KEY:'sb_secret_fixture'});
    assert.equal(integratedTestUiEnabled(),true);process.env.VERCEL_ENV='production';assert.equal(integratedTestUiEnabled(),false);
    console.log('default-closed; explicit-fictional-enabled; production-denied');`;
  const child=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',script],{cwd:process.cwd(),env:isolatedApplicationTestEnvironment(inherited),encoding:'utf8',windowsHide:true});
  assert.equal(child.status,0,child.stderr);assert.equal(child.stdout.trim(),'default-closed; explicit-fictional-enabled; production-denied');
});
