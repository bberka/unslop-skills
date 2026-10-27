import { test } from "node:test";
import assert from "node:assert/strict";
import { scannerTests, scan } from "./helpers.mjs";

scannerTests({ skill: "unslop-typescript", fixture: "typescript", slop: ["slop.ts", "spam.ts"], clean: ["clean.ts"],
  expect: ["ts-1", "ts-2", "ts-3", "ts-4", "ts-7", "ts-9", "ts-10", "ts-11", "ts-17", "ts-18", "ts-19", "ts-20"] });

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
