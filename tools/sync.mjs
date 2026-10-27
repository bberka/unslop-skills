#!/usr/bin/env node
// Copies shared/scan.mjs into every skill that ships a scripts/rules.mjs.
// Each skill installs on its own, so the scanner is vendored rather than imported.
// Usage: node tools/sync.mjs [--check]   (--check exits 1 when a copy is stale)
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "shared", "scan.mjs"), "utf8");
const check = process.argv.includes("--check");
let stale = 0;

for (const skill of readdirSync(join(root, "skills"))) {
  const scripts = join(root, "skills", skill, "scripts");
  if (!existsSync(join(scripts, "rules.mjs"))) continue;
  const target = join(scripts, "scan.mjs");
  const current = existsSync(target) ? readFileSync(target, "utf8") : "";
  if (current === source) continue;
  stale++;
  if (check) {
    console.error(`stale: skills/${skill}/scripts/scan.mjs`);
  } else {
    writeFileSync(target, source);
    console.log(`synced: skills/${skill}/scripts/scan.mjs`);
  }
}

if (check && stale > 0) process.exit(1);
if (!check && stale === 0) console.log("All scanner copies are current.");
