#!/usr/bin/env node
// Change ledger: one JSON line per change an unslop skill makes, keeps, or proposes, with the
// reason and the evidence. report.mjs renders it as HTML. The source of truth is
// shared/ledger.mjs; tools/sync.mjs copies it into every skill's scripts/ folder.
//
// Usage:
//   node ledger.mjs start             begin a run: archive the previous ledger, record HEAD
//   node ledger.mjs add --skill <name> --tell <id> --action <action> --why "<reason>"
//                       [--evidence "<check>"] [--file <path>] [--line <n>] [--what "<thing>"]
//                       [--count <n>] [--commit <sha>]
//   node ledger.mjs import <file|-> [--skill <name>]
//                       a batch as JSON lines or a JSON array, same fields as add. --skill fills
//                       in the skill for every entry that names none. One call per batch keeps a
//                       run's ledger to a handful of tool calls; an invalid entry rejects the batch.
//   node ledger.mjs path              print the ledger path
//
// Actions: remove (code inside a file), delete-file, rewrite, merge, move, keep, propose.
// remove, delete-file, rewrite, merge, and move need --evidence: the command or check that
// showed the change was safe ("rg getUser: 0 callers", "knip: unused export", "tests green").
// --count lets one entry stand for the same mechanical fix repeated in one file.
// report.mjs diffs against the commit recorded by `start`, so run it before the first change.
//
// The ledger lives at <repo root>/.unslop/ledger.jsonl (UNSLOP_LEDGER overrides). The folder
// gets its own .gitignore, and in a git repo .unslop/ is also added to .git/info/exclude, so it
// stays out of commits and lint runs without touching the project's .gitignore.
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

const ACTIONS = ["remove", "delete-file", "rewrite", "merge", "move", "keep", "propose"];
const NEEDS_EVIDENCE = new Set(["remove", "delete-file", "rewrite", "merge", "move"]);
const FIELDS = ["skill", "tell", "action", "file", "line", "what", "why", "evidence", "count", "commit"];

