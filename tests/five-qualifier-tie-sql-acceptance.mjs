import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {quote,uuid} from './fixtures/q-review-foundation.mjs';
import {isQualificationTieWorkspace} from '../src/lib/api/qualification-ties.ts';
export function resolveSeventeenSeedTie({sql,fixture:f}) {
 const {actor,tid,eid}=f;
 const read=()=>JSON.parse(sql(`select public.get_qualification_tie_workspace_v1('${actor}','${tid}','${eid}');`));
 const snapshot=()=>sql(`select jsonb_build_object('count',(select count(*)from app.canonical_games where event_id='${eid}'),'scores',(select jsonb_agg(to_jsonb(s)order by line_id)from app.current_effective_scorelines('${tid}','${eid}')s));`);
 const before=snapshot(),w=read();assert.ok(isQualificationTieWorkspace(w,tid,eid));assert.equal(w.groups.length,1);
 const group=w.groups[0];assert.deepEqual([...group.candidateIds].sort(),[f.pid(1),f.pid(2)].sort());assert.equal(group.numericRank,1);
 assert.equal(group.method,'one_game_playoff');assert.equal(group.headToHeadGameId,null);assert.equal(group.resolution,null);
 const r={expectedSourceFingerprint:w.sourceFingerprint,participantIds:group.candidateIds,winnerId:f.pid(2),method:'one_game_playoff',
  reason:'Local simulated separately played one-game playoff; cut for first deal reminder acknowledged',evidenceReference:'Synthetic test outcome only; no real game or qualifying score added'};
 const op=uuid('a257',1),save=(request,key)=>JSON.parse(sql(`select public.save_qualification_tie_resolution_v1('${actor}','${tid}','${eid}',${quote(JSON.stringify(request))},'${key}');`));
 const accepted=save(r,op);assert.equal(accepted.status,'qualification_tie_recorded');assert.deepEqual(save(r,op),accepted);
 assert.equal(save({...r,winnerId:f.pid(1)},op).code,'idempotency_conflict');
 assert.equal(snapshot(),before);assert.equal(read().groups[0].resolution.winnerId,f.pid(2));
 sql(f.finalizeSql);
 const rows=JSON.parse(sql(`select jsonb_agg(jsonb_build_object('participantId',participant_id,'numericRank',numeric_rank,'ordinal',ranking_ordinal,'gamePoints',game_points,'wins',games_won,'plus',plus_points,'net',net_spread_points)order by ranking_ordinal)from app.qualification_result_rows where event_id='${eid}';`));
 assert.deepEqual(rows.slice(0,5).map(r=>r.participantId),[2,1,3,4,5].map(f.pid));
 assert.deepEqual(rows.slice(0,2).map(r=>[r.numericRank,r.ordinal,r.gamePoints,r.wins,r.plus,r.net]),[[1,1,24,12,120,120],[1,2,24,12,120,120]]);
 assert.equal(snapshot(),before);assert.equal(sql(`select count(*)from app.canonical_games where event_id='${eid}';`),'102');
 console.log('PASS genuine five-qualifier seed tie: manual separate-game winner changes ordinal only, exact replay,102 games and all qualifying scores unchanged');
 return {resolution:accepted,request:r,scoreSnapshotSha256:crypto.createHash('sha256').update(before).digest('hex')};
}
