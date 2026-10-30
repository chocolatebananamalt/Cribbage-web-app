// Local-only synthetic component rehearsal. No credentials or live backend.
// Run: node tests/director-browser.mjs (starts an isolated localhost fixture).
import { mkdir, writeFile, rename, copyFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { qSetupPrizeWorkspace } from "./fixtures/q-setup-prize-workspace.mjs";
import { isSetupWorkspace } from "../src/lib/api/setup.ts";

const root = process.cwd(), fixture = path.join(root, "test-results/q-setup-prize-browser");
await mkdir(path.join(fixture, "app"), { recursive: true });
await writeFile(path.join(fixture, "package.json"), JSON.stringify({ private: true, type: "module" }));
await writeFile(path.join(fixture, "next.config.mjs"), `export default {turbopack:{root:${JSON.stringify(root)}}};`);
await writeFile(path.join(fixture, "app/layout.tsx"), `import '../../../src/app/globals.css'; import {RecoveryDocumentBoundary} from '../../../src/components/recovery-document-boundary'; export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body><RecoveryDocumentBoundary actorId="10000000-0000-4000-8000-000000000001">{children}</RecoveryDocumentBoundary></body></html>}`);
await mkdir(path.join(fixture, "public"), { recursive: true });
await copyFile(path.join(root, "public/offline-score-sw.js"), path.join(fixture, "public/offline-score-sw.js"));
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
import ActivationWorkspaceClient from '../../../src/app/tournament/[tournamentId]/account-activations/activation-workspace-client';
import {ActivationWitness} from '../../../src/components/activation-witness';
import SetupOfficialsClient from '../../../src/app/tournament/[tournamentId]/setup/officials/[role]/setup-officials-client';
import OfficialInvitationClient from '../../../src/app/official-invitations/[secret]/official-invitation-client';
export default async function Page({searchParams}:{searchParams:Promise<{view?:string}>}){const {view}=await searchParams;
if(view==='officials')return <main className="auth-shell"><section className="auth-card corrections-card wide-card"><SetupOfficialsClient tournamentId="${id}" role="cross_checker" initial={{tournamentName:'TEST ONLY mixed',role:'cross_checker',canManage:true,capacity:12,entries:[{nominationId:'${id}',displayName:'TEST ONLY Pending Official',firstName:'TEST ONLY',lastName:'Pending Official',email:'pending@test.invalid',accNumber:'ZZ122',status:'invitation_email_sent',profileId:null}]}}/></section></main>;
if(view==='official-invitation-signed-out'||view==='official-invitation-legacy')return <main className="auth-shell"><section className="auth-card"><OfficialInvitationClient invitationId={view==='official-invitation-legacy'?'x'.repeat(64):'${id}'} initial={null} signedIn={view!=='official-invitation-signed-out'} legacy={view==='official-invitation-legacy'}/></section></main>;
if(view==='official-invitation'||view==='official-invitation-unavailable'||view==='official-invitation-accepted')return <main className="auth-shell"><section className="auth-card"><OfficialInvitationClient invitationId="${id}" initial={view==='official-invitation-unavailable'?null:{status:view==='official-invitation-accepted'?'accepted':'pending',nominationId:'${id}',tournamentName:'TEST ONLY mixed tournament',role:'cross_checker',expiresAt:'2030-01-01T00:30:45.000Z'}}/></section></main>;
if(view==='activation-player'||view==='activation-player-legacy')return <main className="auth-shell"><section className="auth-card"><ActivationWitness pending={{status:'pending',activationId:'${id}',requestId:'${id}',confirmationPhrase:'ABCD-EFGH',...(view==='activation-player'?{expiresAt:'2030-01-01T00:30:45.000Z'}:{})}}/></section></main>;
if(view==='activation-expired')return <main className="auth-shell"><section className="auth-card corrections-card"><ActivationWorkspaceClient tournamentId="${id}" workspace={{tournamentName:'Synthetic expired request',pendingRequests:[],rosterEntries:[{rosterEntryId:'${id}',displayName:'TEST ONLY Expired Player',activation:{activationId:'${id}',state:'expired',expiresAt:'2026-01-01T00:00:00Z'}}]}}/></section></main>;
if(view==='activation-witness')return <main className="auth-shell"><section className="auth-card corrections-card"><ActivationWorkspaceClient tournamentId="${id}" workspace={{tournamentName:'Synthetic witness fixture',rosterEntries:[],pendingRequests:[{requestId:'${id}',activationId:'${id}',rosterEntryId:'${id}',rosterDisplayName:'TEST ONLY Player A',requestedAt:'2026-10-26T00:00:00Z',expiresAt:'2027-01-01T00:00:00Z',canApprove:false},{requestId:'20000000-0000-4000-8000-000000000002',activationId:'20000000-0000-4000-8000-000000000002',rosterEntryId:'20000000-0000-4000-8000-000000000002',rosterDisplayName:'TEST ONLY Player B',requestedAt:'2026-10-26T00:00:00Z',expiresAt:'2027-01-01T00:00:00Z',canApprove:true}]}}/></section></main>;
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
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", fixture, "--hostname", "127.0.0.1", "--port", "3260"], { cwd: root, env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_SUPABASE_URL: "https://synthetic.invalid", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "synthetic-not-a-credential" }, stdio: ["ignore", "pipe", "pipe"] });
let logs = ""; child.stdout.on("data", (data) => { logs += data; }); child.stderr.on("data", (data) => { logs += data; });
const base = "http://127.0.0.1:3260";
let browser, page;
const evidence = [];
try {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) { try { if ((await fetch(base)).ok) break; } catch {} await new Promise((resolve) => setTimeout(resolve, 500)); }
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext();
  // Reject every external call. The only auth replies below are local mocks.
  await context.route("**/*", async (route) => { if (!route.request().url().startsWith(base)) await route.abort(); else await route.continue(); });
  page = await context.newPage();
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
    const request = route.request().postDataJSON(); activationWrites.push(request); await new Promise(resolve => setTimeout(resolve, 400));
    return route.fulfill({ json: { status: "tournament_setup_activated", setupRevisionId: request.setupRevisionId, setupVersion: request.expectedVersion, eventCount: 1, events: [{ activationId: id, setupEventVersionId: id, rulesetVersionId: id, eventId: id, eventType: "main", name: "Main Event", format: "standard_singles", scoringMethod: "digital", gameCount: 12 }], roundsCreated: false, participantsEnrolled: false, seatingUpdated: false, financeUpdated: false, resultsUpdated: false, payoutsCalculated: false, qualifiersCalculated: false, accSubmissionCreated: false, registrationState: "open" } });
  });
  await page.route("**/api/v1/tournaments/*/setup-officials/**", (route) => route.fulfill({ status: 503, json: {} }));

  await page.route('**/setup/prize-schedules/*',route=>{
    const rowId=route.request().url().split('/').at(-1);
    return route.fulfill({json:{tournamentId:id,clientRowId:rowId,currentVersion:0,activated:false,eventId:null,settingsCurrent:true,versions:[]}});
  });
  for(const width of [390,1440]){
    const foundation = qSetupPrizeWorkspace(id);
    assert.equal(isSetupWorkspace(foundation), true, 'fixture uses a valid saved server workspace');
    savedSetup=foundation.current;setupVersion=1;
    await page.setViewportSize({width,height:1000});
    await page.goto(base+'?view=setup');
    await page.getByRole('combobox',{name:/^Games/}).waitFor();
    await page.getByRole('combobox',{name:/^Games/}).selectOption('12');
    await page.getByRole('textbox',{name:/^Entry fee/}).fill('30.00');
    await page.getByRole('region',{name:'Main prize schedule',exact:true}).waitFor();
    await page.getByRole('button',{name:'Add Q Pool',exact:true}).click();
    const pool=page.getByRole('group',{name:'Q Pool 1',exact:true});
    await pool.getByRole('combobox',{name:/^Pool type/}).selectOption({label:'Graduated (1-in-6)'});
    await pool.getByRole('textbox',{name:/^Entry fee/}).fill('10.00');
    assert.equal(await page.getByRole('region',{name:'Main prize schedule',exact:true}).count(),1,'Q does not hide regular prizes');
    await page.getByRole('button',{name:'Save All Events Draft',exact:true}).click();
    await page.getByText('Tournament setup version 2 was saved.',{exact:true}).waitFor();
    await page.getByRole('combobox',{name:/^Expected playoff qualifiers/}).selectOption('5');
    for(const [name,value]of[['1st place weight','4'],['2nd place weight','3'],['3rd–4th per-person weight','2'],['5th place weight','1']])await page.getByRole('spinbutton',{name,exact:true}).fill(value);
    await page.getByLabel('Estimated entry count',{exact:true}).fill('17');
    await page.getByLabel('Estimated total expenses (USD)',{exact:true}).fill('229.50');
    await page.getByText('Estimated gross $510.00, expenses $229.50, prize budget $280.50.',{exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Finalize All Events / Open Registration',exact:true}).isDisabled(),true,'visible unresolved prize schedule blocks');
    const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(size.scroll<=size.width+1);
    await page.screenshot({path:path.join(fixture,`q-base-prizes-${width}.png`),fullPage:true});
    await page.getByRole('combobox',{name:/^Games/}).selectOption('9');
    assert.equal(await page.getByRole('region',{name:'Main prize schedule',exact:true}).count(),0);
    assert.equal(await page.getByRole('button',{name:'Finalize All Events / Open Registration',exact:true}).isDisabled(),true,'unsaved changes still block');
    await page.getByRole('button',{name:'Save All Events Draft',exact:true}).click();
    await page.getByText('Tournament setup version 3 was saved.',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Finalize All Events / Open Registration',exact:true}).waitFor({state:'visible'});
    assert.equal(await page.getByRole('button',{name:'Finalize All Events / Open Registration',exact:true}).isEnabled(),true,'hidden editor stale flag ignored without reload');
    await page.getByRole('button',{name:'Finalize All Events / Open Registration',exact:true}).click();
    await page.getByRole('alertdialog').getByRole('button',{name:'Cancel',exact:true}).click();
    assert.equal(activationWrites.length,0,'no activation sent by dialog review');
    evidence.push(`${width}px: Q base-prize editor visible, five weights and $280.50 base-only preview, unresolved/dirty block, unsupported hidden editor no stale block, zero activation writes`);
  }
  console.log(JSON.stringify({passed:evidence},null,2));
}catch(error){console.error(error);console.error(logs.slice(-8000));if(page){await writeFile(path.join(fixture,'failure-dom.txt'),await page.locator('body').innerText().catch(()=>''));await page.screenshot({path:path.join(fixture,'failure.png'),fullPage:true}).catch(()=>{});}process.exitCode=1;}
finally{await browser?.close();child.kill();await new Promise(resolve=>{if(child.exitCode!==null)resolve();else{child.once('exit',resolve);setTimeout(resolve,1500)}});await writeFile(path.join(fixture,'server.log'),logs);await writeFile(path.join(fixture,'evidence.json'),JSON.stringify(evidence,null,2));await writeFile(path.join(root,'test-results/q-setup-prize-browser-cleanup.json'),JSON.stringify({pid:child.pid,exitCode:child.exitCode,signal:child.signalCode},null,2));const evidencePath=path.join(path.dirname(root),`q-setup-prize-browser-evidence-${Date.now()}`);await rename(fixture,evidencePath);console.log(`Browser evidence: ${evidencePath}`);}
