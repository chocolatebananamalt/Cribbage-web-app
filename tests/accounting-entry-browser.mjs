// TEST ONLY local routing rehearsal. No credentials, hosted requests or business writes.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {accountingEntryForSchedule} from '../src/lib/api/accounting-entry.ts';
import {membership,tid,eid,id} from './fixtures/no-q-accounting-v7-workspace.mjs';
import {qSide,sideOnly,makePendingSideReviewFixture} from './fixtures/prize-accounting-v9-workspace.mjs';
import {makePrizeAccountingV8Fixture} from './fixtures/prize-accounting-v8-workspace.mjs';
const schedule={tournamentId:tid,clientRowId:id(71),currentVersion:1,activated:true,eventId:eid,settingsCurrent:true,versions:[{scheduleId:qSide.regularRule.scheduleVersionId,version:1,recordedAt:'2026-10-30T00:00:00Z',reason:'TEST ONLY route',schedule:qSide.regularRule.rule}]};
const noSide={...makePrizeAccountingV8Fixture({fresh:true}).workspace,sideReviews:[],blockers:['unsupported_side_scope']};noSide.facts={...noSide.facts,sideIncomeMinor:0};
const cases=[['combined',qSide,[schedule],'prize-accounting-v9'],['side-only',sideOnly,[schedule],'prize-accounting-v9'],['pending',makePendingSideReviewFixture(),[schedule],'prize-accounting-v9'],['no-side',noSide,[schedule],'prize-accounting-v8'],['historical',null,[],'no-q-accounting-v7'],['stale',qSide,[{...schedule,settingsCurrent:false}],null],['failed',null,[schedule],null]];
const server=createServer((req,res)=>{const row=cases.find(c=>'/'+c[0]===req.url);if(!row){res.writeHead(404).end();return;}const route=accountingEntryForSchedule(membership,row[2],tid,eid,row[1]);res.setHeader('Content-Type','text/html');res.end(`<meta name="viewport" content="width=device-width"><h1>TEST ONLY ${row[0]}</h1>${route?`<a href="/tournament/${tid}/events/${eid}/${route}">Unpaid accounting</a>`:'<p>Accounting route unavailable</p>'}`);});
let browser;const checks=[];
try{server.listen(0,'127.0.0.1');await once(server,'listening');const origin=`http://127.0.0.1:${server.address().port}`;browser=await chromium.launch({channel:'chrome',headless:true});for(const width of[390,1440]){const page=await browser.newPage({viewport:{width,height:900}});for(const [name,,,expected]of cases){await page.goto(origin+'/'+name);if(expected)assert.equal(await page.getByRole('link',{name:'Unpaid accounting'}).getAttribute('href'),`/tournament/${tid}/events/${eid}/${expected}`);else{assert.equal(await page.getByRole('link').count(),0);await page.getByText('Accounting route unavailable').waitFor();}assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);checks.push({width,name,expected,passed:true});}await page.close();}await mkdir('test-results',{recursive:true});await writeFile('test-results/accounting-navigation-browser.json',JSON.stringify({kind:'local synthetic selector/link rehearsal; not hosted acceptance',checks},null,2));console.log(`${checks.length} phone/desktop navigation checks passed`);}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
