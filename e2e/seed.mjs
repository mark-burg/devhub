#!/usr/bin/env node
// Seeds e2e/.data with the demo runs (real Allure 3 reports) unless it already exists.
// Pass --force to re-seed.

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const data = fileURLToPath(new URL(".data", import.meta.url));
if (existsSync(`${data}/data/manifest.json`) && !process.argv.includes("--force")) {
  console.log("e2e/.data already seeded (pass --force to re-seed)");
  process.exit(0);
}
const demo = fileURLToPath(new URL("../scripts/demo.mjs", import.meta.url));
const r = spawnSync(process.execPath, [demo, "--site", data], { stdio: "inherit" });
process.exit(r.status ?? 1);
