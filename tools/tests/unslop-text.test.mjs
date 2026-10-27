import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scannerTests, script } from "./helpers.mjs";

scannerTests({ skill: "unslop-text", fixture: "text", slop: ["slop.md"], clean: ["clean.md"],
  expect: ["text-1", "text-5", "text-7", "text-8", "text-9", "text-10", "text-11", "text-12", "text-15", "text-16", "text-17", "text-19", "text-20", "text-25", "text-26", "text-27", "text-30"] });

test("scan.mjs honours unslop-ignore markers", () => {
  const dir = mkdtempSync(join(tmpdir(), "unslop-ignore-"));
  writeFileSync(join(dir, "a.md"), "We delve into it. <!-- unslop-ignore -->\nWe delve again.\n");
  writeFileSync(join(dir, "b.md"), "<!-- unslop-ignore-file -->\nWe delve into it.\n");
  const out = JSON.parse(execFileSync("node", [script("unslop-text", "scan.mjs"), "--json", "a.md", "b.md"], { cwd: dir, encoding: "utf8" }));
  assert.deepEqual(out.map((f) => `${f.file}:${f.line}`), ["a.md:2"]);
});
