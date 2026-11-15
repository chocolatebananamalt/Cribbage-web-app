import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("scripts/check-live-demo.mjs", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

test("live demo release check is explicit, responsive, read-only, and failure-sensitive", () => {
  assert.equal(packageJson.scripts["verify:live-demo"], "node scripts/check-live-demo.mjs");
  assert.match(source, /https:\/\/cribbage-web-app\.vercel\.app/);
  assert.match(source, /for \(const width of \[320, 640, 1280\]\)/);
  assert.match(source, /securitypolicyviolation/);
  assert.match(source, /response\.status\(\) >= 400/);
  assert.match(source, /scrollWidth > document\.documentElement\.clientWidth/);
  assert.match(source, /Submit My Entry/);
  assert.match(source, /120 seats available/);
  assert.match(source, /emulateMedia\(\{ media: "print" \}\)/);
  assert.match(source, /page\.pdf\(\{ format: "Letter"/);
  assert.match(source, /PDFDocument\.load/);
  assert.match(source, /sample\/qualifiers-summary\.pdf/);
  assert.match(source, /public tournament registration/);
  assert.match(source, /director registration-link management/);
  assert.match(source, /tournament setup activation/);
  assert.match(source, /event finalization readiness/);
  assert.match(source, /Satellite no-MRP\/no-qualification boundary is missing/);
  assert.doesNotMatch(source, /request\.(post|put|patch|delete)|page\.(request|evaluate)\([^)]*fetch/i);
});
