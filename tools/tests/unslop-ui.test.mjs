import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scannerTests, scan, script, fixtures } from "./helpers.mjs";

scannerTests({ skill: "unslop-ui", fixture: "ui", slop: ["Landing.tsx", "site.css"], clean: ["Clean.tsx"],
  expect: ["ui-1", "ui-5", "ui-6", "ui-7", "ui-8", "ui-11", "ui-13", "ui-15", "ui-16", "ui-17", "ui-19", "ui-20", "ui-21",
    "ui-22", "ui-23", "ui-24", "ui-25", "ui-26", "ui-27", "ui-28", "ui-29", "ui-31", "ui-32", "ui-33", "ui-34", "ui-35", "ui-36", "ui-37", "ui-38", "ui-39", "ui-40", "ui-41"] });

test("unslop-ui: trend tells are found in markup and in CSS", () => {
  const titles = (file) => { const t = scan("unslop-ui", "ui", [file]).filter((f) => (Number(f.id.slice(3)) >= 31 && Number(f.id.slice(3)) <= 38) || f.title === "Dark-mode gradient hero").map((f) => f.title); return [...new Set(t)].sort(); };
  assert.deepEqual(titles("Landing.tsx"), ["ASCII or video background", "Dark-mode gradient hero", "Grid or dot background", "Logo marquee or holographic chrome", "Painterly background", "Squircle", "Text-layout showpiece"]);
  assert.deepEqual(titles("site.css"), ["Dithering or grain", "Grid or dot background", "Pixel loader or retro type", "Squircle"]);
});

test("unslop-ui: density tells report once per file with a count, and section numbering needs two", () => {
  const hits = scan("unslop-ui", "ui", ["Landing.tsx"]);
  const one = (title) => hits.filter((f) => f.title === title);
  assert.equal(one("Badge and tag clutter").length, 1);
  assert.match(one("Badge and tag clutter")[0].match, /^3 badges/);
  assert.match(one("Dividers everywhere")[0].match, /^3 dividers/);
  assert.match(one("Opacity stack")[0].match, /^4 distinct opacity levels/);
  assert.match(one("Bordered boxes everywhere")[0].match, /^5 bordered boxes/);
  assert.match(one("Inline diagram")[0].match, /^inline SVG with 12 shapes/);
  assert.match(one("Section numbering")[0].match, /^2 zero-padded section numbers/);
  assert.deepEqual(one("Italic word in a headline").length + one("Negative tracking").length + one("Code breadcrumb").length, 3);
  const css = scan("unslop-ui", "ui", ["site.css"]).filter((f) => f.id === "ui-24").map((f) => f.title).sort();
  assert.deepEqual(css, ["Display-serif default", "Negative tracking"]);
});

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
  assert.deepEqual(report.opacities.map((o) => o.value).sort(), ["/10", "/20", "/5", "/60", "alpha 0.6"]);
  assert.ok(report.motion.animatedFiles.includes("site.css"));
  assert.deepEqual(report.motion.reducedMotionFiles, ["Clean.tsx"]);
});

test("unslop-ui: ui-25 counts hairlines, menu separators, and side borders, and leaves a header and footer alone", () => {
  const dir = mkdtempSync(join(tmpdir(), "unslop-div-"));
  writeFileSync(join(dir, "Rules.tsx"), '<div>\n<div className="h-px w-full bg-border" />\n<DropdownMenuSeparator />\n<span>|</span>\n<BreadcrumbSeparator />\n</div>\n');
  writeFileSync(join(dir, "Sections.tsx"), '<main>\n<header className="border-b">h</header>\n<section className="border-t py-8">a</section>\n<section className="border-t py-8">b</section>\n<section className="border-y py-8">c</section>\n<Separator />\n<li className="border-b-0 border-b-stone-200">x</li>\n</main>\n');
  writeFileSync(join(dir, "Shell.tsx"), '<div>\n<header className="border-b">h</header>\n<Separator />\n<footer className="border-t">f</footer>\n</div>\n');
  writeFileSync(join(dir, "page.css"), ".a{border-bottom:1px solid #ddd}\n.b{border-top:1px solid #ddd}\n.c{border-bottom:1px solid #ddd}\n.d{border-top: none}\n.e{border-block:1px solid #ddd}\n.f{border-bottom-width:1px}\n");
  const out = JSON.parse(execFileSync("node", [script("unslop-ui", "scan.mjs"), "--json", "Rules.tsx", "Sections.tsx", "Shell.tsx", "page.css"], { cwd: dir, encoding: "utf8" }));
  const hits = Object.fromEntries(out.filter((f) => f.id === "ui-25").map((f) => [f.file, f.match]));
  assert.deepEqual(Object.keys(hits).sort(), ["Rules.tsx", "Sections.tsx", "page.css"]);
  assert.match(hits["Rules.tsx"], /^3 dividers in this file, e\.g\. h-px/);
  assert.match(hits["Sections.tsx"], /^5 dividers in this file \(1 rule elements, 4 side borders\)/);
  assert.match(hits["page.css"], /^5 dividers in this file \(0 rule elements, 5 side borders\)/);
});

test("ui scan.mjs skips compiled Tailwind output", () => {
  const dir = mkdtempSync(join(tmpdir(), "unslop-tw-"));
  writeFileSync(join(dir, "out.css"), "/*! tailwindcss v4.1.0 | MIT License */\n.a{outline:none;backdrop-filter:blur(8px)}\n");
  writeFileSync(join(dir, "src.css"), ".a{outline:none;backdrop-filter:blur(8px)}\n");
  const out = JSON.parse(execFileSync("node", [script("unslop-ui", "scan.mjs"), "--json", "out.css", "src.css"], { cwd: dir, encoding: "utf8" }));
  assert.deepEqual([...new Set(out.map((f) => f.file))], ["src.css"]);
});

test("ui scan.mjs reads Svelte: {alt} shorthand and <title> separators pass, a clickable div does not", () => {
  assert.deepEqual(scan("unslop-ui", "ui", ["Clean.svelte"]), []);
  const slop = scan("unslop-ui", "ui", ["Slop.svelte"]).map((f) => `${f.line} ${f.title}`);
  assert.deepEqual(slop, ["1 Clickable non-button", "2 Image without alt"]);
});
