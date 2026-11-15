import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

// PostgreSQL's regular expression engine rejects a bound repetition count above
// 255. Going over does not make the pattern merely wrong, it makes it an invalid
// regular expression, and EVALUATING it raises at runtime:
//
//   ERROR: 2201B: invalid regular expression: invalid repetition count(s)
//
// Nothing catches this before it runs. It parses, it deploys, every test that
// reads the SQL as text passes, and the guard containing it then throws on every
// call regardless of input.
//
// That is exactly what happened to the registration QR link. Both
// issue_registration_link_v3 and rotate_registration_link_v3, and the CHECK
// constraint on app.registration_link_reveal_envelopes, validated the sealed
// ciphertext with '^[A-Za-z0-9_-]{24,1024}$'. The feature could never create a
// link, from the day 0203 shipped until 0228 on 2026-09-19, and the only symptom
// the director ever saw was "The registration link could not be created."
//
// Express the length bound as a comparison and keep the character class in the
// regex, which is what 0228 does.
const LIMIT = 255;

// Applied migrations are immutable, so the three occurrences in 0203 stay on
// disk exactly as they were applied; 0228 supersedes them in the live database.
// 0228 itself quotes the pattern once, as the text it searches for and replaces.
// Nothing else may match, and these counts are asserted so the allowance cannot
// silently absorb a new one.
const ALLOWED = new Map([
  ["0203_persistent_registration_link_reveal_and_name_parts.sql", 3],
  ["0228_registration_link_regex_exceeded_the_engine_limit.sql", 1],
]);

function findOverLimitBounds(sql) {
  const hits = [];
  sql.split(/\r?\n/).forEach((line, index) => {
    if (line.trimStart().startsWith("--")) return;
    for (const bound of line.matchAll(/\{\s*(\d+)\s*(?:,\s*(\d+)\s*)?\}/g)) {
      const counts = [bound[1], bound[2]].filter(Boolean).map(Number);
      if (counts.some((count) => count > LIMIT)) hits.push(`${index + 1}: ${line.trim().slice(0, 120)}`);
    }
  });
  return hits;
}

test("no new SQL regex uses a repetition count PostgreSQL cannot evaluate", () => {
  const unexpected = [];
  const counted = new Map();
  for (const name of readdirSync("database/migrations").filter((file) => file.endsWith(".sql"))) {
    const hits = findOverLimitBounds(readFileSync(`database/migrations/${name}`, "utf8"));
    if (!hits.length) continue;
    counted.set(name, hits.length);
    if (!ALLOWED.has(name)) unexpected.push(...hits.map((hit) => `${name}:${hit}`));
  }
  assert.deepEqual(
    unexpected,
    [],
    `a repetition count above ${LIMIT} raises "invalid repetition count(s)" the moment it is evaluated:\n${unexpected.join("\n")}`,
  );
  for (const [name, expected] of ALLOWED) {
    assert.equal(
      counted.get(name) ?? 0,
      expected,
      `${name} is allowed exactly ${expected} historical occurrence(s); a change here needs its own review`,
    );
  }
});

// The replacement must keep the bound out of the regex, where the engine limit
// does not apply.
test("the registration link ciphertext bound is a comparison, not a regex count", () => {
  const sql = readFileSync("database/migrations/0228_registration_link_regex_exceeded_the_engine_limit.sql", "utf8");
  assert.match(sql, /length\(p_reveal_ciphertext\) not between 24 and 1024/);
  assert.match(sql, /length\(ciphertext\) between 24 and 1024/);
  assert.match(sql, /add constraint registration_link_reveal_envelopes_ciphertext_check/);
});
