import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {renderGamePage as render,tournament,event} from './helpers/manual-paper-status-runtime-ports.mjs';
function normalReact(pattern){if(!process.execArgv.some(x=>x==='--conditions=react-server'))return false;const r=spawnSync(process.execPath,['--experimental-strip-types','--test','--test-name-pattern',pattern,fileURLToPath(import.meta.url)],{encoding:'utf8',env:process.env});assert.equal(r.status,0,r.stdout+r.stderr);return true;}
test('actual GamePage paper-review branch never asserts agreement and preserves tentative review/navigation',async()=>{
 if(normalReact('^actual GamePage paper-review'))return;const html=await render('awaiting_paper_review');assert.doesNotMatch(html,/The opponent agreed on this device/);assert.match(html,/Awaiting Paper-Card Cross-Check/);assert.match(html,/still tentative/);assert.match(html,/cannot count toward qualification or prizes/);assert.match(html,/original paper card and required independent review/);assert.match(html,new RegExp(`/tournament/${tournament}/games`));assert.match(html,/Open My Games to Continue/);assert.doesNotMatch(html,/Live entry port|Game Complete/);
});
test('actual neighboring GamePage states retain completed scorecard navigation and active entry',async()=>{
 if(normalReact('^actual neighboring GamePage'))return;assert.match(await render('completed'),new RegExp(`/tournament/${tournament}/scorecard\\?event=${event}`));assert.match(await render('current'),/Live entry port/);assert.match(await render('upcoming'),/Upcoming Game/);assert.match(await render('not_started'),/Event Not Started/);
});
