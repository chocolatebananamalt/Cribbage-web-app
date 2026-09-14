import { existsSync, readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const executablePath = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
].filter(Boolean).find(existsSync);
if (!executablePath) throw new Error("Chrome or Chromium was not found.");

const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const markup = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><main class="auth-shell"><section class="auth-card"><section class="policy-settings setup-workspace"><h2>Tournament details</h2><fieldset><div class="setup-grid"><label>Tournament name<input value=""></label><label>City<input value=""></label><label>Venue<input value=""></label><label>Starts<input type="datetime-local" value=""></label><label>ACC Sanctioning Fee<span class="money-input"><span aria-hidden="true">$</span><input inputmode="decimal" value=""></span></label></div></fieldset><div class="setup-heading"><div><h2>Tournament events</h2><p>Click Add Main Event to enter its event name, fees, date and time, included items, and Q Pools.</p></div><div class="setup-actions"><button type="button" class="secondary">Add Main Event</button></div></div><fieldset><fieldset class="setup-event"><legend>Main Event 1</legend><div class="setup-grid"><label>Event name<input value=""></label><label>Entry fee<span class="money-input"><span aria-hidden="true">$</span><input inputmode="decimal" value=""></span></label><label>Start date and time<input type="datetime-local" value=""></label><label>Fee includes<input value=""><span class="field-help">Coffee, donuts, lunch, etc.</span></label></div><section><h3>Q Pools</h3><p class="field-help">Click Add Q Pool to enter its type, entry fee, and optional note.</p><button type="button" class="secondary">Add Q Pool</button></section></fieldset></fieldset></section></section></main></body></html>`;

const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const width of [375, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const failures = [];
    page.on("console", (message) => { if (message.type() === "error") failures.push(message.text()); });
    page.on("pageerror", (error) => failures.push(error.message));
    await page.setContent(markup, { waitUntil: "load" });

    const inputs = page.locator(".setup-workspace input");
    for (let index = 0; index < await inputs.count(); index += 1) {
      const box = await inputs.nth(index).boundingBox();
      if (!box || box.width < 150 || box.height < 44) throw new Error(`${width}px setup input ${index + 1} rendered ${box?.width ?? 0}×${box?.height ?? 0}.`);
    }
    await page.getByLabel("Tournament name").fill("Full Rehearsal — 09-16-2026");
    await page.getByLabel("City").fill("Honolulu");
    await page.getByLabel("Venue").fill("Test Hall");
    await page.getByLabel("Starts").fill("2026-09-16T09:00");
    await page.getByLabel("ACC Sanctioning Fee").fill("25.00");
    await page.getByLabel("Event name").fill("Main Event");
    await page.getByLabel("Entry fee").fill("40.00");
    await page.getByLabel("Start date and time").fill("2026-09-16T10:00");
    await page.getByLabel("Fee includes").fill("Lunch");
    await page.getByRole("button", { name: "Add Q Pool" }).focus();

    const values = await page.locator(".setup-workspace input").evaluateAll((nodes) => nodes.map((node) => node.value));
    for (const required of ["Full Rehearsal — 09-16-2026", "Honolulu", "Test Hall", "2026-09-16T09:00", "25.00", "Main Event", "40.00", "2026-09-16T10:00", "Lunch"]) {
      if (!values.includes(required)) throw new Error(`${width}px setup input did not retain ${required}.`);
    }
    if (!(await page.getByText("Coffee, donuts, lunch, etc.", { exact: true }).isVisible())) throw new Error(`${width}px fee helper disappeared after typing.`);
    if (await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) throw new Error(`${width}px setup workspace overflowed horizontally.`);
    if (failures.length) throw new Error(`${width}px browser errors: ${failures.join("; ")}`);
    await page.close();
    console.log(`${width}px setup layout passed: full-size controls, retained values, persistent helper, no horizontal overflow or browser errors.`);
  }
} finally {
  await browser.close();
}
