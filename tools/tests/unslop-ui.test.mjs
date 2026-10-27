import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scannerTests, scan, script, fixtures } from "./helpers.mjs";

scannerTests({ skill: "unslop-ui", fixture: "ui", slop: ["Landing.tsx", "site.css"], clean: ["Clean.tsx"],
  expect: ["ui-1", "ui-5", "ui-6", "ui-7", "ui-8", "ui-11", "ui-13", "ui-15", "ui-16", "ui-17", "ui-19", "ui-20", "ui-21"] });

test("unslop-ui: arbitrary values are one hit per file with the count, and img is matched across lines", () => {
  const hits = scan("unslop-ui", "ui", ["Landing.tsx"]);
  const arbitrary = hits.filter((f) => f.id === "ui-13");
  assert.equal(arbitrary.length, 1);
  assert.match(arbitrary[0].match, /^2 arbitrary values in this file, e\.g\. mt-\[13px\]/);
  assert.ok(hits.some((f) => f.title === "Image without alt"), "the <img> tag spans three lines");
});

test("ui tokens.mjs counts sprawl, unused variables, and reduced-motion coverage", () => {
  const report = JSON.parse(execFileSync("node", [script("unslop-ui", "tokens.mjs"), "--json", "."], { cwd: fixtures("ui"), encoding: "utf8" }));
  assert.ok(report.colors.length >= 10);
  assert.deepEqual(report.cssVariables.unused.sort(), ["paper", "unused-token"]);
  assert.ok(report.arbitrary.some((a) => a.value === "mt-[13px]"));
  assert.ok(!report.arbitrary.some((a) => a.value.startsWith("data-[")), "variant selectors are not arbitrary values");
  const radii = report.radii.map((r) => r.value);
  assert.ok(radii.includes("rounded-2xl") && radii.includes("rounded-sm"));
  assert.ok(!radii.some((r) => /^rounded[a-z]/.test(r)), `rounded-lg stays rounded-lg: ${radii}`);
  assert.ok(report.motion.animatedFiles.includes("site.css"));
  assert.deepEqual(report.motion.reducedMotionFiles, ["Clean.tsx"]);
});

test("ui scan.mjs skips compiled Tailwind output", () => {
  const dir = mkdtempSync(join(tmpdir(), "unslop-tw-"));
  writeFileSync(join(dir, "out.css"), "/*! tailwindcss v4.1.0 | MIT License */\n.a{outline:none;backdrop-filter:blur(8px)}\n");
  writeFileSync(join(dir, "src.css"), ".a{outline:none;backdrop-filter:blur(8px)}\n");
  const out = JSON.parse(execFileSync("node", [script("unslop-ui", "scan.mjs"), "--json", "out.css", "src.css"], { cwd: dir, encoding: "utf8" }));
  assert.deepEqual([...new Set(out.map((f) => f.file))], ["src.css"]);
});
