#!/usr/bin/env node
// Runs every tools/tests/*.test.mjs under `node --test`. The file list is built here
// because Node 20's test runner does not expand glob arguments.
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "tests");
const files = readdirSync(dir).filter((f) => f.endsWith(".test.mjs")).sort().map((f) => join(dir, f));
const result = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit" });
process.exit(result.status ?? 1);
