import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {directOriginBeforeClient,directBoundedBodyReader,directPrivateResponseBoundary,directPrivateUnavailableBoundary} from './helpers/direct-route-contracts.mjs';
import {assertFictionalGateSource} from './helpers/fictional-feature-target.mjs';

const route = fs.readFileSync('src/app/api/v1/games/[id]/manual-mixed-adjudication/route.ts','utf8');
test('direct response audit follows actual cache headers on every Response branch',()=>{
  assert.equal(directPrivateResponseBoundary(route),true);
  assert.equal(directPrivateResponseBoundary(route.replace('private, no-store','public, max-age=60')),false);
  assert.equal(directPrivateResponseBoundary(route.replace("{status:404,headers}","{status:404}")),false);
  assert.equal(directPrivateResponseBoundary('// private, no-store Response.json headers'),false);
});
test('direct private failure audit requires a real unavailable catch and every response boundary',()=>{
  assert.equal(directPrivateUnavailableBoundary(route),true);
  assert.equal(directPrivateUnavailableBoundary(route.replace("status:503,headers","status:503")),false);
  assert.equal(directPrivateUnavailableBoundary(route.replace("temporarily_unavailable","sensitive_database_detail")),false);
});
test('origin audit follows actual calls independent of parameter spelling',()=>{
  assert.equal(directOriginBeforeClient(route),true);
  assert.equal(directOriginBeforeClient(route.replaceAll('request','r')),true);
  assert.equal(directOriginBeforeClient(route.replace('isSameOriginRequest(request)','true')),false);
  assert.equal(directOriginBeforeClient('// isSameOriginRequest(request)\n'+route.replace('isSameOriginRequest(request)','true')),false);
});
test('gate source audit follows only the imported fictional target binding',()=>{
  const source=fs.readFileSync('src/lib/finance/modern-prize-journal-gates-v2.ts','utf8');
  assertFictionalGateSource(source,'modernPrizeWritesVerifiedV2');
  assert.throws(()=>assertFictionalGateSource(source.replaceAll('()=>integratedTestFeatureEnabled()','()=>true'),'modernPrizeWritesVerifiedV2'));
  assert.throws(()=>assertFictionalGateSource(source.replace("from '../integrated-test-target.ts'","from '../unreviewed-target.ts'"),'modernPrizeWritesVerifiedV2'));
});
test('origin result must reject before clients rather than being an ignored decoy',()=>{
  const prefix="import {isSameOriginRequest} from '../api/same-origin';\n";
  assert.equal(directOriginBeforeClient(prefix+'export async function POST(request){isSameOriginRequest(request);return createClient();}'),false);
  assert.equal(directOriginBeforeClient(prefix+'export async function POST(request){if(!isSameOriginRequest(request)){Response.json({error:"no"});}return createClient();}'),false);
  assert.equal(directOriginBeforeClient(prefix+'export async function POST(request){if(optional){if(!isSameOriginRequest(request))return null;}return createClient();}'),false);
  assert.equal(directOriginBeforeClient(prefix+'export async function POST(request){if(!isSameOriginRequest(request))return null;return createClient();}'),true);
});
test('bounded reader must consume the reachable POST request, not a decoy GET or different value',()=>{
  const prefix="import {readSmallJson} from '../api/bounded-json';\n";
  assert.equal(directBoundedBodyReader(prefix+'export async function GET(request){return readSmallJson(request);}export async function POST(request){return null;}'),false);
  assert.equal(directBoundedBodyReader(prefix+'export async function POST(request){return readSmallJson(unrelated);}'),false);
  assert.equal(directBoundedBodyReader(prefix+'async function unused(request){return readSmallJson(request);}export async function POST(request){return null;}'),false);
  assert.equal(directBoundedBodyReader(prefix+'async function run(r){return readSmallJson(r);}export async function POST(request){return run(request);}'),true);
});
