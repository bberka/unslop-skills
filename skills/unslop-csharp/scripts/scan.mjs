#!/usr/bin/env node
// unslop-ignore-file
// Tell scanner. The source of truth is shared/scan.mjs; tools/sync.mjs copies it
// into each skill's scripts/ folder. Edit the shared copy, then run `npm run sync`.
//
// Usage: node scan.mjs [--json] [--check] [--exclude <path>]... [--diff[=<base>]] [paths...]
//   Scans files with the rules in ./rules.mjs. Directories are walked (git-aware,
//   skipping dependency, build, and agent-tooling folders) and filtered by each rule's
//   `files` pattern; files named explicitly get every rule.
//   --json     machine-readable output
//   --check    exit 1 when anything is found (for hooks and CI)
//   --exclude  skip a file or folder (repeatable), for areas the project puts off limits
//   --diff     scan only what changed since the merge base with <base> (default: the default
//              branch), counting committed, staged, unstaged, and untracked work. Findings are
//              kept only on added or changed lines; a new file counts in full. A tell reported
//              for a whole file (line 1) shows only when that line changed. --diff=HEAD covers
//              uncommitted work alone.
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

import { readFileSync, readdirSync, statSync, existsSync, realpathSync } from "node:fs";
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
let diffBase = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--diff" || args[i].startsWith("--diff=")) {
    diffBase = args[i].includes("=") ? args[i].slice("--diff=".length) : "";
  } else if (args[i] === "--exclude") {
    if (!args[i + 1]) { console.error("scan: --exclude needs a path"); process.exit(2); }
    excludes.push(resolve(args[++i]));
  } else if (!args[i].startsWith("--")) {
    targets.push(args[i]);
  }
}
if (targets.length === 0) targets.push(".");
const excluded = (abs) => excludes.some((e) => abs === e || abs.startsWith(e.endsWith("/") ? e : `${e}/`));
const real = (p) => { try { return realpathSync(p); } catch { return resolve(p); } };

// --diff: changed line ranges per file, keyed by real path; "all" for an untracked file.
function diffRanges(ref) {
  const git = (...a) => {
    try {
      return execFileSync("git", ["-c", "core.quotePath=false", ...a], { stdio: ["ignore", "pipe", "ignore"], encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
    } catch {
      return null;
    }
  };
  const root = git("rev-parse", "--show-toplevel")?.trim();
  if (!root) { console.error("scan: --diff needs a git repository"); process.exit(2); }
  let base = ref;
  if (!base) {
    base = git("symbolic-ref", "--short", "refs/remotes/origin/HEAD")?.trim().replace(/^origin\//, "")
      ?? ["main", "master", "trunk", "develop"].find((b) => git("rev-parse", "--verify", "-q", b) !== null);
    if (!base) { console.error("scan: no default branch found; pass --diff=<base>"); process.exit(2); }
  }
  const mergeBase = git("merge-base", base, "HEAD")?.trim();
  if (!mergeBase) { console.error(`scan: no merge base between ${base} and HEAD`); process.exit(2); }
  const ranges = new Map();
  let current = null;
  for (const line of (git("diff", "-U0", "--no-color", "--no-ext-diff", "--find-renames", mergeBase) ?? "").split("\n")) {
    if (line.startsWith("+++ ")) {
      const path = line.slice(4);
      current = path === "/dev/null" ? null : real(join(root, path.replace(/^b\//, "")));
      if (current && !ranges.has(current)) ranges.set(current, []);
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunk && current) {
      const start = Number(hunk[1]);
      const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
      if (count > 0) ranges.get(current).push([start, start + count - 1]);
    }
  }
  for (const f of (git("ls-files", "-z", "--others", "--exclude-standard") ?? "").split("\0").filter(Boolean)) {
    ranges.set(real(join(root, f)), "all");
  }
  return { base, ranges };
}
const diff = diffBase === null ? null : diffRanges(diffBase);

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

  const changedLines = diff ? diff.ranges.get(real(path)) : null;
  const push = (rule, line, match) => {
    if (changedLines && changedLines !== "all" && !changedLines.some(([a, b]) => line >= a && line <= b)) return;
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

const underTarget = (abs) => targets.some((t) => { const r = real(t); return abs === r || abs.startsWith(`${r}/`); });
if (diff) {
  for (const [abs, lines] of diff.ranges) {
    if (lines !== "all" && lines.length === 0) continue;
    if (!existsSync(abs) || excluded(abs) || !underTarget(abs)) continue;
    if (abs.split(/[\\/]/).some((part) => SKIP_DIRS.has(part))) continue;
    scanFile(abs, false);
  }
}
for (const target of diff ? [] : targets) {
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
  console.log(`\n${findings.length} hits in ${files} files (${summary})${diff ? `, on lines changed since ${diff.base}` : ""}`);
  console.log("Hits are candidates. Judge each against the tell's definition before changing anything.");
}

// exitCode, not exit(): exit() can drop the end of a large --json output on a pipe.
process.exitCode = check && findings.length > 0 ? 1 : 0;
