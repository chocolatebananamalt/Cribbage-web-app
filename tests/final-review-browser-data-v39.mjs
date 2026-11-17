// Actual route control flow; Auth/RPC and interactive controls are synthetic ports.
import fs from 'node:fs';import path from 'node:path';
import {regularPrizeV3WiringFixture as fixture} from './helpers/regular-prize-v3-wiring-fixture.mjs';
const cases=[];
for(const kind of ['main','consolation']){
 const f=fixture(kind);f.state.gate=false;f.state.finalReviewGate=true;
 function serial(n){if(Array.isArray(n))return n.map(serial);if(!n||typeof n!=='object')return n;const props={...n.props,children:serial(n.props?.children)};if(typeof n.type==='string')return{type:n.type,props};if(typeof n.props?.href==='string')return{type:'a',props};if(n.props?.scope)return{type:'p',props:{children:'Interactive review controls are outside this navigation fixture.'}};if(n.type===undefined)return{type:'fragment',props};return null;}
 cases.push({kind,tournamentId:f.state.tournamentId,eventId:f.state.eventId,results:serial(await f.page()),pool:serial(await f.poolPage()),final:serial(await f.finalPage()),calls:f.state.calls});
}
fs.mkdirSync('../browser-v39',{recursive:true});fs.writeFileSync(path.resolve('../browser-v39/data.json'),JSON.stringify(cases));
