import {directorUnresolvedGamesEnabledV31} from '../src/lib/operations/director-unresolved-games-v31.ts';
import {integratedAreaLinks} from '../src/lib/integrated-workspace.ts';
import{nativeMixedPreparationPageEnabledV1}from'../src/lib/seating/native-mixed-pilot-preparation-v1.ts';
import{nativeMixedGameReopenRoutesEnabledV1}from'../src/lib/api/native-mixed-game-reopen-v1.ts';
import{playoffReopenRoutesEnabledV1}from'../src/lib/playoffs/native-mixed-playoff-reopen-v1.ts';
import{playoffPaperRoutesEnabledV1}from'../src/lib/playoffs/native-mixed-playoff-paper-v1.ts';
import {nativeMixedReviewUiEnabledV1} from '../src/lib/finance/native-mixed-review-read-v1.ts';
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import {nativeMixedPaperRouteEnabledV1} from "../src/lib/seating/native-mixed-paper-route-v1.ts";
import {recordedCostAdoptionPageEnabledV1} from "../src/lib/finance/recorded-cost-adoption-page-v1.ts";

// A page nobody links to is a page the director cannot reach, and nothing in the
// suite noticed either way: every test that exercised a page navigated straight
// to its URL. A 2026-09-19 audit of all 31 routes under the workspace had to be
// done by hand, twice, because the first pass read a grep of short lines and
// missed hrefs sitting inside minified one-line JSX.
//
// This walks every route segment under the tournament workspace and asserts some
// OTHER file links to it. Links are written as template literals, so the match is
// on the tail of the href: `${tournamentId}/roster`.
const BASE = "src/app/tournament/[tournamentId]";

function sourceFiles(dir, found = []) {
  for (const name of readdirSync(dir)) {
    const path = `${dir}/${name}`;
    if (statSync(path).isDirectory()) sourceFiles(path, found);
    else if (name.endsWith(".ts") || name.endsWith(".tsx")) found.push(path);
  }
  return found;
}

// Matching on the closing brace of the interpolation keeps this independent of
// what the variable is called (tournamentId, id, params.tournamentId all differ
// across the tree), and the characters that may follow a segment are only the
// ones that end a path: the end of the template, a further segment, or a query.
function linksTo(content, segment) {
  const needle = `}/${segment}`;
  for (let at = content.indexOf(needle); at !== -1; at = content.indexOf(needle, at + 1)) {
    const prefix = content.slice(Math.max(0, at - 60), at);
    if (!prefix.includes("/tournament/")) continue;
    const next = content[at + needle.length];
    if (next === undefined || next === "`" || next === "/" || next === "?" || next === '"' || next === "'") return true;
  }
  return false;
}

// An entry here is a deliberate statement that the route is reached some other
// way, with the reason. Everything else must be linked.
const INTERNAL = new Map([
  ["officials", "a redirect shim to setup/officials/co_director, which setup-official-summaries.tsx links"],
  ["cross-checkers", "a redirect shim to setup/officials/cross_checker, which setup-official-summaries.tsx links"],
]);

