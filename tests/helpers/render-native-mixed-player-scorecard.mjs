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
console.log('practice scorecard SSR passed');
