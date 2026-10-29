#!/usr/bin/env node
// Component inventory: every React component with its size and hook counts,
// components that share a role suffix (Button, Card, Modal...), names defined
// more than once, and design-system folders. Feeds react-9 and react-10.
// Usage: node inventory.mjs [--json] [paths...]
import { readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { listFiles } from "./files.mjs";

const FILES = /\.(?:jsx|tsx)$/i;
const SKIP = /(?:^|[\\/])(?:node_modules|\.git|dist|build|out|coverage|\.next|storybook-static|__tests__|__mocks__|__fixtures__|e2e|playwright|cypress)(?:[\\/]|$)|\.(?:test|spec|e2e|stories)\.[jt]sx$/;
// Suffixes that name a kind of file or a demo rather than a reusable role.
const EXPECTED_MANY = new Set(["Page", "Layout", "Provider", "Screen", "Route", "Icon", "Context", "Story", "Root", "App", "Demo", "Example", "Preview"]);
const MAX_MEMBERS_SHOWN = 12;
const DS_DIRS = /(?:^|\/)(?:ui|design-system|primitives|components\/common|kit)(?:\/|$)/;

const args = process.argv.slice(2);
const json = args.includes("--json");
const targets = args.filter((a) => !a.startsWith("--"));
if (!targets.length) targets.push(".");

const files = targets.flatMap((t) => {
  const abs = resolve(t);
  if (!existsSync(abs)) { console.error(`inventory: no such path: ${t}`); process.exit(2); }
  return statSync(abs).isDirectory() ? listFiles(abs, SKIP) : [abs];
}).filter((f) => FILES.test(f) && !SKIP.test(relative(process.cwd(), f)) && existsSync(f));

// A function body: `function`, `(args) =>`, or `arg =>`.
const FN = "(?:async\\s*)?(?:function\\b|\\(|[a-z_]\\w*\\s*=>)";
// Wrappers whose argument is the component: memo(...), forwardRef<A, B<"x">>(...), memo(forwardRef(...)).
// The function may start on the same line or the next one.
const WRAP = "(?:(?:React\\.)?(?:memo|forwardRef|observer)\\s*(?:<.*>)?\\(\\s*){1,2}";
const DECL = [
  /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Z]\w*)\s*[(<]/,
  new RegExp(`^(?:export\\s+)?const\\s+([A-Z]\\w*)\\s*(?::[^=]+)?=\\s*(?:${WRAP}(?:${FN}|$)|${FN})`),
  /^(?:export\s+)?(?:default\s+)?class\s+([A-Z]\w*)\s+extends\s+(?:React\.)?(?:Pure)?Component\b/,
];
// A component ends at the next top-level declaration or at a line holding only closing brackets in column 0.
const BOUNDARY = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:const|let|var|function|class|type|interface|enum|namespace|declare)\b|^export\s*[{*]/;
const CLOSER = /^[}\])]+;?\s*$/;

const components = [];
for (const file of files) {
  const rel = relative(process.cwd(), file).split("\\").join("/");
  const lines = readFileSync(file, "utf8").split("\n");
  const starts = [];
  lines.forEach((l, i) => {
    for (const re of DECL) {
      const m = re.exec(l);
      if (m) { starts.push({ name: m[1], line: i + 1 }); break; }
    }
  });
  starts.forEach((s, k) => {
    let end = k + 1 < starts.length ? starts[k + 1].line - 1 : lines.length;
    for (let i = s.line; i < end; i++) {
      if (BOUNDARY.test(lines[i])) { end = i; break; }
      if (CLOSER.test(lines[i])) { end = i + 1; break; }
    }
    const body = lines.slice(s.line - 1, end).join("\n");
    components.push({
      name: s.name, file: rel, line: s.line, lines: end - s.line + 1,
      useState: (body.match(/\buseState\b\s*[(<]/g) ?? []).length,
      useEffect: (body.match(/\buse(?:Layout)?Effect\s*\(/g) ?? []).length,
    });
  });
}

const suffix = (name) => (name.match(/[A-Z][a-z0-9]*/g) ?? [name]).pop();
const groups = {};
for (const c of components) (groups[suffix(c.name)] ??= []).push(c);
const similar = Object.entries(groups)
  .filter(([s, cs]) => cs.length >= 2 && !EXPECTED_MANY.has(s) && new Set(cs.map((c) => c.name)).size >= 2)
  .sort((a, b) => b[1].length - a[1].length);

const byName = {};
for (const c of components) (byName[c.name] ??= []).push(c);
const duplicateNames = Object.entries(byName).filter(([, cs]) => new Set(cs.map((c) => c.file)).size > 1);

const dsFolders = {};
for (const c of components) if (DS_DIRS.test(c.file)) (dsFolders[dirname(c.file)] ??= new Set()).add(c.name);

const largest = [...components].sort((a, b) => b.lines - a.lines).slice(0, 15);

// One branch per format: exit() after printing can drop the end of a large --json output on a pipe.
if (json) {
  console.log(JSON.stringify({ components, similar: Object.fromEntries(similar), duplicateNames: Object.fromEntries(duplicateNames),
    designSystem: Object.fromEntries(Object.entries(dsFolders).map(([d, s]) => [d, [...s]])) }, null, 2));
} else {

  console.log(`${components.length} components in ${new Set(components.map((c) => c.file)).size} files.\n`);
  console.log("Design-system folders (reuse these before adding new primitives):");
  const ds = Object.entries(dsFolders);
  if (ds.length === 0) console.log("  none found");
  for (const [d, names] of ds) console.log(`  ${d}: ${[...names].sort().join(", ")}`);
  console.log("\nLargest components (react-10 candidates):");
  for (const c of largest) console.log(`  ${c.file}:${c.line}  ${c.name}  ${c.lines} lines, ${c.useState} useState, ${c.useEffect} effects`);
  console.log("\nSame role, different components (react-9 candidates; diff them):");
  if (similar.length === 0) console.log("  none");
  for (const [s, cs] of similar) {
    const shown = cs.slice(0, MAX_MEMBERS_SHOWN).map((c) => `${c.name} (${c.file}:${c.line})`).join(", ");
    const more = cs.length > MAX_MEMBERS_SHOWN ? `, +${cs.length - MAX_MEMBERS_SHOWN} more (--json lists all)` : "";
    console.log(`  ${s} (${cs.length}): ${shown}${more}`);
  }
  console.log("\nSame name defined in several files:");
  if (duplicateNames.length === 0) console.log("  none");
  for (const [n, cs] of duplicateNames) console.log(`  ${n}: ${cs.map((c) => `${c.file}:${c.line}`).join(", ")}`);
}