test("every tournament page is linked from somewhere a director can reach", () => {
  const segments = readdirSync(BASE).filter((name) => statSync(`${BASE}/${name}`).isDirectory());
  const files = sourceFiles("src");
  const orphans = [];
  for (const segment of segments) {
    if (INTERNAL.has(segment)) continue;
    if(segment==='unresolved-games'&&!directorUnresolvedGamesEnabledV31()){const file=BASE+'/unresolved-games/page.tsx';assert.deepEqual(sourceFiles(BASE+'/unresolved-games').filter(p=>p.endsWith('/page.tsx')),[file]);const page=readFileSync(file,'utf8');assert(page.indexOf('if(!directorUnresolvedGamesEnabledV31())notFound()')<page.indexOf('await params'));continue;}
    // Exact closed paper candidate only; enabling it requires real navigation.
    if(segment==='rehearsal-playoff-paper'&&!playoffPaperRoutesEnabledV1()){
      const file=`${BASE}/rehearsal-playoff-paper/[eventId]/[contextId]/[slot]/[gameNumber]/page.tsx`;
      assert.deepEqual(sourceFiles(`${BASE}/rehearsal-playoff-paper`).filter(p=>p.endsWith('/page.tsx')),[file]);
      const page=readFileSync(file,'utf8'),gate=page.indexOf('if(!playoffPaperRoutesEnabledV1())notFound()');
      assert(gate>=0&&gate<page.indexOf('getPublicSupabaseEnv().url')&&gate<page.indexOf('await params'));
      assert(page.includes("['director','co_director','cross_checker']"));continue;
    }
    // The dedicated Playoff candidate stays inaccessible and unadvertised.
    // A later enablement must provide real Director navigation too.
    if(segment==='rehearsal-playoff-corrections'&&!playoffReopenRoutesEnabledV1()){
      const file=`${BASE}/rehearsal-playoff-corrections/[eventId]/[contextId]/[slot]/[gameNumber]/page.tsx`;
      assert.deepEqual(sourceFiles(`${BASE}/rehearsal-playoff-corrections`).filter(p=>p.endsWith('/page.tsx')),[file]);
      const page=readFileSync(file,'utf8'),gate=page.indexOf('if(!playoffReopenRoutesEnabledV1())notFound()');
      assert(gate>=0&&gate<page.indexOf('getPublicSupabaseEnv().url')&&gate<page.indexOf('await params'));assert(page.includes("if(access.role!=='director')notFound()"));continue;
    }
    // Unadvertised correction candidate: a future enablement must supply real
    // navigation as well as provider/SQL acceptance, not a permanent exception.
    if(segment==='rehearsal-corrections'&&!nativeMixedGameReopenRoutesEnabledV1()){
      const file=`${BASE}/rehearsal-corrections/[eventId]/[startId]/[gameId]/page.tsx`;
      assert.deepEqual(sourceFiles(`${BASE}/rehearsal-corrections`).filter(p=>p.endsWith('/page.tsx')),[file]);
      const page=readFileSync(file,'utf8'),gate=page.indexOf('if(!nativeMixedGameReopenRoutesEnabledV1())notFound()');
      assert(gate>=0&&gate<page.indexOf('getPublicSupabaseEnv().url'));
      assert(gate<page.indexOf('await params'));
      assert(page.includes("if(!['director','co_director','cross_checker'].includes(access.role))notFound()"));
      continue;
    }
    // Keep this read-only candidate unadvertised until SQL/provider acceptance.
    // Enabling it restores the ordinary navigation requirement automatically.
    if(segment==='rehearsal-review'&&!nativeMixedReviewUiEnabledV1()){
      const file=`${BASE}/rehearsal-review/[eventId]/page.tsx`;
      assert.deepEqual(sourceFiles(`${BASE}/rehearsal-review`).filter(p=>p.endsWith('/page.tsx')),[file]);
      const page=readFileSync(file,'utf8'),gate=page.indexOf('if(!nativeMixedReviewUiEnabledV1())notFound()');
      assert(gate>=0&&gate<page.indexOf('await params'));
      continue;
    }
    if(segment==='rehearsal-prepare'&&!nativeMixedPreparationPageEnabledV1()){const file=`${BASE}/rehearsal-prepare/[eventId]/page.tsx`;const print=file.replace('/page.tsx','/print/page.tsx');assert.deepEqual(sourceFiles(`${BASE}/rehearsal-prepare`).filter(p=>p.endsWith('/page.tsx')).sort(),[file,print].sort());const printSource=readFileSync(print,'utf8');assert(printSource.indexOf('if(!nativePaperPairingEnabledV29())notFound()')<printSource.indexOf('await params'));assert(readFileSync('src/lib/events/native-paper-pairing-read-v29.ts','utf8').includes('nativePaperPairingEnabledV29=()=>false'));const page=readFileSync(file,'utf8');assert(page.indexOf('if(!nativeMixedPreparationPageEnabledV1())notFound()')<page.indexOf('await params'));continue;}

    // This candidate must not be advertised before provider/fund/release
    // acceptance. Opening its gate automatically restores the link requirement.
    if(segment==="finance"&&!recordedCostAdoptionPageEnabledV1()){
      const financeCandidates = [
        ['','recordedCostAdoptionPageEnabledV1'],
        ['final-review/','modernEventClosePageEnabledV1'],
        ['modern-prizes/','modernPrizePageEnabledV2'],
        ['pool-awards/','selectedStepPoolPageEnabledV3'],
        ['pool-ownership/','selectedStepOwnershipPageEnabledV3'],
        ['selected-step-awards/','selectedStepAwardPageEnabledV3'],
      ];
      assert.deepEqual(sourceFiles(`${BASE}/finance`).filter(file=>file.endsWith('/page.tsx')).sort(),financeCandidates.map(([suffix])=>`${BASE}/finance/[eventId]/${suffix}page.tsx`).sort(),'Additional Finance pages require their own reachability review');
      for(const [suffix,gateName] of financeCandidates){
        const page=readFileSync(`${BASE}/finance/[eventId]/${suffix}page.tsx`,'utf8');
        const gate=page.indexOf(`if(!${gateName}())notFound()`);
        assert(gate>=0&&gate<page.indexOf('await params')&&gate<page.indexOf('await requireTournamentAccess'),'each candidate denies before params and auth');
        assert.match(page,/requireTournamentAccess/);
        assert.match(page,/director/);
      }
      continue;
    }
    if(segment==="rehearsal-paper"&&!nativeMixedPaperRouteEnabledV1()){
      const file=`${BASE}/rehearsal-paper/[eventId]/[startId]/[gameId]/page.tsx`;
      assert.deepEqual(sourceFiles(`${BASE}/rehearsal-paper`).filter(p=>p.endsWith('/page.tsx')).sort(),[`${BASE}/rehearsal-paper/[eventId]/[startId]/page.tsx`,file].sort());const directory=readFileSync(`${BASE}/rehearsal-paper/[eventId]/[startId]/page.tsx`,'utf8');assert(directory.indexOf('if(!nativeMixedPaperDirectoryEnabledV1())notFound()')>=0&&directory.indexOf('if(!nativeMixedPaperDirectoryEnabledV1())notFound()')<directory.indexOf('params:await params'));assert(directory.includes('createAuthenticated:createClient'));assert(directory.includes('if(!directory)notFound()')); 
      const page=readFileSync(file,"utf8");assert(page.indexOf("if(!nativeMixedPaperRouteEnabledV1())notFound()")>=0);
      assert(page.indexOf("if(!nativeMixedPaperRouteEnabledV1())notFound()")<page.indexOf("const env=getPublicSupabaseEnv()"));
      continue;
    }
    const owned = `${BASE}/${segment}/`;
    const centralLinks=integratedAreaLinks('b0000000-0000-4000-8000-000000000001',true,true).flatMap(area=>area.paths);
    const centralNavigation=readFileSync('src/components/integrated-workspace-nav.tsx','utf8');
    const centrallyLinked=centralNavigation.includes('integratedAreaLinks(tournamentId,director,official)')&&centralNavigation.includes('href={p.href}')&&centralLinks.some(link=>link.href.split('/')[3]===segment);
    const linked = centrallyLinked||files.some((file) => !file.split("\\").join("/").startsWith(owned) && linksTo(readFileSync(file, "utf8"), segment));
    if (!linked) orphans.push(segment);
  }
  assert.deepEqual(
    orphans,
    [],
    `these pages exist and nothing links to them, so the only way in is to type the URL:\n${orphans.join("\n")}`,
  );
});

// The two controls that invalidate a QR code a room full of people is currently
// scanning. Close registration and Publish seating each make the director tick a
// box first; these two fired on one click until 2026-09-19.
test("replacing and closing the registration link both take a confirmation", () => {
  const client = readFileSync(`${BASE}/registration/registration-link-client.tsx`, "utf8");
  assert.match(client, /setConfirming\("close"\)/, "Close Link must open the confirmation, not close the link");
  assert.match(client, /setConfirming\("replace"\)/, "Replacing an open link must open the confirmation");
  assert.ok(
    !/onClick=\{\(\) => void close\(\)\}/.test(client),
    "no control may call close() straight from a click",
  );
  assert.match(client, /Registrations already received are kept either way\./);
});
