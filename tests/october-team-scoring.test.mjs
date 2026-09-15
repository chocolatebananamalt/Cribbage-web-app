import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isTeamMutation,isTeamWorkspace } from "../src/lib/api/team-operations.ts";
import { isTeamResults } from "../src/lib/api/team-results.ts";
import { buildTeamResultsPdf } from "../src/lib/results/team-results-pdf.ts";
import { PDFDocument } from "pdf-lib";
const read=(path)=>readFileSync(path,"utf8");
const id=(n)=>`${String(n).padStart(8,"0")}-0000-4000-8000-000000000001`;

test("team API accepts supported operations and rejects unsafe inputs",()=>{
 assert.equal(isTeamMutation({action:"create_team",eventId:id(1),teamId:id(2),teamEntryId:id(3),captainRosterEntryId:id(4),partnerRosterEntryId:id(5),scorecardType:"digital",operationId:id(6)}),true);
 assert.equal(isTeamMutation({action:"create_team",eventId:id(1),teamId:id(2),teamEntryId:id(3),captainRosterEntryId:id(4),partnerRosterEntryId:id(4),scorecardType:"digital",operationId:id(6)}),false);
 assert.equal(isTeamMutation({action:"submit_score",eventId:id(1),gameId:id(2),submissionId:id(4),winnerSide:"a",margin:31,operationId:id(3)}),true);
 assert.equal(isTeamMutation({action:"submit_score",eventId:id(1),gameId:id(2),submissionId:id(4),winnerSide:"a",margin:122,operationId:id(3)}),false);
 assert.equal(isTeamMutation({action:"submit_paper_score",eventId:id(1),gameId:id(2),submissionId:id(4),side:"a",paperCardReference:"A-1",winnerSide:"a",margin:31,operationId:id(3)}),true);
 assert.equal(isTeamMutation({action:"review_paper_score",eventId:id(1),gameId:id(2),submissionId:id(4),reviewId:id(5),paperCardReference:"A-1",winnerSide:"a",margin:31,operationId:id(3)}),true);
 assert.equal(isTeamMutation({action:"review_paper_score",eventId:id(1),gameId:id(2),submissionId:id(4),reviewId:id(5),paperCardReference:"A-1",winnerSide:"a",margin:0,operationId:id(3)}),false);
 assert.equal(isTeamMutation({action:"correct_score",eventId:id(1),gameId:id(2),correctionId:id(4),expectedGameVersion:1,winnerSide:"b",margin:12,reason:"",operationId:id(3)}),true);
 assert.equal(isTeamMutation({action:"review_correction",eventId:id(1),correctionId:id(2),reviewId:id(4),approved:true,operationId:id(3)}),true);
 assert.equal(isTeamMutation({action:"resolve_mismatch",eventId:id(1),gameId:id(2),resolutionId:id(4),expectedGameVersion:1,winnerSide:"b",margin:12,reason:"Independent paper review",operationId:id(3)}),true);
 assert.equal(isTeamMutation({action:"review_mismatch",eventId:id(1),resolutionId:id(2),reviewId:id(4),approved:true,operationId:id(3)}),true);
});

test("October team UI exposes captain, mode, paper review, mismatch review, locations, and standings",()=>{const ui=read("src/app/tournament/[tournamentId]/teams/team-operations-client.tsx");for(const token of ["Create a two-person team","ownAvailable.length === 1","Shared scorecard","Paper cards required","Submit My Independent Entry","Second Official Re-enter Card","Official Confirm","Propose Mismatch Resolution","Approve Mismatch Resolution","currentTableSeat","Team Standings","Traditional Doubles","Canadian Doubles"])assert.match(ui,new RegExp(token));});

