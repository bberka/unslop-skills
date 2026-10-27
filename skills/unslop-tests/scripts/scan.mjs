#!/usr/bin/env node
// unslop-ignore-file
// Tell scanner. The source of truth is shared/scan.mjs; tools/sync.mjs copies it
// into each skill's scripts/ folder. Edit the shared copy, then run `npm run sync`.
//
// Usage: node scan.mjs [--json] [--check] [--exclude <path>]... [paths...]
//   Scans files with the rules in ./rules.mjs. Directories are walked (git-aware,
//   skipping dependency, build, and agent-tooling folders) and filtered by each rule's
//   `files` pattern; files named explicitly get every rule.
//   --json     machine-readable output
//   --check    exit 1 when anything is found (for hooks and CI)
//   --exclude  skip a file or folder (repeatable), for areas the project puts off limits
//
// A line containing `unslop-ignore` is skipped; a file containing
// `unslop-ignore-file` is skipped entirely.
//
// Rule shape (rules.mjs default export is an array):
//   { id, title, files: RegExp,          // path filter, matched against the relative path
//     exclude?: RegExp,                  // path filter to drop
//     pattern?: RegExp,                  // per-line match (flags g added automatically)
//     multiline?: RegExp,                // whole-file match; reported at the match's first line
//     check?: (text, path) => [{ line, match }],  // custom file-level check
//     filter?: (match, line, path) => boolean,     // drop a match when false
//     skipFile?: (text, path) => boolean,          // skip this rule for the whole file when true
//     prose?: true,                      // markdown: blank out code fences and inline code first
//     script?: true }                    // .svelte/.vue/.astro/.html: blank out all but <script> blocks

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, relative, resolve } from "node:path";
import rules from "./rules.mjs";

const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", "out", "bin", "obj", "coverage",
  ".next", ".nuxt", ".svelte-kit", ".turbo", ".cache", "vendor", "target",
  "__pycache__", ".venv", "venv",
  // Agent tooling: installed skills and agent worktrees are not the project's code.
  ".agents", ".claude", ".cursor", ".codex", ".gemini", ".windsurf", ".unslop",
]);
const MAX_BYTES = 1_000_000;

const args = process.argv.slice(2);
const json = args.includes("--json");
const check = args.includes("--check");
const excludes = [];
const targets = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--exclude") {
    if (!args[i + 1]) { console.error("scan: --exclude needs a path"); process.exit(2); }
    excludes.push(resolve(args[++i]));
  } else if (!args[i].startsWith("--")) {
    targets.push(args[i]);
  }
}
if (targets.length === 0) targets.push(".");
const excluded = (abs) => excludes.some((e) => abs === e || abs.startsWith(e.endsWith("/") ? e : `${e}/`));

function gitFiles(dir) {
  try {
    const out = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
      cwd: dir, stdio: ["ignore", "pipe", "ignore"], maxBuffer: 256 * 1024 * 1024,
    });
    return out.toString().split("\0").filter(Boolean).map((f) => join(dir, f))
      .filter((f) => !f.split(/[\\/]/).some((part) => SKIP_DIRS.has(part)) && existsSync(f));
  } catch {
    return null;
  }
}

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(join(dir, entry.name), acc);
    } else if (entry.isFile()) {
      acc.push(join(dir, entry.name));
    }
  }
  return acc;
}

// Replace code with spaces so prose rules skip it and line/column numbers survive.
function maskMarkdownCode(text) {
  const blank = (s) => s.replace(/[^\n]/g, " ");
  return text
    .replace(/^([ \t]*)(```|~~~)[\s\S]*?^\1\2[^\n]*$/gm, blank)
    .replace(/`[^`\n]+`/g, blank)
    .replace(/\]\([^)\n]*\)/g, blank)
    .replace(/<!--[\s\S]*?-->/g, blank);
}

