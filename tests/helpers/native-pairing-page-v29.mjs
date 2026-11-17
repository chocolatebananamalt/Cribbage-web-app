import fs from 'node:fs';import vm from 'node:vm';import {createRequire} from 'node:module';import ts from 'typescript';
import {componentSourceV28} from './paper-pairing-page-v28.mjs';
const require=createRequire(import.meta.url);
function compile(file,load){const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module:mod,exports:mod.exports,require:load,structuredClone,Date,console});return mod.exports;}
function providerModule(){const file=new URL('../../src/lib/api/native-mixed-simulation-provider-v1.ts',import.meta.url),local=createRequire(file),mod={exports:{}},js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInThisContext('(function(exports,require,module){'+js+'\n})')(mod.exports,n=>n==='server-only'?{}:local(n),mod);return mod.exports;}
export function nativePageFixtureV29({enabled=false,access,client,admin}){
 const readerUrl=new URL('../../src/lib/events/native-paper-pairing-read-v29.ts',import.meta.url),read=compile(readerUrl,n=>n==='server-only'?{}:n.endsWith('/native-mixed-simulation-provider-v1.ts')?providerModule():require(new URL(n,readerUrl).pathname.replace(/^\/([A-Z]:)/,'$1'))),calls={access:0,admins:0,clients:0};
 const view=componentSourceV28(new URL('../../src/components/paper-pairing-packet-v28.tsx',import.meta.url));
 const page=compile(new URL('../../src/app/tournament/[tournamentId]/rehearsal-prepare/[eventId]/print/page.tsx',import.meta.url),n=>{
  if(n==='next/navigation')return{notFound:()=>{throw Error('fixture_not_found')}};
  if(n==='next/link')return{__esModule:true,default:({href,children})=>require('react').createElement('a',{href},children)};
  if(n.endsWith('/api/validation'))return require('../../src/lib/api/validation.ts');
  if(n.endsWith('/auth/require-tournament-access'))return{requireTournamentAccess:async()=>{calls.access++;return access}};
  if(n.endsWith('/supabase/server'))return{createClient:async()=>{calls.clients++;return client}};
  if(n.endsWith('/supabase/private-admin'))return{createServerOnlyAdminClient:()=>{calls.admins++;return admin}};
  if(n.endsWith('/integrated-test-target'))return require('../../src/lib/integrated-test-target.ts');
  if(n.endsWith('/events/native-paper-pairing-read-v29'))return{nativePaperPairingEnabledV29:()=>enabled,readNativePaperPairingV29:d=>read.readNativePaperPairingV29({...d,enabled:()=>enabled})};
  if(n.endsWith('/components/paper-pairing-packet-v28'))return view;
  return require(n);
 });
 return{page:page.default,calls,view:view.PaperPairingPacketV28};
}
