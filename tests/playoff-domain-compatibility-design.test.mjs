import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('proposed symmetric playoff domain guard preserves legacy execution grants',()=>{
 const sql=readFileSync('docs/quality/2026-10-27-proposed-event-playoff-domain-guard.sql','utf8');
 assert.match(sql,/standard-singles-post-event:/);
 assert.match(sql,/before insert on app\.standard_singles_playoff_result_versions/);
 assert.match(sql,/before insert on app\.playoff_outcome_versions_v3/);
 assert.match(sql,/v\.tournament_id=new\.tournament_id and v\.event_id=new\.event_id/g);
 assert.match(sql,/set search_path=''/);
 assert.doesNotMatch(sql,/revoke execute on function public\./);
 assert.doesNotMatch(sql,/grant execute|insert into|update app\.|delete from/);
 assert.match(sql,/does NOT validate legacy MRP evidence/);
});

test('compatibility decision does not present the blanket freeze as rollout-ready',()=>{
 const doc=readFileSync('docs/quality/2026-10-27-playoff-compatibility-revision.md','utf8');
 assert.match(doc,/not a rollout candidate/);
 assert.match(doc,/shared persistence\/finalization boundary/);
 assert.match(doc,/v3 settlement binding\/reader\/writer replacement before enabling v3/);
});