test("seating directory is participant-visible, private-field bounded, searchable, filterable, and printable",()=>{const page=read("src/app/tournament/[tournamentId]/seating-directory/seating-directory-client.tsx"),route=read("src/app/api/v1/tournaments/[id]/seating-directory/route.ts");for(const token of ["exact ACC #","Scorecard","Entry type","Table","Print Current List","Assigned Table/Seat","Verification ID"])assert.match(page,new RegExp(token));assert.match(route,/get_tournament_seating_directory_v2/);for(const forbidden of ["email","phone","address","payment"])assert.doesNotMatch(page,new RegExp(`<th>${forbidden}`,"i"));});

test("supported doubles activation is normalized as digital without widening generic team formats",()=>{const activation=read("src/lib/api/setup-activation.ts"),setup=read("src/app/tournament/[tournamentId]/setup/setup-client.tsx");assert.match(activation,/standard_singles.*doubles.*canadian_doubles/);assert.match(setup,/Traditional Doubles and Canadian Doubles support shared Digital or Paper team scorecards/);assert.match(setup,/digital and paper scoring/);});

test("team workspace parser fails closed on partial and over-broad payloads",()=>{
 assert.equal(isTeamWorkspace({tournamentId:id(1),tournamentName:"Sample",canManage:false,canCrossCheck:false,actorId:id(2),events:[],roster:[]}),true);
 assert.equal(isTeamWorkspace({tournamentId:id(1),tournamentName:"Sample",canManage:false,canCrossCheck:false,actorId:id(2),events:[],roster:[],email:"private@example.com"}),false);
 assert.equal(isTeamWorkspace({tournamentId:id(1),tournamentName:"Sample",canManage:false,canCrossCheck:false,actorId:id(2),events:[{}],roster:[]}),false);
});

test("team result contract preserves two members and printable pagination",async()=>{
 const entries=Array.from({length:45},(_,index)=>({rank:index+1,teamEntryId:id(index+10),teamName:`Team ${index+1}`,members:[{name:`Captain ${index+1}`,accNumber:`A-${index+1}`},{name:`Partner ${index+1}`,accNumber:`B-${index+1}`}],gamePoints:10,gamesWon:5,plusSpreadPoints:50,minusSpreadPoints:30,netSpreadPoints:20,qualifies:index<12,qualificationStatus:index<12?"qualified":"not_qualified"}));
 const report={tournamentName:"Full Rehearsal",eventId:id(1),eventName:"Traditional Doubles",format:"doubles",eventType:"main",qualificationCount:12,qualificationBlocked:false,tieResolutionStatus:"not_required",tieResolutionId:null,mrps:"eligible_after_review",entries};
 assert.equal(isTeamResults(report),true);
 const document=await PDFDocument.load(await buildTeamResultsPdf("Sample Tournament",report));
 assert.ok(document.getPageCount()>1);
});

test("team qualification never uses a name to decide a tied cutoff",()=>{const sql=read("database/migrations/0186_team_qualification_tie_safety.sql");assert.match(sql,/rank\(\) over\(order by game_points desc,games_won desc,net_points desc,plus_points desc,minus_points asc\)/);assert.match(sql,/tie_review_required/);assert.doesNotMatch(sql,/rank\(\) over\([^)]*team_name/);});

test("0188 resolves exact retries before lifecycle gates, preserves unresolved scorers, and narrows official workspace",()=>{
 const sql=read("database/migrations/0188_team_lifecycle_privacy_qualification_repairs.sql");
 assert.ok(sql.indexOf("select * into prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id") < sql.indexOf("claim_locked"));
 assert.match(sql,/scorer_resolution_status text generated always/);
 assert.match(sql,/scorerResolutionStatus/);
 const create=sql.slice(sql.indexOf("function public.create_event_team_v1"),sql.indexOf("end $$;",sql.indexOf("function public.create_event_team_v1")));
 assert.match(create,/captain_profile=p_actor_id/);
 assert.doesNotMatch(create,/'not_director'/);
 assert.match(sql,/limited_official/);
 assert.match(sql,/item - 'editorProfileId'/);
 assert.match(sql,/resolve_event_team_qualification_tie_v1/);
 assert.match(sql,/team_qualification_tie_resolved/);
});
