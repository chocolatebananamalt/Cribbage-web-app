import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
import {scorecardCases,renderScorecard} from './helpers/render-native-mixed-player-scorecard.mjs';
const out='test-results/physical-trial-print-20261110';
const css=fs.readFileSync('src/components/player-page.css','utf8');
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[];
try{
 for(const width of[390,1440])for(const zoom of[1,2]){
  const context=await browser.newContext({offline:true,serviceWorkers:'block',viewport:{width,height:1000}});
  const requests=[];context.on('request',r=>requests.push(r.url()));await context.route('**/*',r=>r.abort());
  try{const page=await context.newPage();const card=structuredClone(scorecardCases.pending),row=card.rows.find(r=>r.gameId===card.currentGameId);row.currentSeat='A-17';row.opponentCurrentSeat='A-18';card.player.fixedTournamentId='A-3';
   await page.setContent(`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>html{font-size:${16*zoom}px}body{margin:0}*{box-sizing:border-box}${css}</style></head><body class="player-page"><main class="player-page-content">${renderScorecard(card)}</main></body></html>`);
   const current=page.getByRole('status',{name:'Current Practice Game'});await current.waitFor();assert((await current.innerText()).includes('Your Chair: A-17'));assert((await current.innerText()).includes('Opponent Chair: A-18'));assert((await page.locator('.player-card-id').innerText()).includes('A-3'));
   const bounds=await current.boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=width+1);assert(await current.getByRole('link',{name:'Open Current Practice Game'}).isVisible());
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page overflow');
   await current.screenshot({path:`${out}/scorecard-current-${width}-${zoom}x.png`});
   assert.equal(requests.length,0);results.push({width,textScale:zoom,currentChair:'A-17',opponentChair:'A-18',fixedTournamentId:'A-3',pageOverflow:false,networkRequests:0});
  }finally{await context.close();}
 }
}finally{await browser.close();}
fs.writeFileSync(`${out}/scorecard-layout-verification.json`,JSON.stringify({passed:true,offlineSsrOnly:true,providerVerified:false,results},null,2));console.log('Four offline scorecard phone/desktop text-scale cases passed.');