import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("UTC date labels are deterministic across server and browser time zones", async () => {
  const { formatUtcDateTime } = await import(pathToFileURL(path.resolve("src/lib/date-time.ts")).href);
  assert.equal(formatUtcDateTime("2026-10-03T18:05:00.000Z"), "2026-10-03 18:05 UTC");
  assert.equal(formatUtcDateTime("not-a-date"), "not-a-date");
});

test("server-rendered client workspaces do not use environment-local date formatting", () => {
  const files = [
    "src/app/tournament/[tournamentId]/roster/registration-claim-review-client.tsx",
    "src/app/tournament/[tournamentId]/registration/registration-link-client.tsx",
    "src/app/tournament/[tournamentId]/account-activations/activation-workspace-client.tsx",
  ];
  for (const file of files) {
    const source = read(file);
    assert.match(source, /formatUtcDateTime/);
    assert.doesNotMatch(source, /\.toLocaleString\(\)/);
  }
});
