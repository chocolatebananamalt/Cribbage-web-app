import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";

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
    const owned = `${BASE}/${segment}/`;
    const linked = files.some((file) => !file.split("\\").join("/").startsWith(owned) && linksTo(readFileSync(file, "utf8"), segment));
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