// Keep only <script> blocks (and Astro frontmatter) in component files, so code rules
// read the script and line numbers still match the file.
function maskOutsideScript(text, path) {
  if (!/\.(?:svelte|vue|astro|html?)$/i.test(path)) return text;
  const keep = [];
  for (const m of text.matchAll(/(<script\b[^>]*>)([\s\S]*?)<\/script>/gi)) keep.push([m.index + m[1].length, m.index + m[1].length + m[2].length]);
  const front = /\.astro$/i.test(path) ? /^---\n([\s\S]*?)\n---/.exec(text) : null;
  if (front) keep.push([4, 4 + front[1].length]);
  let out = "";
  let at = 0;
  for (const [from, to] of keep.sort((a, b) => a[0] - b[0])) {
    out += text.slice(at, from).replace(/[^\n]/g, " ") + text.slice(from, to);
    at = to;
  }
  return out + text.slice(at).replace(/[^\n]/g, " ");
}

function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

function withGlobal(re) {
  return re.flags.includes("g") ? re : new RegExp(re.source, re.flags + "g");
}

const findings = [];

function scanFile(path, explicit) {
  const rel = relative(process.cwd(), path) || path;
  const posixRel = rel.split("\\").join("/");
  const applicable = rules.filter((r) =>
    (explicit || r.files.test(posixRel)) && !(r.exclude && r.exclude.test(posixRel)));
  if (applicable.length === 0) return;

  let raw;
  try {
    if (statSync(path).size > MAX_BYTES) return;
    raw = readFileSync(path, "utf8");
  } catch {
    return;
  }
  if (raw.includes("\0") || raw.includes("unslop-ignore-file")) return;

  const rawLines = raw.split("\n");
  const isMarkdown = /\.(md|mdx|markdown)$/i.test(path);
  const masked = isMarkdown ? maskMarkdownCode(raw) : raw;
  const maskedLines = masked.split("\n");
  let script = null;
  let scriptLines = null;

  const push = (rule, line, match) => {
    const source = rawLines[line - 1] ?? "";
    if (source.includes("unslop-ignore")) return;
    if (rule.filter && !rule.filter(match, source, posixRel)) return;
    findings.push({
      file: posixRel, line, id: rule.id, title: rule.title,
      match: String(match).trim().slice(0, 80), excerpt: source.trim().slice(0, 140),
    });
  };

  for (const rule of applicable) {
    if (rule.skipFile && rule.skipFile(raw, posixRel)) continue;
    if (rule.script && script === null) {
      script = maskOutsideScript(raw, posixRel);
      scriptLines = script.split("\n");
    }
    const text = rule.prose ? masked : rule.script ? script : raw;
    const lines = rule.prose ? maskedLines : rule.script ? scriptLines : rawLines;
    if (rule.pattern) {
      const re = withGlobal(rule.pattern);
      lines.forEach((l, i) => {
        for (const m of l.matchAll(re)) push(rule, i + 1, m[0]);
      });
    }
    if (rule.multiline) {
      for (const m of text.matchAll(withGlobal(rule.multiline))) {
        const lead = m[0].length - m[0].trimStart().length;
        push(rule, lineOf(text, m.index + lead), m[0].split("\n")[0]);
      }
    }
    if (rule.check) {
      for (const hit of rule.check(text, posixRel) ?? []) push(rule, hit.line, hit.match);
    }
  }
}

for (const target of targets) {
  const abs = resolve(target);
  if (!existsSync(abs)) {
    console.error(`scan: no such path: ${target}`);
    process.exit(2);
  }
  if (excluded(abs)) continue;
  if (statSync(abs).isDirectory()) {
    for (const f of gitFiles(abs) ?? walk(abs)) if (!excluded(f)) scanFile(f, false);
  } else {
    scanFile(abs, true);
  }
}

findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

if (json) {
  console.log(JSON.stringify(findings, null, 2));
} else if (findings.length === 0) {
  console.log("No tells found.");
} else {
  for (const f of findings) {
    console.log(`${f.file}:${f.line}  ${f.id}  ${f.title}: "${f.match}"`);
  }
  const counts = {};
  for (const f of findings) counts[f.id] = (counts[f.id] ?? 0) + 1;
  const files = new Set(findings.map((f) => f.file)).size;
  const summary = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([id, n]) => `${id} x${n}`)
    .join(", ");
  console.log(`\n${findings.length} hits in ${files} files (${summary})`);
  console.log("Hits are candidates. Judge each against the tell's definition before changing anything.");
}

// exitCode, not exit(): exit() can drop the end of a large --json output on a pipe.
process.exitCode = check && findings.length > 0 ? 1 : 0;
