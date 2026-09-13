import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const baseUrl = (process.env.LIVE_DEMO_BASE_URL || "https://cribbage-web-app.vercel.app").replace(/\/$/, "");
const executableCandidates = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);
const executablePath = executableCandidates.find(existsSync);
if (!executablePath) throw new Error("Chrome or Chromium was not found. Set PLAYWRIGHT_CHROMIUM_EXECUTABLE to its full path.");

async function clickButton(page, label, contains = false) {
  const buttons = page.locator("button");
  for (let index = 0; index < await buttons.count(); index += 1) {
    const button = buttons.nth(index);
    const text = (await button.innerText()).trim();
    if (contains ? text.includes(label) : text === label) {
      if (await button.isDisabled()) throw new Error(`Required control is disabled: ${label}`);
      await button.click();
      return;
    }
  }
  throw new Error(`Required control is missing: ${label}`);
}

async function verifyViewport(browser, width) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  page.setDefaultTimeout(8_000);
  const failures = [];
  page.on("console", (message) => { if (message.type() === "error") failures.push(`console: ${message.text()}`); });
  page.on("pageerror", (error) => failures.push(`page: ${error.message}`));
  page.on("response", (response) => { if (response.status() >= 400) failures.push(`http ${response.status()}: ${response.url()}`); });
  await page.addInitScript(() => document.addEventListener("securitypolicyviolation", (event) => {
    window.__accCspViolations = [...(window.__accCspViolations || []), `${event.violatedDirective}: ${event.blockedURI}`];
  }));

  const response = await page.goto(`${baseUrl}/demo`, { waitUntil: "networkidle" });
  if (!response || response.status() !== 200) throw new Error(`Demo returned HTTP ${response?.status() ?? "no response"}.`);
  const screens = [];
  const capture = async () => {
    const title = await page.locator("main h1").first().innerText();
    const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    if (overflows) throw new Error(`Page overflows horizontally at ${width}px on ${title}.`);
    screens.push(title);
  };

  await capture();
  await clickButton(page, "Demo Player won");
  await clickButton(page, "8");
  await clickButton(page, "8");
  if (!(await page.getByRole("button", { name: "Review Result" }).isEnabled())) throw new Error("Valid score did not enable review.");
  if (!/Double skunk/i.test(await page.locator("main").innerText())) throw new Error("The 88-point demo result did not show the expected informal band.");
  await clickButton(page, "Review Result"); await capture();
  await clickButton(page, "Submit My Entry");
  if (!/waiting for the sample opponent/i.test(await page.locator("main").innerText())) throw new Error("Submitted entry did not enter the opponent-pending state.");
  await clickButton(page, "Scorecard"); await capture();
  if (!/Verification Pending Opponent Entry/.test(await page.locator("main").innerText())) throw new Error("Pending scorecard status is missing.");
  await clickButton(page, "Operations"); await capture();
  await clickButton(page, "Set Up Tournament", true); await capture();
  await clickButton(page, "View Flyer Import Format"); await capture();
  await clickButton(page, "Previous Screen"); await clickButton(page, "Back to Operations");
  await clickButton(page, "Players & Check-In", true); await capture();
  await page.getByLabel("Search player name").fill("Paper");
  if (!/Showing 1 of 4/.test(await page.locator("main").innerText())) throw new Error("Check-in search did not filter the sample roster.");
  await clickButton(page, "Back to Operations");
  await clickButton(page, "Seating", true); await capture();
  await page.getByLabel("Tables").fill("6"); await page.getByLabel("Seats per table").fill("20");
  if (!/120 seats available/.test(await page.locator("main").innerText())) throw new Error("Dynamic table capacity did not update.");
  await clickButton(page, "Table Plan"); await capture();
  if (!/Table F \/ Last Table/.test(await page.locator("main").innerText())) throw new Error("Dynamic last-table label did not update.");
  await clickButton(page, "Review Table F Constraints"); await capture();
  await clickButton(page, "Previous Screen"); await clickButton(page, "Previous Screen"); await clickButton(page, "Back to Operations");
  await clickButton(page, "Cross Check", true); await capture();
  if (!/Paper-card photo aid/.test(await page.locator("main").innerText())) throw new Error("Paper-card photo aid is missing.");
  await clickButton(page, "Back to Operations"); await clickButton(page, "Tournament Events and Flyer", true); await capture();
  await clickButton(page, "Preview Flyer Format"); await capture(); await clickButton(page, "Preview Flyer"); await capture();
  await clickButton(page, "Operations"); await clickButton(page, "Financials", true); await capture();
  await clickButton(page, "Results"); await capture(); await clickButton(page, "Main Event", true); await capture();
  await clickButton(page, "View Qualifiers"); await capture();
  if (await page.getByRole("link", { name: "Open Sample Qualification PDF" }).count() !== 1) throw new Error("Qualification PDF link is missing.");
  await clickButton(page, "Previous Screen"); await clickButton(page, "Previous Screen"); await clickButton(page, "Satellite Events", true); await capture();
  if (!/Qualification Rules Pending/.test(await page.locator("main").innerText())) throw new Error("Satellite fail-closed boundary is missing.");
  await clickButton(page, "Rulebook"); await capture(); await clickButton(page, "Quick Reference Search"); await capture();
  await page.getByPlaceholder("For example: cross-checking").fill("cross-checking");
  if (!/Scorecards and cross-checking/.test(await page.locator("main").innerText())) throw new Error("Quick-reference search did not filter.");

  const csp = await page.evaluate(() => window.__accCspViolations || []);
  failures.push(...csp.map((violation) => `csp: ${violation}`));
  await page.close();
  if (failures.length) throw new Error(`${width}px browser failures:\n${failures.join("\n")}`);
  return { width, screenVisits: screens.length, distinctScreens: new Set(screens).size };
}

const browser = await chromium.launch({ headless: true, executablePath });
try {
  const results = [];
  for (const width of [320, 1280]) results.push(await verifyViewport(browser, width));
  console.log(`Live demo verification passed for ${baseUrl}.`);
  for (const result of results) console.log(`${result.width}px: ${result.screenVisits} visits across ${result.distinctScreens} distinct screens; no overflow, CSP, HTTP, console, or page errors.`);
} finally {
  await browser.close();
}