const git = (...a) => {
  try { return execFileSync("git", a, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { return null; }
};
const root = git("rev-parse", "--show-toplevel") ?? process.cwd();
const ledgerPath = process.env.UNSLOP_LEDGER ? resolve(process.env.UNSLOP_LEDGER) : join(root, ".unslop", "ledger.jsonl");

function fail(message) {
  console.error(`ledger: ${message}`);
  process.exit(2);
}

function validate(raw, where) {
  const entry = {};
  for (const key of Object.keys(raw)) if (!FIELDS.includes(key)) fail(`${where}: unknown field "${key}"`);
  for (const key of FIELDS) if (raw[key] !== undefined && raw[key] !== "") entry[key] = raw[key];
  if (!/^unslop-[a-z]+$/.test(entry.skill ?? "")) fail(`${where}: --skill must be a skill name like unslop-typescript`);
  if (!/^[a-z]+-\d+$/.test(entry.tell ?? "")) fail(`${where}: --tell must be a tell id like ts-12`);
  if (!ACTIONS.includes(entry.action)) fail(`${where}: --action must be one of ${ACTIONS.join(", ")}`);
  if (!String(entry.why ?? "").trim()) fail(`${where}: --why is required: say why this change, keep, or proposal is right`);
  if (NEEDS_EVIDENCE.has(entry.action) && !String(entry.evidence ?? "").trim()) {
    fail(`${where}: --evidence is required for ${entry.action}: name the command or check that showed it was safe`);
  }
  for (const key of ["line", "count"]) {
    if (entry[key] === undefined) continue;
    const n = Number(entry[key]);
    if (!Number.isInteger(n) || n < 1) fail(`${where}: --${key} must be a positive integer`);
    entry[key] = n;
  }
  if (entry.file) {
    const abs = isAbsolute(entry.file) ? entry.file : resolve(process.cwd(), entry.file);
    entry.file = relative(root, abs).split("\\").join("/");
  }
  return { time: new Date().toISOString(), ...entry };
}

// Two guards keep run output out of the project. A .gitignore inside .unslop/ is the one that
// linters and formatters read (XO, ESLint, Prettier, Biome honor .gitignore files, not
// .git/info/exclude), so they skip a report that can run to megabytes. The info/exclude line
// keeps git quiet even if that file is deleted.
function ensureExcluded() {
  if (!ledgerPath.startsWith(join(root, ".unslop"))) return;
  const own = join(root, ".unslop", ".gitignore");
  if (!existsSync(own)) {
    mkdirSync(dirname(own), { recursive: true });
    writeFileSync(own, "# unslop run output: the ledger and report are never committed or linted\n*\n");
  }
  const exclude = git("rev-parse", "--git-path", "info/exclude");
  if (!exclude) return;
  const path = isAbsolute(exclude) ? exclude : join(root, exclude);
  const current = existsSync(path) ? readFileSync(path, "utf8") : "";
  if (current.split("\n").some((l) => l.trim() === ".unslop/")) return;
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${current && !current.endsWith("\n") ? "\n" : ""}# unslop change ledger and reports\n.unslop/\n`);
}

function write(entries) {
  mkdirSync(dirname(ledgerPath), { recursive: true });
  ensureExcluded();
  appendFileSync(ledgerPath, entries.map((e) => JSON.stringify(e)).join("\n") + "\n");
  console.log(`ledger: recorded ${entries.length} entr${entries.length === 1 ? "y" : "ies"} in ${relative(process.cwd(), ledgerPath) || ledgerPath}`);
}

function parseFlags(args) {
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const m = /^--([a-z]+)$/.exec(args[i]);
    if (!m) fail(`unexpected argument "${args[i]}"`);
    if (i + 1 >= args.length) fail(`--${m[1]} needs a value`);
    out[m[1]] = args[++i];
  }
  return out;
}

const [command, ...rest] = process.argv.slice(2);
if (command === "start") {
  mkdirSync(dirname(ledgerPath), { recursive: true });
  ensureExcluded();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  if (existsSync(ledgerPath) && statSync(ledgerPath).size > 0) {
    const history = join(dirname(ledgerPath), "history");
    mkdirSync(history, { recursive: true });
    renameSync(ledgerPath, join(history, `ledger-${stamp}.jsonl`));
    const report = join(dirname(ledgerPath), "report.html");
    if (existsSync(report)) renameSync(report, join(history, `report-${stamp}.html`));
    console.log(`ledger: archived the previous run in ${relative(process.cwd(), history) || history}`);
  }
  const start = { type: "start", time: new Date().toISOString(), head: git("rev-parse", "HEAD"), branch: git("rev-parse", "--abbrev-ref", "HEAD") };
  appendFileSync(ledgerPath, JSON.stringify(start) + "\n");
  console.log(`ledger: started a run at ${start.head ? start.head.slice(0, 7) : "a directory without git"}`);
} else if (command === "add") {
  write([validate(parseFlags(rest), "add")]);
} else if (command === "import") {
  const source = rest.find((a, i) => !a.startsWith("--") && rest[i - 1] !== "--skill");
  if (!source) fail("import needs a file path, or - for stdin");
  const flags = parseFlags(rest.filter((a) => a !== source));
  for (const key of Object.keys(flags)) if (key !== "skill") fail(`import takes only --skill, not --${key}`);
  const text = readFileSync(source === "-" ? 0 : source, "utf8").trim();
  if (!text) fail("import: the batch is empty");
  let items;
  try {
    items = text.startsWith("[") ? JSON.parse(text) : text.split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
  } catch (e) {
    fail(`import: not valid JSON or JSON lines (${e.message})`);
  }
  if (!Array.isArray(items)) fail("import: a JSON batch must be an array or JSON lines");
  write(items.map((item, i) => validate(flags.skill && item.skill === undefined ? { skill: flags.skill, ...item } : item, `import entry ${i + 1}`)));
} else if (command === "path") {
  console.log(ledgerPath);
} else {
  const usage = readFileSync(new URL(import.meta.url), "utf8").split("\n").filter((l) => l.startsWith("//")).map((l) => l.replace(/^\/\/ ?/, ""));
  console.log(usage.slice(0, usage.findIndex((l) => l.startsWith("The ledger lives")) + 3).join("\n"));
  process.exit(command === "--help" || command === "help" || !command ? 0 : 2);
}
