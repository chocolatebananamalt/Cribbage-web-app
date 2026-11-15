import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';
import{selectedStepPlayerScoringClonesV3 as specs}from'./helpers/selected-step-player-scoring-clones-v3.mjs';
import{selectedStepFinalClonesV3,applySelectedStepCloneV3 as apply}from'./helpers/selected-step-final-clones-v3.mjs';
const read=n=>fs.readFileSync('database/proposals/'+n+'.sql','utf8').replaceAll('\r\n','\n');
const sql=read('selected-step-player-scoring-v3');
function base(file,name){const text=read(file),at=text.search(new RegExp('create (?:or replace )?function '+name.replaceAll('.','\\.')+'\\(')),m=text.slice(at).match(/as (\$[a-z_]*\$)/i);assert(at>=0&&m,name);const begin=at+m.index+m[0].length,end=text.indexOf(m[1]+';',begin);assert(end>begin);return text.slice(begin,end);}
function original(spec){
 const name=spec.signature.split('(')[0];
 if(name.includes('selected_step_pool_'))return base('selected-step-pool-ownership-v3',name);
 if(name==='app.selected_step_series_current_result_v3')return apply(base('playoff-series-matches-v1','app.playoff_series_current_result_v1'),selectedStepFinalClonesV3[1]);
 if(name==='app.selected_step_series_match_source_v3'){
  let body=base('playoff-series-matches-v1','app.playoff_series_match_source_v1');const large=read('playoff-series-large-fields-v2'),block=large.slice(large.indexOf('do $patch$'),large.indexOf('end$patch$;'));
  for(const m of block.matchAll(/old:='((?:''|[^'])*)';new:='((?:''|[^'])*)';/g)){const old=m[1].replaceAll("''","'"),replacement=m[2].replaceAll("''","'");assert.equal(body.split(old).length-1,1);body=body.replace(old,()=>replacement);}
  return apply(body,selectedStepFinalClonesV3[0]);
 }
 return base('playoff-series-games-v1',name);
}
test('exact scoring seams match actual pin/gate, current large-field source and independent game protocol',()=>{
 const arrays=[...sql.matchAll(/jsonb_array_elements\('((?:''|[^'])*)'::jsonb\)/g)].map(m=>JSON.parse(m[1].replaceAll("''","'")));
 assert.equal(arrays.length,specs.length);for(const[i,spec]of specs.entries()){assert.deepEqual(arrays[i],spec.patches);assert.notEqual(apply(original(spec),spec),original(spec));assert.throws(()=>apply('changed source',spec));}
});
test('normal session and actual generation identity are rechecked before retry and scoring; no service impersonation',()=>{
 for(const s of ['auth.uid()','auth.jwt()',"j->>'role'is distinct from'authenticated'",'auth.users','auth.sessions','user_id=actor',"p.status='checked_in'","r.scorecard_type='digital'",'rosterLinks','preferences','selected-step-series-generation-v3','source is null','modern_generation_source_changed'])assert(sql.includes(s),s);
 assert(!/set_config|grant execute|disable trigger/i.test(sql));
 const spec=specs.find(s=>s.name==='app.submit_selected_step_player_action_v3'),body=apply(original(spec),spec);
 assert(body.indexOf('selected_step_player_generation_access_v3')<body.indexOf('select * into prior'));assert(body.includes("src is null or src->>'status'is distinct from'source_available'"));
 const recovery=specs.at(-1),r=apply(original(recovery),recovery);assert(r.includes('actor_id=a'));assert(r.includes('selected_step_player_generation_access_v3(o.tournament_id'));
});
test('actual original independent submissions, own confirmations, ordering and final evidence writers survive unchanged',()=>{
 const spec=specs.find(s=>s.name==='app.submit_selected_step_player_action_v3'),body=apply(original(spec),spec);
 for(const s of ['latest_own_submission_required','stale_game_version','parentResultPins','g.source_capture is distinct from src',
  'sa','sb','ca','cb','playoff_series_verified_games_v1','insert into app.playoff_series_results_v1','game_sequence_closed','idempotency_conflict','playoff_series_game_actor_valid_v1'])assert(body.includes(s),s);
 assert(read('playoff-series-games-v1').includes('create constraint trigger playoff_series_results_game_evidence_v1'));
 assert(!body.includes('app.playoff_series_match_source_v1('));assert(!body.includes('app.event_settings_playoff_source_v1('));
 assert(body.includes('app.selected_step_player_match_source_v3('));
 const pin=apply(original(specs[0]),specs[0]);assert(pin.includes("profile_id=actor and role='director'"));assert(pin.includes('app.event_prize_activation_current_v1(tid,actor)'));
});
test('only redacted own-player view is suitable for a future route; unfinished opponent answers and private proof excluded',()=>{
 const view=sql.slice(sql.indexOf('create function app.get_selected_step_player_view_v3'),sql.indexOf('do $functions$'));
 const result=view.slice(view.indexOf("return jsonb_build_object('status','player_game_available'"));
 for(const s of ['actorParticipantId','players','ownSubmission','ownConfirmed','opponentSubmitted','paperVerificationClaimed'])assert(result.includes(s),s);
 assert(view.includes("'tournamentPlayerId',seat.verification_id"));
 for(const s of ['source_capture','profiles','profileId','sourceCapture','sessionId','opponentWinner','opponentSubmission','actionHistory','auth.jwt()'])assert(!result.includes(s),s);
 assert(view.includes('s.actor_profile_id=actor'));assert(view.includes('paperVerificationClaimed\',false'));assert(sql.includes('from public,anon,authenticated,service_role'));
});
