#!/usr/bin/env node
// Seeds e2e/.data with the demo runs (real Allure 3 reports). Skips work only when a previous
// seed of the same version finished completely; pass --force to re-seed anyway.

import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Bump SEED_VERSION when demo.mjs output changes in a way the tests depend on.
// The Allure version is pinned so report UI text the tests look for can't change underneath them.
const ALLURE_VERSION = "3.18.0";
const SEED_VERSION = `1/allure-${ALLURE_VERSION}`;

const data = fileURLToPath(new URL(".data", import.meta.url));
const marker = `${data}/.seed-complete`;
const current = existsSync(marker) ? readFileSync(marker, "utf8").trim() : null;
if (current === SEED_VERSION && !process.argv.includes("--force")) {
  console.log(`e2e/.data already seeded (${SEED_VERSION}); pass --force to re-seed`);
  process.exit(0);
}

rmSync(data, { recursive: true, force: true });
const demo = fileURLToPath(new URL("../scripts/demo.mjs", import.meta.url));
// No placeholder fallback: the viewer tests need real Allure reports, so fail loudly instead.
const r = spawnSync(process.execPath, [demo, "--site", data, "--allure-version", ALLURE_VERSION, "--require-allure"], { stdio: "inherit" });
if (r.status !== 0) process.exit(r.status ?? 1);
writeFileSync(marker, `${SEED_VERSION}\n`);
