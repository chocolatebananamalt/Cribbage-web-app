import {restoreIntegratedHistory} from './helpers/restore-integrated-history.mjs';
import {isolatedApplicationTestEnvironment} from './helpers/isolated-application-test-environment.mjs';
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

restoreIntegratedHistory();

const files = readdirSync("tests")
  .filter((name) => name.endsWith(".test.mjs") && !["workspace.test.mjs", "handoff.test.mjs"].includes(name))
  .sort()
  .map((name) => `tests/${name}`);

const result = spawnSync(process.execPath, ["--conditions=react-server", "--experimental-strip-types", "--test", ...files], {
  stdio: "inherit",
  env: isolatedApplicationTestEnvironment(process.env),
});

process.exit(result.status ?? 1);
