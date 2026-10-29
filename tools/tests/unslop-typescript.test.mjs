import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scannerTests, scan, script } from "./helpers.mjs";

scannerTests({ skill: "unslop-typescript", fixture: "typescript", slop: ["slop.ts", "spam.ts", "components/UserCard.ts"], clean: ["clean.ts", "Clean.svelte"],
  expect: ["ts-1", "ts-2", "ts-3", "ts-4", "ts-7", "ts-8", "ts-9", "ts-10", "ts-11", "ts-17", "ts-18", "ts-19", "ts-20", "ts-22", "ts-25"] });

test("unslop-typescript: architecture tells read the path, and a god file is judged by lines of code", () => {
  const card = scan("unslop-typescript", "typescript", ["components/UserCard.ts"]).map((f) => `${f.line} ${f.id} ${f.title}`);
  assert.deepEqual(card, ["1 ts-25 UI layer reaching infrastructure", "3 ts-22 Representable illegal state", "12 ts-8 Unvalidated boundary cast"]);
  const dir = mkdtempSync(join(tmpdir(), "unslop-god-"));
  writeFileSync(join(dir, "big.ts"), Array.from({ length: 620 }, (_, i) => `export const v${i} = ${i};`).join("\n") + "\n");
  mkdirSync(join(dir, "components"));
  mkdirSync(join(dir, "scripts"));
  writeFileSync(join(dir, "scripts", "build.ts"), 'const pkg = JSON.parse(readFileSync("package.json", "utf8")) as Pkg;\n');
  writeFileSync(join(dir, "components", "route.ts"), 'import { PrismaClient } from "@prisma/client";\nexport const db = new PrismaClient();\n');
  const out = JSON.parse(execFileSync("node", [script("unslop-typescript", "scan.mjs"), "--json", "big.ts", "components/route.ts", "scripts/build.ts"], { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).toString());
  assert.deepEqual(out.map((f) => `${f.file} ${f.id} ${f.match}`), ["big.ts ts-23 620 lines of code"]);
});

test("unslop-typescript: non-null assertions count per line and per file", () => {
  const hits = scan("unslop-typescript", "typescript", ["slop.ts", "spam.ts"]).filter((f) => f.id === "ts-3");
  assert.equal(hits.length, 2);
  assert.match(hits.find((f) => f.file === "slop.ts").match, /user!\.profile!\.name/);
  const spam = hits.find((f) => f.file === "spam.ts");
  assert.equal(spam.line, 1);
  assert.match(spam.match, /^8 non-null assertions/);
});

test("unslop-typescript: the verbose-boolean rule leaves `=== true` to the reader", () => {
  const hits = scan("unslop-typescript", "typescript", ["slop.ts"]).filter((f) => f.id === "ts-11");
  assert.deepEqual(hits.map((f) => f.title).sort(), ["Verbose boolean", "if-return-true-else-false"]);
  assert.match(hits.find((f) => f.title === "Verbose boolean").match, /\.filter\(/);
});

test("unslop-typescript: a swallowed error is flagged around several statements, not around a probe or a parse guard", () => {
  const slop = scan("unslop-typescript", "typescript", ["slop.ts"]).filter((f) => f.title === "Swallowed error");
  assert.deepEqual(slop.map((f) => f.match), ["catch drops the error from 3 statements"]);
  const clean = scan("unslop-typescript", "typescript", ["clean.ts"]).filter((f) => f.id === "ts-9");
  assert.deepEqual(clean, [], "probe, parse guard, log-and-continue, and a catch inside a string stay silent");
});

test("unslop-typescript: .svelte files are scanned inside <script> only", () => {
  const slop = scan("unslop-typescript", "typescript", ["Slop.svelte"]);
  assert.deepEqual(slop.map((f) => `${f.line} ${f.id}`), ["2 ts-1", "3 ts-20"]);
  assert.deepEqual(scan("unslop-typescript", "typescript", ["Clean.svelte"]), []);
});
