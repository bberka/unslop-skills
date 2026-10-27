import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scannerTests, scan, script } from "./helpers.mjs";

// Every (L) tell in TELLS.md. A tell added to the scanner needs a line in slop.md and an id here.
scannerTests({ skill: "unslop-text", fixture: "text", slop: ["slop.md"], clean: ["clean.md"],
  expect: ["text-1", "text-2", "text-3", "text-5", "text-7", "text-8", "text-9", "text-10", "text-11", "text-12", "text-15", "text-16", "text-17", "text-18", "text-19", "text-20", "text-25", "text-26", "text-27", "text-28", "text-30", "text-31", "text-32", "text-33"] });

test("unslop-text: changelogs are skipped on a directory walk and scanned when named", () => {
  const walked = scan("unslop-text", "text", ["."]);
  assert.deepEqual(walked.filter((f) => f.file.includes("CHANGELOG")), []);
  assert.ok(walked.some((f) => f.file === "slop.md"), "the walk still reaches slop.md");
  const named = scan("unslop-text", "text", ["CHANGELOG.md"]);
  assert.ok(named.length >= 3, `named changelog is scanned: ${named.length} hits`);
});

test("unslop-text: text-25 fires only when the bold label is restated", () => {
  const ids = (line) => scanText(line).map((f) => f.id);
  assert.deepEqual(ids("- **Performance:** Performance improved by 20%.\n"), ["text-25"]);
  assert.deepEqual(ids("- **Performance**: builds finish in 2s instead of 9s.\n"), []);
});

test("unslop-text: text-26 needs evidence that the heading words are common words", () => {
  const ids = (text) => scanText(text).map((f) => f.id);
  assert.deepEqual(ids("# Getting Started With The API\n\nRun it.\n"), ["text-26"]);
  assert.deepEqual(ids("# Migration Guide\n\nThe migration guide covers v2.\n"), ["text-26"]);
  assert.deepEqual(ids("# Visual Studio Code\n\nThe extension reads the config.\n"), []);
  const many = Array.from({ length: 7 }, (_, i) => `## Install Guide ${i}\n\nThe install guide.\n`).join("\n");
  assert.equal(scanText(many).filter((f) => f.id === "text-26").length, 1, "collapses to one hit per file");
});

test("scan.mjs honours unslop-ignore markers", () => {
  const dir = mkdtempSync(join(tmpdir(), "unslop-ignore-"));
  writeFileSync(join(dir, "a.md"), "We delve into it. <!-- unslop-ignore -->\nWe delve again.\n");
  writeFileSync(join(dir, "b.md"), "<!-- unslop-ignore-file -->\nWe delve into it.\n");
  const out = JSON.parse(execFileSync("node", [script("unslop-text", "scan.mjs"), "--json", "a.md", "b.md"], { cwd: dir, encoding: "utf8" }));
  assert.deepEqual(out.map((f) => `${f.file}:${f.line}`), ["a.md:2"]);
});

function scanText(text) {
  const dir = mkdtempSync(join(tmpdir(), "unslop-text-"));
  writeFileSync(join(dir, "t.md"), text);
  return JSON.parse(execFileSync("node", [script("unslop-text", "scan.mjs"), "--json", "t.md"], { cwd: dir, encoding: "utf8" }));
}

test("unslop-text: names, orientation, table placeholders, and arrow chains are not tells", () => {
  const slop = scan("unslop-text", "text", ["slop.md"]);
  assert.ok(slop.some((f) => f.id === "text-10" && /landscape/i.test(f.match)), "the abstract landscape is flagged");
  assert.ok(slop.some((f) => f.id === "text-28" && f.match === "→"), "a lone arrow is flagged");
  assert.deepEqual(scan("unslop-text", "text", ["clean.md"]), []);
});
