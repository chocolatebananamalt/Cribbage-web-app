import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const packetPath = new URL(
  "../docs/operations/PILOT_MIGRATION_PACKET_0090_0105.md",
  import.meta.url,
);
const migrationRoot = new URL("../database/migrations/", import.meta.url);

test("shared-pilot packet pins the exact 0090 through 0105 migration bytes", () => {
  const packet = readFileSync(packetPath, "utf8");
  const rows = [...packet.matchAll(
    /^\| (\d{4}) \| `([^\`]+\.sql)` \| `([a-f0-9]{64})` \|/gm,
  )];

  assert.equal(rows.length, 16, "packet must contain one checksum row for every migration");
  assert.deepEqual(
    rows.map(([, order]) => order),
    Array.from({ length: 16 }, (_, index) => String(90 + index).padStart(4, "0")),
  );

  for (const [, order, fileName, expectedHash] of rows) {
    assert.ok(fileName.startsWith(`${order}_`), `${fileName} must match packet order ${order}`);
    const actualHash = createHash("sha256")
      .update(readFileSync(new URL(fileName, migrationRoot)))
      .digest("hex");
    assert.equal(actualHash, expectedHash, `${fileName} checksum must match reviewed source bytes`);
  }
});
