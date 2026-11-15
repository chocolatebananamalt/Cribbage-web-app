import test from 'node:test';import assert from 'node:assert/strict';
import {isSeriesFormatV1,resolveSeriesFormatDraftV1,assessEventSeriesSettingsV1,playoffSeriesPresetsV1}from'../src/lib/playoffs/series-settings-v1.ts';
import {playoffSeriesProgressV1}from'../src/lib/playoffs/series-progress-v1.ts';
const f=wins=>({winsRequired:wins,maximumGames:2*wins-1}),settings=(regular=3,final=3)=>({version:'event-playoff-series-v1',regular:f(regular),final:f(final)});
const context=(more={})=>({sanctioned:true,eventKind:'main',durationDays:2,originalEntrants:100,...more});
test('presets and custom first-to series are feasible without inventing an ACC custom permission',()=>{
 assert.deepEqual(playoffSeriesPresetsV1.map(p=>[p.winsRequired,p.maximumGames]),[[2,3],[3,5],[4,7]]);
 for(const n of[1,2,3,4,5,100])assert.ok(isSeriesFormatV1(f(n)));
 for(const bad of[{winsRequired:2,maximumGames:5},{winsRequired:4,maximumGames:5},{winsRequired:0,maximumGames:0},{winsRequired:2.5,maximumGames:4},{winsRequired:'2',maximumGames:3},{...f(2),approval:true}])assert.equal(isSeriesFormatV1(bad),false);
 assert.equal(assessEventSeriesSettingsV1(settings(5,5),context({sanctioned:false})).status,'informal_settings');
 assert.equal(assessEventSeriesSettingsV1(settings(5,5),context()).status,'review_required');
});
test('two-day Main257 threshold governs final only and is not extended to one-day',()=>{
 assert.equal(assessEventSeriesSettingsV1(settings(3,3),context({originalEntrants:256})).status,'known_rules_satisfied');
 assert.equal(assessEventSeriesSettingsV1(settings(3,3),context({originalEntrants:257})).status,'blocked');
 assert.equal(assessEventSeriesSettingsV1(settings(3,4),context({originalEntrants:500})).status,'known_rules_satisfied');
 assert.equal(assessEventSeriesSettingsV1(settings(3,5),context({originalEntrants:500})).status,'blocked');
 assert.equal(assessEventSeriesSettingsV1(settings(3,3),context({durationDays:1,originalEntrants:500})).status,'known_rules_satisfied');
 assert.equal(assessEventSeriesSettingsV1(settings(),context({originalEntrants:null})).status,'review_required');
});
test('one-day shorter Main flags prior RC approval; Consolation and unknown durations stay distinct',()=>{
 const short=assessEventSeriesSettingsV1(settings(2,2),context({durationDays:1}));assert.equal(short.status,'review_required');assert.ok(short.issues.every(i=>i.severity==='rc_approval_required'));assert.equal(short.officialApprovalClaimed,false);
 assert.equal(assessEventSeriesSettingsV1(settings(2,2),context()).status,'blocked');
 assert.equal(assessEventSeriesSettingsV1(settings(2,3),context({eventKind:'consolation'})).status,'known_rules_satisfied');
 assert.equal(assessEventSeriesSettingsV1(settings(2,3),context({eventKind:'consolation',durationDays:1})).status,'review_required');
 assert.equal(assessEventSeriesSettingsV1(settings(1,2),context({eventKind:'consolation'})).status,'blocked');
 assert.equal(assessEventSeriesSettingsV1(settings(),context({durationDays:3})).status,'review_required');
 assert.equal(assessEventSeriesSettingsV1(settings(2,2),context({eventKind:{toString:()=> 'main'}})).status,'invalid');
});
const id=n=>`a0000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function input(winners=[],wins=2,evidence='synthetic-rehearsal'){return{format:f(wins),participants:[id(1),id(2)],evidence,games:winners.map((who,i)=>({gameNumber:i+1,resultId:id(100+i),winnerParticipantId:id(who),verification:'verified',evidence}))};}
test('verified individual winners count to first required wins without authorizing bracket advance',()=>{
 assert.deepEqual(playoffSeriesProgressV1(input()),{status:'in_progress',wins:[0,0],nextGameNumber:1,winnerParticipantId:null,advancingAuthority:false,evidence:'synthetic-rehearsal'});
 const pending=playoffSeriesProgressV1(input([1,2]));assert.equal(pending.status,'in_progress');assert.deepEqual(pending.wins,[1,1]);assert.equal(pending.nextGameNumber,3);
 const done=playoffSeriesProgressV1(input([1,2,1]));assert.equal(done.status,'complete');assert.equal(done.winnerParticipantId,id(1));assert.equal(done.nextGameNumber,null);assert.equal(done.advancingAuthority,false);
 assert.equal(playoffSeriesProgressV1(input([2,2,2],3)).winnerParticipantId,id(2));
});
test('duplicate, unverified, mixed evidence, reordered and post-completion games cannot advance',()=>{
 for(const mutate of[
 i=>i.games[0].verification='pending',i=>i.games[0].evidence='verified-play',i=>i.games[0].winnerParticipantId=id(9),
 i=>i.games[1].resultId=i.games[0].resultId,i=>i.games[0].gameNumber=2,i=>i.participants[1]=i.participants[0],
 ]){const i=input([1,2]);mutate(i);assert.equal(playoffSeriesProgressV1(i).status,'blocked');}
 assert.equal(playoffSeriesProgressV1(input([1,1,2])).status,'blocked');
 assert.equal(playoffSeriesProgressV1(input([1,1,1,1,2,2,2],4)).status,'blocked');
 const coercible=input();coercible.evidence={toString:()=> 'verified-play'};assert.equal(playoffSeriesProgressV1(coercible).status,'blocked');
});

test('series draft parser fails closed for malformed or coercible choices',()=>{for(const v of[null,{}, {choice:{toString:()=> '2-of-3'},winsText:'',gamesText:''},{choice:'custom',winsText:2,gamesText:'3'},{choice:'other',winsText:'2',gamesText:'3'}])assert.equal(resolveSeriesFormatDraftV1(v),null);assert.deepEqual(resolveSeriesFormatDraftV1({choice:'custom',winsText:'5',gamesText:'9'}),{winsRequired:5,maximumGames:9});});
