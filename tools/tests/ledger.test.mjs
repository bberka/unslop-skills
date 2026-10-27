import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { script, repo } from "./helpers.mjs";

const ledger = (cwd, ...args) => spawnSync("node", [script("unslop-typescript", "ledger.mjs"), ...args], { cwd, encoding: "utf8" });
const report = (cwd, ...args) => spawnSync("node", [script("unslop-typescript", "report.mjs"), ...args], { cwd, encoding: "utf8" });
const records = (dir) => readFileSync(join(dir, ".unslop", "ledger.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
const remove = ["add", "--skill", "unslop-typescript", "--tell", "ts-12", "--action", "remove", "--file", "src/a.ts", "--why", "Forwards unchanged"];

test("ledger.mjs records entries, keeps .unslop/ out of git, and rejects entries without a reason or evidence", () => {
  const { dir, git, commit } = repo();
  commit("README.md", "Add readme");
  assert.equal(ledger(dir, "start").status, 0);
  assert.equal(ledger(dir, ...remove, "--evidence", "rg a: 0 callers", "--line", "4").status, 0);

  const bad = [
    [...remove],
    ["add", "--skill", "unslop-typescript", "--tell", "ts-12", "--action", "keep"],
    ["add", "--skill", "typescript", "--tell", "ts-12", "--action", "keep", "--why", "x"],
    ["add", "--skill", "unslop-typescript", "--tell", "12", "--action", "keep", "--why", "x"],
    ["add", "--skill", "unslop-typescript", "--tell", "ts-12", "--action", "nuke", "--why", "x"],
    [...remove, "--evidence", "x", "--line", "zero"],
  ];
  for (const args of bad) assert.equal(ledger(dir, ...args).status, 2, args.join(" "));
  const imported = spawnSync("node", [script("unslop-typescript", "ledger.mjs"), "import", "-"], { cwd: dir, encoding: "utf8", input: '{"skill":"unslop-git","tell":"git-1","action":"propose","why":"x","sha":"abc"}' });
  assert.equal(imported.status, 2, "unknown field");

  const [start, entry] = records(dir);
  assert.equal(start.type, "start");
  assert.equal(start.head, git("rev-parse", "HEAD"));
  assert.equal(entry.file, "src/a.ts");
  assert.equal(entry.line, 4);
  assert.equal(records(dir).length, 2, "rejected entries were not written");
  assert.match(readFileSync(join(dir, ".git", "info", "exclude"), "utf8"), /^\.unslop\/$/m);
  assert.equal(git("status", "--porcelain"), "");
});

test("ledger.mjs start archives the previous run", () => {
  const { dir, commit } = repo();
  commit("README.md", "Add readme");
  ledger(dir, "start");
  ledger(dir, ...remove, "--evidence", "x");
  writeFileSync(join(dir, ".unslop", "report.html"), "old");
  ledger(dir, "start");
  const history = readdirSync(join(dir, ".unslop", "history"));
  assert.equal(history.filter((f) => f.startsWith("ledger-")).length, 1);
  assert.equal(history.filter((f) => f.startsWith("report-")).length, 1);
  assert.deepEqual(records(dir).map((r) => r.type), ["start"]);
});

test("report.mjs renders every entry with its tell, reason, evidence, and diff, and flags unexplained changes", () => {
  const { dir, git, commit } = repo();
  commit("README.md", "Add readme");
  git("checkout", "-q", "-b", "feature");
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "src", "a.ts"), "export function getUser(id: string) {\n  return api.getUser(id);\n}\nexport const x = 1;\n");
  writeFileSync(join(dir, "src", "util.ts"), "export const helper = () => 1;\n");
  git("add", ".");
  git("commit", "-q", "-m", "Add source before the run");

  ledger(dir, "start");
  writeFileSync(join(dir, "src", "a.ts"), "export const x = 1;\n");
  git("rm", "-q", "src/util.ts");
  writeFileSync(join(dir, "README.md"), "Mentions <script>alert(1)</script>\n");
  ledger(dir, ...remove, "--line", "1", "--what", "getUser wrapper", "--evidence", "rg getUser: 2 callers migrated");
  ledger(dir, "add", "--skill", "unslop-typescript", "--tell", "ts-15", "--action", "delete-file", "--file", "src/util.ts", "--why", "Nothing imports it", "--evidence", "knip: unused file");

  const run = report(dir);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /2 entries across 2 files; 1 changed file has no ledger entry/);
  const html = readFileSync(join(dir, ".unslop", "report.html"), "utf8");
  assert.match(html, /Middle men/, "tell title from TELLS.md");
  assert.match(html, /Forwards unchanged/);
  assert.match(html, /rg getUser: 2 callers migrated/);
  assert.match(html, /-  return api\.getUser\(id\);/, "diff of the change");
  assert.match(html, /Deleted files \(1\)/);
  assert.match(html, /Changed with no ledger entry \(1\)[\s\S]*README\.md/);
  assert.doesNotMatch(html, /Add source before the run/);
  assert.match(html, /&lt;script&gt;alert/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /run start/, "diff base is the start commit, not the merge-base");
});

test("report.mjs works outside git and fails clearly without a ledger", () => {
  const dir = mkdtempSync(join(tmpdir(), "unslop-nogit-"));
  assert.equal(report(dir).status, 2);
  ledger(dir, "start");
  ledger(dir, "add", "--skill", "unslop-text", "--tell", "text-19", "--action", "rewrite", "--file", "notes.md", "--count", "3", "--why", "Em dashes", "--evidence", "scan.mjs: 0 text-19 hits after");
  const run = report(dir);
  assert.equal(run.status, 0, run.stderr);
  assert.ok(existsSync(join(dir, ".unslop", "report.html")));
  rmSync(dir, { recursive: true, force: true });
});
