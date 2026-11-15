// Render the actual root/demo pages with only their server data adapters mocked.
// Local synthetic identities only; no credentials or external backend access.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile, rename, copyFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { chromium } from "playwright-core";

const root = process.cwd(), fixture = path.join(root, "test-results/home-landing");
const id = "10000000-0000-4000-8000-000000000001", base = "http://127.0.0.1:3218";
const trace = path.join(fixture, "adapter-calls.jsonl");
await mkdir(path.join(fixture, "app/demo"), { recursive: true });
await mkdir(path.join(fixture, "app/tournament/[id]"), { recursive: true });
await mkdir(path.join(fixture, "public/branding"), { recursive: true });
await copyFile(path.join(root, "public/branding/acc-logo.jpg"), path.join(fixture, "public/branding/acc-logo.jpg"));
await writeFile(path.join(fixture, "package.json"), JSON.stringify({ private: true, type: "module" }));
await writeFile(path.join(fixture, "next.config.mjs"), `export default {turbopack:{root:${JSON.stringify(root)}}};`);
await writeFile(path.join(fixture, "app/layout.tsx"), `import '../../../src/app/globals.css'; export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}`);
let home = await readFile(path.join(root, "src/app/page.tsx"), "utf8");
home = home.replaceAll('"../components/', '"../../../src/components/');
for (const adapter of ["auth/current-subject", "director-administration", "tournaments/accessible-tournaments"]) home = home.replace(`"../lib/${adapter}"`, '"./fixture-data"');
await writeFile(path.join(fixture, "app/page.tsx"), home);
const demo = await readFile(path.join(root, "src/app/demo/page.tsx"), "utf8");
await writeFile(path.join(fixture, "app/demo/page.tsx"), demo.replace('"../tournament-dashboard"', '"../../../../src/app/tournament-dashboard"'));
await writeFile(path.join(fixture, "app/fixture-data.ts"), `
import {cookies} from 'next/headers';
import {appendFile} from 'node:fs/promises';
async function record(method:string,subject:string){
 const expected=(await cookies()).get('fixture_role')?.value;
 if(!expected || subject!==expected)throw new Error('Fixture actor mismatch');
 await appendFile(${JSON.stringify(trace)},JSON.stringify({method,subject})+'\\n');
}
export async function getCurrentSubject(){return (await cookies()).get('fixture_role')?.value ?? null;}
export async function getAccessibleTournaments(subject:string){
 await record('tournaments',subject);
 if(subject==='unavailable')return {status:'unavailable'};
 return {status:'available',tournaments:subject==='empty'?[]:[{tournamentId:'${id}',tournamentName:'Fictional '+subject+' tournament',tournamentDate:'12-16-2026',tournamentStatus:'open',effectiveRole:subject==='director'?'director':'player'}]};
}
export async function getDirectorAccessWorkspace(subject:string){await record('director',subject);return {canCreateTournament:subject==='director',isPlatformAdmin:false,administratorType:null,directorStatus:subject==='director'?'approved':null,accVerified:false,pendingApplicationId:null};}
`);
// Navigation destination is a stub: this suite proves chooser routing, not scoring.
await writeFile(path.join(fixture, "app/tournament/[id]/page.tsx"), `import Link from 'next/link';export default function Workspace(){return <main><h1>Fictional workspace</h1><Link href="/">Back to Your Tournaments</Link></main>}`);
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", fixture, "--hostname", "127.0.0.1", "--port", "3218"], { cwd: root, env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" }, stdio: ["ignore", "pipe", "pipe"] });
let logs = "", browser, activePage;
child.stdout.on("data", chunk => { logs += chunk; }); child.stderr.on("data", chunk => { logs += chunk; });
const evidence = [];
const signedInHeading = /^You['\u2019]re signed in$/;
try {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) { try { if ((await fetch(base)).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 500)); }
  browser = await chromium.launch({ channel: "chrome", headless: true });
  for (const role of [null, "director", "player", "empty", "unavailable"]) {
    await writeFile(trace, "");
    const context = await browser.newContext();
    await context.route("**/*", route => route.request().url().startsWith(base) ? route.continue() : route.abort());
    if (role) await context.addCookies([{ name: "fixture_role", value: role, url: base }]);
    const page = await context.newPage();
    activePage = page;
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 }); await page.goto(base);
      await page.getByRole("heading", { name: role ? signedInHeading : "Tournament access", exact: true }).waitFor();
      assert.equal(await page.getByRole("heading", { name: role ? signedInHeading : "Tournament access", exact: true }).count(), 1);
      assert.equal(await page.getByText("Sample Cribbage Classic", { exact: false }).count(), 0);
      assert.equal(await page.getByRole("link", { name: "Create Tournament", exact: true }).count(), role === "director" ? 1 : 0);
      if (!role) assert.equal(await page.getByRole("link", { name: "Sign in by email", exact: true }).count(), 1);
      if (role === "empty") assert.equal(await page.getByRole("heading", { name: "No tournament access yet", exact: true }).count(), 1);
      if (role === "unavailable") assert.equal(await page.getByRole("heading", { name: "Tournaments are temporarily unavailable", exact: true }).count(), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: path.join(fixture, `${role ?? "anonymous"}-${width}.png`), fullPage: true });
    }
    if (role === "director" || role === "player") {
      const choice = page.getByRole("link", { name: new RegExp(`Fictional ${role} tournament`) });
      assert.equal(await choice.getAttribute("href"), `/tournament/${id}`);
      await choice.click(); await page.waitForURL(`**/tournament/${id}`); await page.goBack();
      await page.getByRole("heading", { name: "Your tournaments", exact: true }).waitFor();
      assert.equal(await page.getByRole("heading", { name: "Your tournaments", exact: true }).count(), 1);
      await page.reload(); await choice.waitFor(); assert.equal(await choice.count(), 1);
      await page.getByRole("link", { name: "Explore the demonstration", exact: true }).click();
    } else await page.goto(`${base}/demo`);
    await page.getByRole("complementary", { name: "Demonstration notice" }).waitFor();
    assert.equal(await page.getByRole("complementary", { name: "Demonstration notice" }).count(), 1);
    assert.equal(await page.getByRole("button", { name: "Score Entry", exact: true }).count(), 1);
    await page.reload();
    await page.getByRole("complementary", { name: "Demonstration notice" }).waitFor();
    assert.equal(await page.getByRole("complementary", { name: "Demonstration notice" }).count(), 1);
    await page.goBack();
    await page.getByRole("heading", { name: role ? signedInHeading : "Tournament access", exact: true }).waitFor();
    await page.reload();
    await page.getByRole("heading", { name: role ? signedInHeading : "Tournament access", exact: true }).waitFor();
    assert.equal(await page.getByRole("heading", { name: role ? signedInHeading : "Tournament access", exact: true }).count(), 1);
    const calls = (await readFile(trace, "utf8")).trim().split("\n").filter(Boolean).map(line => JSON.parse(line));
    if (!role) assert.equal(calls.length, 0, "anonymous root must not query private adapters");
    else {
      assert.ok(calls.some(call => call.method === "tournaments"));
      assert.ok(calls.some(call => call.method === "director"));
      assert.ok(calls.every(call => call.subject === role), "every private adapter receives the verified subject");
    }
    evidence.push(`${role ?? "unauthenticated"}: correct root at390/1440, refresh/navigation preserved, explicit demo remains available`);
    await context.close();
  }
  console.log(JSON.stringify({ passed: evidence }, null, 2));
} catch (error) {
  console.error(error);
  if (activePage && !activePage.isClosed()) {
    console.error(await activePage.locator("body").innerText());
    await activePage.screenshot({ path: path.join(fixture, "failure.png"), fullPage: true });
  }
  console.error(logs.slice(-8000)); process.exitCode = 1;
}
finally {
  if (browser) await browser.close(); child.kill();
  await new Promise(resolve => { if (child.exitCode !== null) resolve(); else { child.once("exit", resolve); setTimeout(resolve, 1500); } });
  await writeFile(path.join(fixture, "server.log"), logs);
  await writeFile(path.join(fixture, "evidence.json"), JSON.stringify(evidence, null, 2));
  const output = path.join(path.dirname(root), `home-landing-evidence-${Date.now()}`);
  await rename(fixture, output); console.log(`Browser evidence: ${output}`);
}
