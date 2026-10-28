#!/usr/bin/env node
// Copies the shared scripts into the skills. Each skill installs on its own, so shared code is
// vendored rather than imported:
//   shared/scan.mjs    into every skill that ships a scripts/rules.mjs
//   shared/ledger.mjs  into every skill
//   shared/report.mjs  into every skill
//   shared/detect.mjs  into the skills that plan runs: unslop-all and unslop-diff
// Usage: node tools/sync.mjs [--check]   (--check exits 1 when a copy is stale)
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const SHARED = [
  { file: "scan.mjs", wanted: (scripts) => existsSync(join(scripts, "rules.mjs")) },
  { file: "ledger.mjs", wanted: () => true },
  { file: "report.mjs", wanted: () => true },
  { file: "detect.mjs", wanted: (_scripts, skill) => ["unslop-all", "unslop-diff"].includes(skill) },
];
let stale = 0;

for (const { file, wanted } of SHARED) {
  const source = readFileSync(join(root, "shared", file), "utf8");
  for (const skill of readdirSync(join(root, "skills"))) {
    const scripts = join(root, "skills", skill, "scripts");
    if (!wanted(scripts, skill)) continue;
    const target = join(scripts, file);
    const current = existsSync(target) ? readFileSync(target, "utf8") : "";
    if (current === source) continue;
    stale++;
    if (check) {
      console.error(`stale: skills/${skill}/scripts/${file}`);
    } else {
      mkdirSync(scripts, { recursive: true });
      writeFileSync(target, source);
      console.log(`synced: skills/${skill}/scripts/${file}`);
    }
  }
}

if (check && stale > 0) process.exit(1);
if (!check && stale === 0) console.log("All shared script copies are current.");
