import fs from 'node:fs';import vm from 'node:vm';import {createRequire} from 'node:module';import ts from 'typescript';import {componentSourceV28} from './paper-pairing-page-v28.mjs';
const require=createRequire(import.meta.url);
function compile(file,load){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module:m,exports:m.exports,require:load,structuredClone,Date,console});return m.exports;}
export function unresolvedPageFixtureV31({enabled=false,access,client,admin,now=Date.now}){const calls={access:0,client:0,admin:0},readFile=new URL('../../src/lib/operations/director-unresolved-read-v31.ts',import.meta.url),read=compile(readFile,n=>n==='server-only'?{}:require(new URL(n,readFile).pathname.replace(/^\/([A-Z]:)/,'$1'))),view=componentSourceV28(new URL('../../src/components/director-unresolved-games-v31.tsx',import.meta.url));
 const page=compile(new URL('../../src/app/tournament/[tournamentId]/unresolved-games/page.tsx',import.meta.url),n=>{
  if(n==='next/navigation')return{notFound:()=>{throw Error('fixture_not_found')}};
  if(n==='next/link')return{__esModule:true,default:({href,children})=>require('react').createElement('a',{href},children)};
  if(n.endsWith('/api/validation'))return require('../../src/lib/api/validation.ts');
  if(n.endsWith('/auth/require-tournament-access'))return{requireTournamentAccess:async()=>{calls.access++;return access}};
  if(n.endsWith('/supabase/server'))return{createClient:async()=>{calls.client++;return client}};
  if(n.endsWith('/supabase/private-admin'))return{createServerOnlyAdminClient:()=>{calls.admin++;return admin}};
  if(n.endsWith('/operations/director-unresolved-games-v31'))return{directorUnresolvedGamesEnabledV31:()=>enabled};
  if(n.endsWith('/operations/director-unresolved-read-v31'))return{readDirectorUnresolvedQueueV31:d=>read.readDirectorUnresolvedQueueV31({...d,enabled:()=>enabled,now})};
  if(n.endsWith('/components/director-unresolved-games-v31'))return view;
  return require(n);
 });return{page:page.default,calls};
}
