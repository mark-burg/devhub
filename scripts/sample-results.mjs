#!/usr/bin/env node
// Generates a realistic-looking allure-results directory without running any tests.
// Used by the demo seeder and the "Demo report" workflow so the hub can be exercised end to end.
//
//   node scripts/sample-results.mjs --out ./allure-results [--seed 7] [--fail-rate 0.06] [--suite web|api]

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  options: {
    out: { type: "string", default: "./allure-results" },
    seed: { type: "string", default: String(Date.now() % 100000) },
    "fail-rate": { type: "string", default: "0.06" },
    suite: { type: "string", default: "web" },
    "start-time": { type: "string" },
  },
});

// Deterministic PRNG so a given seed always yields the same run.
function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(Number(args.seed));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const failRate = Number(args["fail-rate"]);

const CATALOG = {
  web: {
    parentSuite: "Web E2E",
    framework: "playwright",
    features: {
      Authentication: ["Login with valid credentials", "Login with wrong password shows error", "Logout clears session", "Password reset email is sent", "Session expires after inactivity", "SSO redirect round-trip"],
      Search: ["Search returns relevant products", "Empty search shows suggestions", "Filters narrow results", "Sort by price ascending"],
      Cart: ["Add item to cart", "Remove item from cart", "Cart persists across reloads", "Quantity cannot go below one", "Apply valid coupon", "Reject expired coupon"],
      Checkout: ["Guest checkout completes", "Saved card checkout", "Address validation rejects bad ZIP", "Order confirmation email", "3-D Secure challenge flow"],
      Profile: ["Update display name", "Upload avatar", "Change notification preferences", "Delete account requires confirmation"],
    },
    params: [["browser", ["chromium", "firefox", "webkit"]]],
  },
  api: {
    parentSuite: "API",
    framework: "vitest",
    features: {
      "Users endpoint": ["GET /users returns paginated list", "GET /users/:id returns 404 for unknown id", "POST /users validates email", "PATCH /users/:id is idempotent", "DELETE /users/:id requires admin"],
      "Orders endpoint": ["POST /orders creates order", "GET /orders filters by status", "Order totals include tax", "Concurrent updates are serialized", "Webhooks fire on status change"],
      "Auth tokens": ["Access token expires after 15 minutes", "Refresh token rotates", "Revoked token is rejected", "Rate limit returns 429"],
      Inventory: ["Stock decrements on purchase", "Backorder flag set at zero stock", "Bulk import handles 10k rows"],
    },
    params: [["db", ["postgres"]]],
  },
};

const catalog = CATALOG[args.suite] ?? CATALOG.web;
const out = resolve(args.out);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const owners = ["alice", "bilal", "chen", "dana"];
const severities = ["blocker", "critical", "normal", "normal", "normal", "minor", "trivial"];
const errors = [
  ["AssertionError: expected 200 but received 500", "at Object.<anonymous> (tests/api.spec.ts:42:17)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)"],
  ["TimeoutError: locator.click: Timeout 5000ms exceeded.\nwaiting for getByRole('button', { name: 'Pay now' })", "at CheckoutPage.pay (pages/checkout.ts:88:22)\n    at tests/checkout.spec.ts:31:5"],
  ["Error: expect(received).toEqual(expected)\n\n- Expected  \"$42.00\"\n+ Received  \"$41.99\"", "at tests/cart.spec.ts:57:30"],
];
const brokenErrors = [["TypeError: Cannot read properties of undefined (reading 'token')", "at fixtures/auth.ts:19:31\n    at setup (fixtures/index.ts:12:9)"]];

let clock = args["start-time"] ? Number(args["start-time"]) : Date.now() - 15 * 60 * 1000;
let count = 0;

function stepTree(testName, status, start) {
  const names = ["Open page", "Fill form", "Submit", "Verify result"];
  let t = start;
  return names.map((name, i) => {
    const dur = 50 + Math.floor(rand() * 600);
    const last = i === names.length - 1;
    const step = {
      name: `${name}`,
      status: last ? status : "passed",
      stage: "finished",
      start: t,
      stop: t + dur,
      steps: [],
      attachments: [],
      parameters: [],
    };
    if (last && status !== "passed") step.statusDetails = { message: `Step failed in "${testName}"` };
    t += dur;
    return step;
  });
}

function writeResult({ feature, name, param, status, error }) {
  const uuid = randomUUID();
  const fullName = `${catalog.parentSuite}.${feature}.${name}${param ? `[${param[1]}]` : ""}`;
  const historyId = createHash("md5").update(fullName).digest("hex");
  const duration = 200 + Math.floor(rand() * (feature === "Checkout" ? 9000 : 3500));
  const start = clock;
  const stop = start + duration;
  clock = stop + Math.floor(rand() * 50);

  const logName = `${uuid}-attachment.txt`;
  writeFileSync(join(out, logName), `[${new Date(start).toISOString()}] starting ${name}\n[${new Date(stop).toISOString()}] finished with status=${status}\n`);

  const result = {
    uuid,
    historyId,
    testCaseId: historyId,
    name,
    fullName,
    status,
    stage: "finished",
    start,
    stop,
    description: `Verifies that **${name.toLowerCase()}** behaves as specified.`,
    labels: [
      { name: "parentSuite", value: catalog.parentSuite },
      { name: "suite", value: feature },
      { name: "epic", value: catalog.parentSuite },
      { name: "feature", value: feature },
      { name: "story", value: name },
      { name: "severity", value: pick(severities) },
      { name: "owner", value: pick(owners) },
      { name: "framework", value: catalog.framework },
      { name: "language", value: "typescript" },
      ...(rand() < 0.3 ? [{ name: "tag", value: "smoke" }] : []),
    ],
    links: rand() < 0.2 ? [{ type: "issue", name: `PROJ-${100 + Math.floor(rand() * 900)}`, url: "https://example.com/issues" }] : [],
    parameters: param ? [{ name: param[0], value: param[1] }] : [],
    steps: stepTree(name, status, start),
    attachments: [{ name: "Test log", source: logName, type: "text/plain" }],
  };
  if (error) result.statusDetails = { message: error[0], trace: error[1] };
  writeFileSync(join(out, `${uuid}-result.json`), JSON.stringify(result, null, 2));
  count++;
}

for (const [feature, tests] of Object.entries(catalog.features)) {
  for (const name of tests) {
    const [paramName, paramValues] = catalog.params[0];
    const values = feature === "Checkout" || feature === "Authentication" ? paramValues : [paramValues[0]];
    for (const value of values) {
      const param = values.length > 1 ? [paramName, value] : null;
      const r = rand();
      if (r < 0.04) {
        writeResult({ feature, name, param, status: "skipped" });
      } else if (r < 0.04 + failRate * 0.25) {
        writeResult({ feature, name, param, status: "broken", error: pick(brokenErrors) });
      } else if (r < 0.04 + failRate) {
        writeResult({ feature, name, param, status: "failed", error: pick(errors) });
      } else if (r < 0.04 + failRate + 0.05) {
        // Flaky: a failed attempt followed by a passing retry with the same historyId.
        writeResult({ feature, name, param, status: "failed", error: pick(errors) });
        writeResult({ feature, name, param, status: "passed" });
      } else {
        writeResult({ feature, name, param, status: "passed" });
      }
    }
  }
}

writeFileSync(
  join(out, "environment.properties"),
  [`suite=${args.suite}`, `node=${process.version}`, `os=${process.platform}`, `seed=${args.seed}`].join("\n") + "\n",
);

console.log(`Wrote ${count} results to ${out} (seed=${args.seed})`);
