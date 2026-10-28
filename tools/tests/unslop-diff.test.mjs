import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { script, repo } from "./helpers.mjs";

const scan = (dir, ...args) => JSON.parse(execFileSync("node", [script("unslop-typescript", "scan.mjs"), "--json", ...args], { cwd: dir, encoding: "utf8" }));
const where = (findings) => findings.map((f) => `${f.file}:${f.line}`).sort();

// main has old slop; a feature branch adds new slop next to it, stages a new file, and leaves an
// untracked one.
function branchRepo() {
  const r = repo();
  const put = (file, text) => { mkdirSync(join(r.dir, file, ".."), { recursive: true }); writeFileSync(join(r.dir, file), text); };
  put("src/a.ts", "export const old = (x: any) => x;\nexport const keep = 1;\n");
  put("src/gone.ts", "export const gone = (x: any) => x;\n");
  r.git("add", ".");
  r.git("commit", "-q", "-m", "Add a");
  r.git("checkout", "-q", "-b", "feature");
  put("src/a.ts", "export const old = (x: any) => x;\nexport const keep = 1;\nexport const added = (y: any) => y;\n");
  r.git("rm", "-q", "src/gone.ts");
  r.git("commit", "-q", "-am", "Add added");
  return { ...r, put };
}

test("scan.mjs --diff keeps findings on changed lines and counts new files in full", () => {
  const { dir, git, put } = branchRepo();
  assert.deepEqual(where(scan(dir)), ["src/a.ts:1", "src/a.ts:3"], "a full scan sees the old slop too");
  assert.deepEqual(where(scan(dir, "--diff")), ["src/a.ts:3"], "the old line is out of the diff");

  put("src/staged.ts", "export const s = (z: any) => z;\n");
  git("add", "src/staged.ts");
  put("src/untracked.ts", "export const u = (w: any) => w;\n");
  put("src/a.ts", "export const old = (x: any) => x;\nexport const keep = 1 as any;\nexport const added = (y: any) => y;\n");
  assert.deepEqual(where(scan(dir, "--diff")), ["src/a.ts:2", "src/a.ts:3", "src/staged.ts:1", "src/untracked.ts:1"]);
  assert.deepEqual(where(scan(dir, "--diff=HEAD")), ["src/a.ts:2", "src/staged.ts:1", "src/untracked.ts:1"], "HEAD is uncommitted work alone");
  assert.deepEqual(where(scan(dir, "--diff=HEAD", "--exclude", join(dir, "src/staged.ts"))), ["src/a.ts:2", "src/untracked.ts:1"]);
});

test("scan.mjs --diff fails clearly outside git or with an unknown base", () => {
  const { dir } = branchRepo();
  const bad = spawnSync("node", [script("unslop-typescript", "scan.mjs"), "--diff=nope"], { cwd: dir, encoding: "utf8" });
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /no merge base between nope and HEAD/);
});

test("detect.mjs --changed counts staged files that were not edited again", () => {
  const { dir, git, put } = branchRepo();
  put("docs/new.md", "# New\n");
  git("add", "docs/new.md");
  const out = JSON.parse(execFileSync("node", [script("unslop-diff", "detect.mjs"), "--json", "--changed=HEAD"], { cwd: dir, encoding: "utf8" }));
  assert.deepEqual(out.plan.map((p) => p.skill), ["unslop-text"]);
  assert.equal(out.detected.text.files, 1);
  const branch = JSON.parse(execFileSync("node", [script("unslop-diff", "detect.mjs"), "--json", "--changed"], { cwd: dir, encoding: "utf8" }));
  assert.deepEqual(branch.plan.map((p) => p.skill), ["unslop-typescript", "unslop-text", "unslop-git"]);
});

test("a run started on uncommitted work reports only its own changes", () => {
  const { dir, git, put } = branchRepo();
  put("src/wip.ts", "export const wip = 1;\n");
  put("src/a.ts", "export const old = (x: any) => x;\nexport const keep = 2;\nexport const added = (y: any) => y;\n");
  const before = git("status", "--porcelain");
  const node = (name, ...args) => execFileSync("node", [script("unslop-diff", name), ...args], { cwd: dir, encoding: "utf8" });
  node("ledger.mjs", "start");
  assert.equal(git("status", "--porcelain").replace(/\n?\?\? \.unslop\/\n?/, ""), before, "start leaves the index and worktree alone");
  assert.match(git("for-each-ref", "refs/unslop/start"), /refs\/unslop\/start/);

  put("src/a.ts", "export const old = (x: unknown) => x;\nexport const keep = 2;\nexport const added = (y: any) => y;\n");
  execFileSync("node", [script("unslop-diff", "ledger.mjs"), "import", "-", "--skill", "unslop-typescript"], {
    cwd: dir, encoding: "utf8", input: JSON.stringify({ tell: "ts-1", action: "rewrite", file: "src/a.ts", line: 1, why: "any where unknown fits", evidence: "tsc green" }),
  });
  assert.match(node("report.mjs"), /1 entry across 1 file\)$/m, "src/wip.ts and the earlier edit to src/a.ts are not the run's");
  const html = readFileSync(join(dir, ".unslop", "report.html"), "utf8");
  assert.doesNotMatch(html, /Changed with no ledger entry/);
  assert.match(html, /-export const old = \(x: any\) =&gt; x;/);
  assert.doesNotMatch(html, /keep = 1/, "the diff starts after the earlier uncommitted edit");
});
