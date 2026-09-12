import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const files = readdirSync("tests")
  .filter((name) => name.endsWith(".test.mjs") && !["workspace.test.mjs", "handoff.test.mjs"].includes(name))
  .sort()
  .map((name) => `tests/${name}`);

const result = spawnSync(process.execPath, ["--conditions=react-server", "--experimental-strip-types", "--test", ...files], {
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 1);
