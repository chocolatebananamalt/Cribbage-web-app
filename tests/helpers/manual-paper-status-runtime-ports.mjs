import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';
export const appRoot=path.resolve(process.env.MANUAL_STATUS_APP_ROOT??process.cwd());
export const requireApp=createRequire(path.join(appRoot,'package.json'));
export const ts=requireApp('typescript');
export const loadActual=(relative,deps,globals={})=>{const exports={};const source=fs.readFileSync(path.isAbsolute(relative)?relative:path.join(appRoot,relative),'utf8');vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:name=>{if(name in deps)return deps[name];throw Error('Unexpected dependency '+name);},Response,Request,TextDecoder,Uint8Array,...globals});return exports;};
export const actual=relative=>import(pathToFileURL(path.join(appRoot,relative)).href);
export const id=n=>`a1110000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const actor=id(1),game=id(2),submission=id(3),operation=id(4),tournament=id(5),event=id(6),session=id(7),foreign=id(8);
export const handoff=decision=>({kind:'manual-mixed-handoff-v1',actorId:actor,gameId:game,gameVersion:2,submission:{id:submission,winnerSide:'a',margin:15},paperPlayer:{displayName:'Fictional Paper',side:'b',tableSeat:'A-2',verificationId:'A-2'},digitalPlayer:{displayName:'Fictional Digital',side:'a',tableSeat:'A-1',verificationId:'A-1'},response:decision?{operationId:operation,decision,recordedAt:'2026-11-15T00:00:00Z'}:null,canRespond:!decision,tentative:true,verified:false});

const pagePath=process.env.MANUAL_STATUS_PAGE_SOURCE??path.join(appRoot,'src/app/tournament/[tournamentId]/game/[gameId]/page.tsx');
export async function renderGamePage(status){
 const React=requireApp('react'),{renderToStaticMarkup}=requireApp('react-dom/server');
 const context={actorId:actor,gameId:game,eventId:event,eventName:'Main',roundNumber:1,progressionStatus:status,cardNumbers:null,player:{displayName:'Fictional Digital',side:'a',verificationId:'A-1'},opponent:{displayName:'Fictional Paper',side:'b',verificationId:'A-2'}};
 const deps={'next/navigation':{notFound:()=>{throw Error('not_found');}},react:{cache:fn=>fn},'react/jsx-runtime':requireApp('react/jsx-runtime'),'../../../../../lib/auth/require-tournament-access':{requireTournamentAccess:async()=>({user:{id:actor}})},'../../../../../lib/games/assigned-game-context':{getAssignedGameContext:async()=>({status:'available',context})},'../../../../../lib/api/validation':{isUuid:()=>true},'./score-entry':{LiveScoreEntry:()=>React.createElement('p',null,'Live entry port')},'next/link':{__esModule:true,default:({href,children})=>React.createElement('a',{href},children)},'../../../../../components/player-page-frame':{PlayerPageFrame:({children})=>React.createElement('main',null,children)},'../../../../../lib/games/my-games':{getMyGames:async()=>({status:'available',workspace:{tournamentName:'Fictional Tournament',games:[]}})},'../../../../../components/makeup-card-lines':{MakeupCardLines:()=>null},'../../../../../lib/offline-score-page-binding':{assignedOfflinePageMetadata:()=>({})}};
 const page=loadActual(pagePath,deps);return renderToStaticMarkup(await page.default({params:Promise.resolve({tournamentId:tournament,gameId:game})}));
}
