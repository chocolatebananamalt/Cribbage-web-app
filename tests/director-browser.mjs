// Local-only synthetic component rehearsal. No credentials or live backend.
// Run: node tests/director-browser.mjs (starts an isolated localhost fixture).
import { mkdir, writeFile, rename } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const root = process.cwd(), fixture = path.join(root, "test-results/director-browser");
await mkdir(path.join(fixture, "app"), { recursive: true });
await writeFile(path.join(fixture, "package.json"), JSON.stringify({ private: true, type: "module" }));
await writeFile(path.join(fixture, "next.config.mjs"), `export default {turbopack:{root:${JSON.stringify(root)}}};`);
await writeFile(path.join(fixture, "app/layout.tsx"), `import '../../../src/app/globals.css'; export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}`);
const id = "10000000-0000-4000-8000-000000000001";
await writeFile(path.join(fixture, "app/page.tsx"), `
import {NewTournamentClient} from '../../../src/app/director/tournaments/new/new-tournament-client';
import {SignInForm} from '../../../src/app/sign-in/sign-in-form';
import SetupClient from '../../../src/app/tournament/[tournamentId]/setup/setup-client';
import RosterClient from '../../../src/app/tournament/[tournamentId]/roster/roster-client';
import SeatingClient from '../../../src/app/tournament/[tournamentId]/seating/seating-client';
import EventCheckInClient from '../../../src/app/tournament/[tournamentId]/event-check-in/event-check-in-client';
import DirectorChecklist from '../../../src/app/tournament/[tournamentId]/director-checklist';
import PaymentObligationClient from '../../../src/app/tournament/[tournamentId]/payments/payment-obligation-client';
import ScheduleClient from '../../../src/app/tournament/[tournamentId]/schedule/schedule-client';
import ParticipantsClient from '../../../src/app/tournament/[tournamentId]/participants/participants-client';
export default async function Page({searchParams}:{searchParams:Promise<{view?:string}>}){const {view}=await searchParams;
if(view?.startsWith('schedule')){const published=view!=='schedule'; const event={eventId:'${id}',name:'Main Event',format:'standard_singles' as const,scoringMethod:'digital' as const,gameCount:12,participantCount:2,schedulePublished:published,schedulePublicationId:published?'${id}':null,participantSnapshotDigest:published?'a'.repeat(64):null,publishedMatchCount:published?12:0,playState:(view==='schedule-started'?'in_progress':published?'ready_to_start':'preparing') as 'in_progress'|'ready_to_start'|'preparing',startedAt:null,startedBy:null}; return <main className="auth-shell"><section className="auth-card schedule-card"><ScheduleClient actorId="${id}" tournamentId="${id}" workspace={{tournamentName:'Synthetic tournament',registrationClosed:true,tableCount:1,seatsPerTable:2,events:view==='schedule-retired'?[]:[event,{...event,eventId:'20000000-0000-4000-8000-000000000002',name:'Later Event'}],participants:[{eventId:'${id}',participantId:'${id}',displayName:'Fictional A',verificationId:'A-1',profileLinked:false},{eventId:'${id}',participantId:'20000000-0000-4000-8000-000000000002',displayName:'Fictional B',verificationId:'A-2',profileLinked:false}],matches:[]}}/></section></main>;}
if(view==='auth')return <SignInForm handoffWarning={false}/>;
if(view==='participants')return <main className="auth-shell"><section className="auth-card corrections-card"><ParticipantsClient actorId="${id}" tournamentId="${id}" workspace={{tournamentName:'Synthetic tournament',registrationClosed:true,seatingPublished:true,events:[{eventId:'${id}',name:'Main',eventType:'main',format:'standard_singles',scoringMethod:'digital',participantCount:0}],roster:[{rosterEntryId:'${id}',displayName:'Fictional Player',checkInState:'checked_in',profileLinked:false,scorecardType:'paper',verificationId:'A-1',enrolledEventIds:[]}]}}/></section></main>;
if(view==='create-other')return <main className="auth-shell"><section className="auth-card"><NewTournamentClient actorId="20000000-0000-4000-8000-000000000002"/></section></main>;
if(view==='roster-open')return <main className="auth-shell"><section className="auth-card corrections-card"><RosterClient actorId="${id}" tournamentId="${id}" intakeState="open" rosterEntries={[]} withdrawnRosterEntries={[]} promotionCandidates={[{approvalDecisionId:'${id}',sourceClaimId:'${id}',displayName:'Fictional Candidate',email:'fictional@example.invalid',accNumber:null,intendedPaymentMethod:'unspecified',scorecardType:'paper',submittedAt:'2027-01-01T00:00:00Z'}]}/></section></main>;
if(view==='seating-open')return <main className="auth-shell"><section className="auth-card corrections-card"><SeatingClient actorId="${id}" tournamentId="${id}" registrationClosed={false} publication={null} checkIn={[{rosterEntryId:'${id}',displayName:'Fictional Player',state:'not_checked_in',scorecardType:'paper'}]}/></section></main>;
if(view==='payment')return <main className="auth-shell"><section className="auth-card corrections-card"><PaymentObligationClient actorId="${id}" tournamentId="${id}" entries={[{rosterEntryId:'${id}',displayName:'Fictional Player',obligationVersion:0,amountOwedMinor:null,amountReceivedMinor:0,amountRemainingMinor:null,paymentStatus:'not_configured'}]}/></section></main>;
return <main className="auth-shell"><section className="auth-card corrections-card setup-card">
{view==='create'?<NewTournamentClient actorId="${id}"/>:view==='setup'||view==='setup-no-seed'||view==='setup-registration'?<SetupClient actorId="${id}" tournamentId="${id}" registrationLinkManagementEnabled={view==='setup-registration'} creationSeed={view==='setup'||view==='setup-registration'?{name:'Synthetic tournament',plannedDate:'2027-02-03'}:undefined}/>:view==='roster'?<RosterClient actorId="${id}" tournamentId="${id}" intakeState="setup_required" rosterEntries={[]} withdrawnRosterEntries={[]} promotionCandidates={[]}/>:view==='qr'?<EventCheckInClient tournamentId="${id}" appAccess={null} workspace={{events:[{eventId:'${id}',name:'Main',eventType:'main',format:'standard_singles',windowState:'open',checkedInCount:2,noShowCount:0,unresolvedCount:0,pendingDeskCount:0}],requests:[],roster:[]}}/>:<DirectorChecklist tournamentId="${id}" snapshot={{setup:null,activation:null,seating:null,enrollment:null,payments:null,schedule:null,attendance:null}}/>}
</section></main>}`);
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", fixture, "--hostname", "127.0.0.1", "--port", "3217"], { cwd: root, env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_SUPABASE_URL: "https://synthetic.invalid", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "synthetic-not-a-credential" }, stdio: ["ignore", "pipe", "pipe"] });
let logs = ""; child.stdout.on("data", (data) => { logs += data; }); child.stderr.on("data", (data) => { logs += data; });
const base = "http://127.0.0.1:3217";
let browser;
const evidence = [];
try {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) { try { if ((await fetch(base)).ok) break; } catch {} await new Promise((resolve) => setTimeout(resolve, 500)); }
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext();
  // Reject every external call. The only auth replies below are local mocks.
  await context.route("**/*", async (route) => { if (!route.request().url().startsWith(base)) await route.abort(); else await route.continue(); });
  const page = await context.newPage();
  let savedSetup = null, setupVersion = 0, setupWrites = [], failSetupRefresh = false;
  let activationWrites = [];
  const fee = { mainRateCents: 300, consolationRateCents: 100, mainEligibleParticipantCount: 0, consolationEligibleParticipantCount: 0, runningTotalCents: 0, mainRateSource: "setup", consolationRateSource: "setup" };
  await page.route("**/api/v1/tournaments/*/setup", async (route) => {
    if (route.request().method() === "POST") {
      const request = route.request().postDataJSON(); setupWrites.push(request);
      setupVersion++; savedSetup = { ...request.payload, events: request.payload.events.map((event) => ({...event,sourceStatus:'director_configured_unverified',qPools:event.qPools.map((pool,index)=>({...pool,slot:index+1,sourceStatus:'director_configured_unverified'})),sidePools:event.sidePools.map((pool,index)=>({...pool,slot:index+1,sourceStatus:'director_configured_unverified'}))})), revisionId: id, version: setupVersion, createdAt: "2027-01-01T00:00:00.000Z" };
      await new Promise((resolve) => setTimeout(resolve, 250));
      return route.fulfill({ json: { status: "setup_draft_saved", revisionId: id, version: setupVersion, eventCount: request.payload.events.length, operationalEventsCreated: false, rulesetApproved: false, seatingUpdated: false, financeUpdated: false, resultsUpdated: false, payoutsCalculated: false, qualifiersCalculated: false, accSubmissionCreated: false } });
    }
    if (failSetupRefresh) return route.fulfill({ status: 503, json: {} });
    return route.fulfill({ json: { workspace: { current: savedSetup, history: savedSetup ? [{ version: setupVersion, createdAt: savedSetup.createdAt, eventCount: savedSetup.events.length }] : [], sanctioningFee: fee }, officialChoices: { directorProfileId: id, directorDisplayName: "Fictional Director", coDirectorProfileIds: [] } } });
  });
  await page.route("**/api/v1/tournaments/*/setup/activation", async (route) => {
    if (route.request().method() !== "POST") return route.fulfill({ json: { status: "not_activated" } });
    const request = route.request().postDataJSON(); activationWrites.push(request);
    return route.fulfill({ json: { status: "tournament_setup_activated", setupRevisionId: request.setupRevisionId, setupVersion: request.expectedVersion, eventCount: 1, events: [{ activationId: id, setupEventVersionId: id, rulesetVersionId: id, eventId: id, eventType: "main", name: "Main Event", format: "standard_singles", scoringMethod: "digital", gameCount: 12 }], roundsCreated: false, participantsEnrolled: false, seatingUpdated: false, financeUpdated: false, resultsUpdated: false, payoutsCalculated: false, qualifiersCalculated: false, accSubmissionCreated: false, registrationState: "open" } });
  });
  await page.route("**/api/v1/tournaments/*/setup/officials**", (route) => route.fulfill({ status: 503, json: {} }));
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const view of ["checklist", "roster", "create", "auth", "setup", "setup-registration", "seating-open", "qr", "payment", "schedule-ready", "participants"]) {
      await page.goto(`${base}?view=${view}`);
      await page.locator("main").first().waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${view} overflow at ${width}`);
      await page.screenshot({ path: path.join(fixture, `${view}-${width}.png`), fullPage: true });
    }
    evidence.push(`No horizontal overflow: checklist, roster, create, auth, setup, seating, event check-in, amount owed, schedule/start, enrollment at ${width}px`);
  }
  await page.goto(`${base}?view=roster`);
  await page.getByLabel("First name", { exact: true }).fill("Fictional"); await page.getByLabel("Last name", { exact: true }).fill("Player");
  assert.equal(await page.getByRole("button", { name: "Add Player", exact: true }).isDisabled(), true);
  assert.equal(await page.getByText("Registration has not opened.", { exact: false }).count(), 1);
  evidence.push("Unopened roster keeps input and blocks Add Player with setup guidance");

  await page.goto(`${base}?view=setup`);
  await page.getByLabel("Tournament name", { exact: true }).waitFor();
  assert.equal(await page.getByLabel("Tournament name", { exact: true }).inputValue(), "Synthetic tournament");
  assert.equal(await page.getByLabel("Start date", { exact: false }).first().inputValue(), "2027-02-03");
  assert.equal(await page.getByLabel("Start time", { exact: true }).inputValue(), "");
  await page.getByLabel("Venue name", { exact: true }).fill("Fictional Hall");
  await page.getByLabel("Tournament name", { exact: true }).fill("Saved later title");
  await page.getByLabel("Venue street address", { exact: true }).fill("1 Test Lane");
  await page.getByLabel("Venue city", { exact: true }).fill("Honolulu");
  await page.getByLabel("Venue ZIP", { exact: true }).fill("96801");
  await page.getByLabel("Venue State", { exact: false }).selectOption("Hawaii");
  await page.getByLabel("Start time", { exact: true }).fill("09:00");
  await page.getByLabel("End date", { exact: true }).fill("2027-02-03T18:00");
  failSetupRefresh = true;
  const detailsButton = page.getByRole("button", { name: "Save Tournament Details & Continue" });
  await detailsButton.click();
  await page.getByText("were saved. Refresh to load the latest server version", { exact: false }).waitFor();
  assert.equal(setupWrites.length, 1);
  failSetupRefresh = false;
  await page.reload();
  await page.getByLabel("Tournament name", { exact: true }).waitFor();
  assert.equal(await page.getByLabel("Venue name", { exact: true }).inputValue(), "Fictional Hall");
  assert.equal(await page.getByLabel("Tournament name", { exact: true }).inputValue(), "Saved later title");
  assert.equal(await page.getByLabel("Start time", { exact: true }).inputValue(), "09:00");
  evidence.push("Create name/date seed without assumed time; details save persists through refresh; accepted write plus failed refresh remains reported saved");
  await page.getByRole("button", { name: "Add Main Event", exact: true }).click();
  await page.getByRole("button", { name: "Save All Events Draft", exact: true }).click();
  await page.getByRole("button", { name: "Finalize All Events / Open Registration", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(setupWrites.length, 2);
  assert.equal(await page.getByRole("alertdialog").count(), 0);
  evidence.push("Saved events reload correctly; cancelling finalization makes no activation write");

  await page.getByRole("button", { name: "Finalize All Events / Open Registration", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Yes, Finalize & Open Registration", exact: true }).click();
  await page.waitForURL(`**/tournament/${id}`);
  assert.equal(activationWrites.length, 1);
  evidence.push("Successful activation without registration-link management returns to the tournament workspace");
  await page.goto(`${base}?view=setup-registration`);
  await page.getByRole("button", { name: "Finalize All Events / Open Registration", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Yes, Finalize & Open Registration", exact: true }).click();
  await page.waitForURL(`**/tournament/${id}/registration`);
  assert.equal(activationWrites.length, 2);
  evidence.push("Successful activation with registration-link management opens the registration workspace");

  let obligationWrites = [], acceptObligation = false;
  await page.route("**/api/v1/tournaments/*/payment-obligations", async (route) => {
    const request = route.request().postDataJSON(); obligationWrites.push(request);
    await route.fulfill(acceptObligation ? { json: { status: "payment_obligation_saved", rosterEntryId: id, obligationVersion: 1, amountOwedMinor: request.amountOwedMinor } } : { status: 503, json: {} });
  });
  await page.goto(`${base}?view=payment`);
  await page.getByLabel("Amount owed", { exact: true }).fill("0.00");
  await page.getByLabel("Optional reason for change").fill("Synthetic no-fee fixture");
  await page.getByRole("button", { name: "Save amount owed", exact: true }).click();
  await page.getByRole("button", { name: "Retry Exact Amount Owed Request" }).waitFor();
  await page.goto(`${base}?view=checklist`); await page.goBack();
  await page.getByRole("button", { name: "Retry Exact Amount Owed Request" }).waitFor();
  assert.equal(await page.getByLabel("Optional reason for change").inputValue(), "Synthetic no-fee fixture");
  assert.equal(await page.getByLabel("Amount owed", { exact: true }).isDisabled(), true);
  acceptObligation = true;
  await page.getByRole("button", { name: "Retry Exact Amount Owed Request" }).click();
  await page.getByText("Amount owed saved.", { exact: true }).waitFor();
  assert.equal(obligationWrites.length, 2); assert.deepEqual(obligationWrites[0], obligationWrites[1]);
  evidence.push("Amount owed uncertain result survives back navigation and exact retry; explicit zero and reason preserved, identical key, no automatic write");

  let writes = [], createMode = 503;
  await page.route("**/api/v1/director/tournaments", async (route) => { writes.push(route.request().postDataJSON()); await new Promise((resolve) => setTimeout(resolve, 250)); await route.fulfill({ status: createMode, json: createMode === 200 ? { tournamentId: id } : createMode === 409 ? { error: "invalid_request" } : { error: "operation_unavailable" } }); });
  await page.goto(`${base}?view=create`);
  await page.getByLabel("Tournament name").fill("Fictional browser test"); await page.getByLabel("Planned tournament date").fill("2027-02-03");
  await page.getByRole("button", { name: "Create Draft and Continue Setup" }).click();
  assert.equal(await page.getByText("The request could not be confirmed.", { exact: false }).count(), 0);
  await page.getByRole("button", { name: "Retry Exact Draft Creation" }).waitFor();
  assert.equal(await page.getByLabel("Tournament name").isDisabled(), true);
  await page.goto(`${base}?view=create-other`);
  assert.equal(await page.getByLabel("Tournament name").inputValue(), "");
  await page.goBack();
  await page.reload();
  await page.getByRole("button", { name: "Retry Exact Draft Creation" }).click();
  await page.getByRole("button", { name: "Retry Exact Draft Creation" }).waitFor();
  assert.equal(writes.length, 2); assert.deepEqual(writes[0], writes[1]);
  evidence.push("Uncertain create survives refresh and exact retry reuses identical idempotency request; no pending retry warning");
  createMode = 200;
  await page.getByRole("button", { name: "Retry Exact Draft Creation" }).click();
  await page.getByRole("button", { name: "Retry Exact Draft Creation" }).waitFor();
  assert.deepEqual(writes[2], writes[0]);
  createMode = 409;
  await page.getByRole("button", { name: "Retry Exact Draft Creation" }).click();
  await page.getByRole("button", { name: "Create Draft and Continue Setup" }).waitFor();
  assert.equal(await page.getByLabel("Tournament name").isDisabled(), false);
  evidence.push("Create recovery is actor-isolated; malformed 2xx stays uncertain; explicit rejection unlocks preserved fields");

  let promotions = [];
  await page.route("**/api/v1/tournaments/*/roster-promotions", async (route) => { promotions.push(route.request().postDataJSON()); await route.fulfill({ status: 503, json: {} }); });
  let manualWrites = [];
  await page.route("**/api/v1/tournaments/*/roster-manual", async (route) => {
    manualWrites.push(route.request().postDataJSON());
    await new Promise((resolve) => setTimeout(resolve, 350));
    await route.fulfill({ status: 503, json: {} });
  });
  let seatingWrites = [];
  await page.route("**/api/v1/tournaments/*/seating/check-in", async (route) => {
    seatingWrites.push(route.request().postDataJSON());
    await new Promise((resolve) => setTimeout(resolve, 350));
    await route.fulfill({ status: 503, json: {} });
  });
  await page.route("**/api/v1/tournaments/*/roster-promotions/reconciliation", (route) => route.fulfill({ json: { result: null } }));
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(`${base}?view=roster-open`);
  await page.getByLabel("First name", { exact: true }).fill("Manual");
  await page.getByLabel("Last name", { exact: true }).fill("Entry");
  await page.getByRole("button", { name: "Add Player", exact: true }).click();
  await page.getByRole("button", { name: "Adding player…", exact: true }).waitFor();
  await page.getByRole("button", { name: "Retry manual entry", exact: true }).waitFor();
  await page.getByRole("button", { name: "Retry manual entry", exact: true }).click();
  await page.getByRole("button", { name: "Adding player…", exact: true }).waitFor();
  await page.getByRole("button", { name: "Retry manual entry", exact: true }).waitFor();
  assert.equal(manualWrites.length, 2); assert.deepEqual(manualWrites[0], manualWrites[1]);
  evidence.push("Manual roster entry shows Adding player while pending, then preserves exact request for explicit uncertain retry");
  await page.goto(`${base}?view=seating-open`);
  await page.getByRole("button", { name: "Save check-in status", exact: true }).click();
  await page.getByRole("button", { name: "Saving…", exact: true }).waitFor();
  await page.getByRole("button", { name: "Retry the same protected request", exact: true }).waitFor();
  await page.getByRole("button", { name: "Retry the same protected request", exact: true }).click();
  await page.getByRole("button", { name: "Saving…", exact: true }).waitFor();
  await page.getByRole("button", { name: "Retry the same protected request", exact: true }).waitFor();
  assert.equal(seatingWrites.length, 2); assert.deepEqual(seatingWrites[0], seatingWrites[1]);
  evidence.push("Seating check-in shows Saving while pending, then preserves the exact protected request for explicit retry");
  await page.goto(`${base}?view=roster-open`);
  await page.getByRole("button", { name: "Create approved roster identity" }).click();
  await page.getByRole("button", { name: "Retry exact roster request" }).waitFor();
  await page.reload();
  await page.getByRole("button", { name: "Retry exact roster request" }).click();
  await page.getByRole("button", { name: "Retry exact roster request" }).waitFor();
  assert.equal(promotions.length, 2); assert.deepEqual(promotions[0], promotions[1]);
  assert.equal(await page.getByRole("button", { name: "Create approved roster identity" }).isDisabled(), true);
  evidence.push("Uncertain candidate promotion survives null reconciliation/reload and replays identical request with other promotions locked");

  let authCalls = 0;
  await page.route("https://synthetic.invalid/**", async (route) => { authCalls++; await new Promise((resolve) => setTimeout(resolve, 200)); await route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ code: "over_email_send_rate_limit", msg: "For security purposes, you can only request this after 3 seconds." }) }); });
  await page.goto(`${base}?view=auth`); await page.getByLabel("Email address").fill("fictional@example.invalid");
  await page.getByRole("button", { name: "Email me a sign-in link", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Wait 3 seconds" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Email me a sign-in link", exact: true }).isDisabled(), true);
  assert.equal(await page.locator('[aria-live="off"]').count(), 1);
  await page.getByRole("button", { name: "Sign in with a password instead" }).click();
  assert.equal(await page.getByLabel("Password", { exact: true }).count(), 1);
  assert.equal(authCalls, 1);
  evidence.push("Explicit auth cooldown announces supplied wait, quiet countdown, password fallback available");
  await page.unroute("https://synthetic.invalid/**");
  await page.route("https://synthetic.invalid/**", (route) => route.fulfill({ status: 429, json: { code: "over_email_send_rate_limit", msg: "Email rate limit exceeded" } }));
  await page.reload(); await page.getByLabel("Email address").fill("fictional@example.invalid");
  await page.getByRole("button", { name: "Email me a sign-in link", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "exact reset time is unavailable" }).waitFor();
  assert.equal(await page.locator('[aria-live="off"]').count(), 0);
  evidence.push("Generic project/email quota shows reset time unavailable without invented countdown");

  let qrClosed = false, qrWrites = 0, malformedClose = true;
  await page.route("**/api/v1/tournaments/*/event-check-in", async (route) => {
    const body = route.request().postDataJSON();
    if (body.action === "close") { if(malformedClose) await route.fulfill({ json: { status: "closed" } }); else { qrClosed = true; await route.fulfill({ json: { status: "event_check_in_closed", eventId: id, version: 2, unresolvedCount: 0 } }); } }
    else { qrWrites++; await route.fulfill(qrClosed ? { status: 409, json: { status: "rejected", code: "check_in_closed" } } : { json: { status: "issued", url: "https://synthetic.invalid/#fixture", expiresAt: new Date(Date.now() + 60000).toISOString() } }); }
  });
  await page.goto(`${base}?view=qr`);
  await page.getByRole("img", { name: "Live check-in QR code for Main" }).waitFor();
  await page.getByRole("button", { name: "Close event check-in" }).click();
  await page.getByText("The check-in change could not be confirmed. Refresh to review its current state.").waitFor();
  assert.equal(await page.getByRole("img", { name: "Live check-in QR code for Main" }).count(), 1);
  malformedClose = false;
  await page.getByRole("button", { name: "Close event check-in" }).click();
  await page.getByText("Event check-in closed. Its live QR code has been removed.").waitFor();
  assert.equal(await page.getByText("The live QR code could not be refreshed.", { exact: false }).count(), 0);
  assert.equal(qrWrites, 1);
  evidence.push("Intentional event close removes QR without refresh-failure warning even while old open props remain");

  let scheduleWrites = [], startWrites = [], startMode = "uncertain";
  await page.route("**/api/v1/tournaments/*/event-schedule", async (route) => { const request=route.request().postDataJSON();scheduleWrites.push(request);await route.fulfill({json:{status:'event_schedule_published',eventId:id,gameCount:12,participantCount:2,matchCount:12,publicationId:id}}); });
  await page.goto(`${base}?view=schedule`);
  await page.getByLabel("Or paste CSV").fill("Game,Player A ID,Player B ID,Player A Table/Seat,Player B Table/Seat\n"+Array.from({length:12},(_,index)=>`${index+1},A-1,A-2,A-1,A-2`).join("\n"));
  await page.getByRole("checkbox",{name:"I reviewed the complete schedule",exact:false}).check();
  await page.getByRole("button",{name:"Publish Game Schedule",exact:true}).click();
  await page.getByText("12 games and 12 matchups published.",{exact:true}).waitFor();
  assert.equal(scheduleWrites.length,1); assert.equal(scheduleWrites[0].matches.length,12);
  await page.route("**/api/v1/tournaments/*/event-start", async (route) => {const request=route.request().postDataJSON();startWrites.push(request);await new Promise(resolve=>setTimeout(resolve,200));await route.fulfill(startMode==='accepted'?{json:{status:'event_started',eventId:id,startId:id,participantCount:2,gameCount:12,scheduleMatchCount:12,playState:'in_progress'}}:startMode==='retired'?{status:409,json:{status:'rejected',code:'event_retired'}}:startMode==='malformed'?{json:{status:'event_started',eventId:id}}:{status:503,json:{}});});
  await page.goto(`${base}?view=schedule-ready`);
  assert.equal(await page.getByRole("button",{name:"Start Main Event",exact:true}).isDisabled(),true);
  await page.getByRole("checkbox",{name:"I confirm registration is closed",exact:false}).check();
  await page.getByRole("button",{name:"Start Main Event",exact:true}).click();
  await page.getByRole("button",{name:"Retry Exact Event Start",exact:true}).waitFor();
  assert.equal(await page.getByRole("combobox").first().isDisabled(),true);
  await page.goto(`${base}?view=schedule-started`);
  startMode='malformed';
  await page.getByRole("button",{name:"Retry Exact Event Start",exact:true}).click();
  await page.getByRole("button",{name:"Retry Exact Event Start",exact:true}).waitFor();
  startMode='accepted';
  await page.goto(`${base}?view=schedule-ready`);
  await page.getByRole("button",{name:"Retry Exact Event Start",exact:true}).click();
  await page.getByRole("button",{name:"Event Started",exact:true}).waitFor();
  assert.equal(await page.getByRole("button",{name:"Event Started",exact:true}).isDisabled(),true);
  assert.equal(startWrites.length,3); assert.deepEqual(startWrites[0],startWrites[1]);assert.deepEqual(startWrites[0],startWrites[2]);
  evidence.push("Twelve-game CSV publishes; start requires confirmation, locks event selection, preserves exact request through uncertain/malformed responses and refreshed In Progress, and latches accepted success with stale props");
  const retiredRequest={...startWrites[0],idempotencyKey:'30000000-0000-4000-8000-000000000003'};
  await page.evaluate(({key,request})=>sessionStorage.setItem(key,JSON.stringify({kind:'event-start',request})),{key:`event-start:${id}:${id}`,request:retiredRequest});
  startMode='retired';
  await page.goto(`${base}?view=schedule-retired`);
  await page.getByRole("button",{name:"Retry Exact Event Start",exact:true}).click();
  await page.getByText("This event is no longer available for play",{exact:false}).waitFor();
  assert.equal(startWrites.length,4); assert.deepEqual(startWrites[3],retiredRequest);
  evidence.push("Retired/missing event retains reachable exact recovery and clears only on explicit retired rejection");

  savedSetup=null; setupVersion=0;
  await page.evaluate(({key,id})=>sessionStorage.setItem(key,JSON.stringify({status:'tournament_created',tournamentId:id,tournamentName:'Accepted receipt fallback',tournamentDate:'02-03-2027'})),{key:`tournament-creation-seed:${id}:${id}`,id});
  await page.goto(`${base}?view=setup-no-seed`);
  await page.getByLabel("Tournament name",{exact:true}).waitFor();
  assert.equal(await page.getByLabel("Tournament name",{exact:true}).inputValue(),'Accepted receipt fallback');
  assert.equal(await page.getByLabel("Start date",{exact:false}).first().inputValue(),'2027-02-03');
  assert.equal(await page.getByLabel("Start time",{exact:true}).inputValue(),'');
  evidence.push("Unavailable chooser seed falls back only to actor/tournament-scoped accepted creation receipt without inventing time");
  let enrollmentWrites=0;
  await page.route('**/api/v1/tournaments/*/event-roster-enrollment',async route=>{enrollmentWrites++; await route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({status:'rejected',code:'event_already_started'})});});
  await page.goto(base+'?view=participants');
  await page.getByRole('button',{name:'Select all not enrolled',exact:true}).click();
  await page.getByRole('button',{name:'Enroll selected players',exact:true}).click();
  await page.getByRole('status').filter({hasText:'this event has already started'}).waitFor();
  assert.equal(enrollmentWrites,1);
  assert.equal(await page.getByRole('button',{name:'Retry exact saved enrollment',exact:true}).count(),0);
  assert.equal(await page.evaluate(key=>sessionStorage.getItem(key),'event-roster-enrollment:'+id+':'+id),null);
  evidence.push('Started-event enrollment rejects terminally with correction guidance and clears exact pending request');
  console.log(JSON.stringify({ passed: evidence }, null, 2));
} catch (error) { console.error(error); console.error(logs.slice(-8000)); process.exitCode = 1; }
finally {
  if (browser) await browser.close();
  child.kill();
  await new Promise((resolve) => { if (child.exitCode !== null) resolve(); else { child.once("exit", resolve); setTimeout(resolve, 1500); } });
  await writeFile(path.join(fixture, "server.log"), logs);
  await writeFile(path.join(fixture, "evidence.json"), JSON.stringify(evidence, null, 2));
  // Keep generated fixture TSX/types outside the application checkout so normal
  // tsc/build checks see production sources only. Preserve screenshots and logs.
  const evidencePath = path.join(path.dirname(root), `director-browser-evidence-${Date.now()}`);
  await rename(fixture, evidencePath);
  console.log(`Browser evidence: ${evidencePath}`);
}
