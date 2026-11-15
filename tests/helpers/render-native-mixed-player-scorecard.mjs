// Node-only React SSR, no browser/navigation/HTTP/database or provider.
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {createRequire} from 'node:module';
import {nativeMixedDigitalScreenExample as example} from './native-mixed-digital-screen-example.mjs';
import {projectNativeMixedPlayerCardV1 as project} from '../../src/lib/seating/native-mixed-player-scorecard-v1.ts';
import {screenId as id} from './native-mixed-digital-screen-example.mjs';
const req=createRequire(path.resolve('package.json')),ts=req('typescript'),React=req('react'),{renderToStaticMarkup}=req('react-dom/server'),cache=new Map();
function load(file){
 file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);
 const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;
 const local=name=>{if(name.endsWith('.css'))return{};if(!name.startsWith('.'))return req(name);const base=path.resolve(path.dirname(file),name),resolved=[base,base+'.ts',base+'.tsx'].find(f=>fs.existsSync(f)&&fs.statSync(f).isFile());return load(resolved);};
 vm.runInThisContext('(function(require,module,exports){'+source+'\n})',{filename:file})(local,m,m.exports);return m.exports;
}
const {NativeMixedPlayerScorecardV1:Screen}=load('src/components/native-mixed-player-scorecard-v1.tsx');
const xs=Array.from({length:12},(_,i)=>{const x=example();x.binding.gameNumber=i+1;x.binding.target.gameId=id(1000+i);x.state.gameId=x.binding.target.gameId;x.binding.opponent.participantId=id(2000+i);x.binding.opponent.profileId=id(3000+i);x.binding.opponent.fixedTournamentId='T-'+i;x.submit();x.submit(x.binding.opponent);x.confirm();x.confirm(x.binding.opponent);return x;});
const card=project(xs.map(x=>x.binding),xs.map(x=>x.state));assert(card);
const markup=renderToStaticMarkup(React.createElement(Screen,{enabled:true,card}));
for(const text of ['Practice Only','12 of 12 games complete','Tournament ID#','Net Spread','+480','not official results'])assert(markup.includes(text),text);
assert.equal((markup.match(/<tbody>[\s\S]*?<\/tbody>/)||[''])[0].match(/<tr/g).length,12);assert.equal((markup.match(/colSpan="2"/g)||[]).length>=2,true);assert(!markup.includes('games verified'));
assert(renderToStaticMarkup(React.createElement(Screen,{card})).includes('unavailable'));
export const scorecardCases={complete:card};
const bindings=xs.map(x=>x.binding),states=xs.map(x=>x.state);
for(const status of['unavailable','pending','mismatch','upcoming']){const changed=structuredClone(states);
 if(status==='unavailable')changed[0]=null;
 else{changed[0].entries=changed[0].entries.slice(0,status==='mismatch'?2:3);changed[0].revision=changed[0].entries.length;changed[0].playOrder='current';if(status==='mismatch')changed[0].entries[1].result.winnerSide='a';if(status==='upcoming'){changed[1].entries=[];changed[1].revision=0;changed[1].evidenceVisibility='metadata-only';changed[1].playOrder='upcoming';}}
 const current=project(bindings,changed);assert(current,status);scorecardCases[status]=current;const html=renderToStaticMarkup(React.createElement(Screen,{enabled:true,card:current})),label={unavailable:'Evidence Unavailable - Not Counted',pending:'Not Complete - Not Counted',mismatch:'Entries Disagree - Not Counted',upcoming:'Upcoming - Not Counted'}[status];assert(html.includes('<span class="player-card-row-state">'+label+'</span>'),status);assert(html.includes('are not counted in totals'));assert(html.includes('aria-label="Games Not Counted Yet"'));assert(html.includes('Game 1: '));assert.equal(current.officialResultVerified,false);assert(current.completedGames<12);assert(current.totals.gamePoints<36);}
for(const status of['pending','mismatch','upcoming']){
 const current=scorecardCases[status],row=current.rows.find(r=>r.gameId===current.currentGameId);assert(row);
 const href=`/tournament/example/rehearsal/event/start/${row.gameId}`,html=renderToStaticMarkup(React.createElement(Screen,{enabled:true,card:current,currentGameHref:href}));
 assert(html.includes('aria-label="Current Practice Game"'));assert(html.includes(`Current Practice Game ${row.gameNumber}`));assert(html.includes(`Opponent: ${row.opponentName}`));assert(html.includes(`<strong>${row.opponentTournamentId}</strong>`));
 assert(html.includes(`Your Chair: <strong>${row.currentSeat}</strong>`));assert(html.includes(`Opponent Chair: <strong>${row.opponentCurrentSeat}</strong>`));
 assert(html.includes(`href="${href}"`));assert(html.indexOf('Open Current Practice Game')<html.indexOf('<table'));
 assert(!html.includes(`Current Practice Game 2`),'upcoming opponent is not offered as current');
}
for(const card of[scorecardCases.complete,scorecardCases.unavailable]){const html=renderToStaticMarkup(React.createElement(Screen,{enabled:true,card,currentGameHref:'/must-not-appear'}));assert(!html.includes('aria-label="Current Practice Game"'));assert(!html.includes('/must-not-appear'));}
assert(!renderToStaticMarkup(React.createElement(Screen,{card:scorecardCases.pending,currentGameHref:'/must-not-appear'})).includes('/must-not-appear'));
console.log('practice scorecard SSR passed: visible pending/mismatch/unavailable/upcoming states remain excluded; only authoritative current opponent/action shown above table');

export const renderScorecard = card => renderToStaticMarkup(React.createElement(Screen,{enabled:true,card,currentGameHref:'/fictional-current-game'}));
