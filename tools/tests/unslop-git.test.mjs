import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { script, repo } from "./helpers.mjs";

const lintRange = (dir, range) => JSON.parse(execFileSync("node", [script("unslop-git", "lint-msg.mjs"), "--json", "--range", range], { cwd: dir, encoding: "utf8" }));
const ids = (r) => [...new Set(r.hits.map((h) => h.id))].sort();

test("git lint-msg.mjs flags slop and passes a good message", () => {
  const { dir, commit } = repo();
  commit("a.txt", "Initial commit");
  commit("b.ts", "Update files", "- Updated b.ts to add b\n- Added c.ts\n\n**Summary:** This commit enhances overall code quality.\nI've also tidied things up.\n\n🤖 Generated with Claude Code\n\nCo-authored-by: Claude <noreply@anthropic.com>");
  commit("c.ts", "Reject expired tokens in auth middleware", "The old check compared local time, so tokens issued near midnight UTC\nstayed valid an extra day.");
  const [good, bad] = lintRange(dir, "main~2..main");
  assert.deepEqual(good.hits, []);
  assert.deepEqual(ids(bad), ["git-1", "git-3", "git-4", "git-5", "git-6", "git-7", "git-9"]);
  assert.equal(bad.hits.filter((h) => h.id === "git-7").length, 2, "footer and trailer are both attribution");
  const hook = spawnSync("node", [script("unslop-git", "lint-msg.mjs"), "--check", "-"], { input: "Fix bug\n", encoding: "utf8" });
  assert.equal(hook.status, 1);
});

test("git lint-msg.mjs keeps history lines that start with # and strips git comments from files", () => {
  const { dir, commit } = repo();
  commit("a.txt", "Initial commit");
  commit("b.txt", "#123 Reject expired tokens", "#456 tracks the follow-up.");
  const [r] = lintRange(dir, "main~1..main");
  assert.deepEqual(r.hits, []);
  assert.equal(r.subject, "#123 Reject expired tokens");
  const file = join(mkdtempSync(join(tmpdir(), "unslop-msg-")), "msg");
  writeFileSync(file, "Reject expired tokens\n\n# Please enter the commit message for your changes.\n#\tmodified: a.txt\n");
  const out = JSON.parse(execFileSync("node", [script("unslop-git", "lint-msg.mjs"), "--json", file], { encoding: "utf8" }));
  assert.deepEqual(out[0].hits, []);
});

test("git lint-msg.mjs ignores squash suffixes, trailers, versions, and human co-authors", () => {
  const { dir, commit } = repo();
  commit("a.txt", "Initial commit");
  commit("b.txt", "fix(router): keep the trailing slash when the route has a query string (#7123)",
    "Co-authored-by: Claude Dupont <claude.dupont@example.org>\nSigned-off-by: Someone With A Very Long Name Indeed <someone.with.a.very.long.name@example.org>");
  commit("c.txt", "5.3.0");
  commit("d.txt", "deps: proxy-addr@^2.0.8");
  commit("e.txt", "Add retry and remove the dead fallback");
  commit("f.txt", "Support the adder and subtractor opcodes");
  const results = lintRange(dir, "main~5..main");
  const bySubject = Object.fromEntries(results.map((r) => [r.subject, ids(r)]));
  assert.deepEqual(bySubject["fix(router): keep the trailing slash when the route has a query string (#7123)"], []);
  assert.deepEqual(bySubject["5.3.0"], []);
  assert.deepEqual(bySubject["deps: proxy-addr@^2.0.8"], []);
  assert.deepEqual(bySubject["Add retry and remove the dead fallback"], ["git-8"]);
  assert.deepEqual(bySubject["Support the adder and subtractor opcodes"], []);
});

test("git lint-msg.mjs reports a bad range without a stack trace", () => {
  const { dir } = repo();
  const r = spawnSync("node", [script("unslop-git", "lint-msg.mjs"), "--range", "nope..HEAD"], { cwd: dir, encoding: "utf8" });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /^lint-msg: git log failed/);
  assert.doesNotMatch(r.stderr, /at .*\.mjs:\d+/);
});

test("git reword.mjs rewrites messages, keeps trees, and leaves a backup ref", () => {
  const { dir, git, commit } = repo();
  commit("a.txt", "Initial commit");
  commit("b.txt", "wip");
  commit("c.txt", "Update files");
  const tree = git("rev-parse", "HEAD^{tree}");
  const map = { [git("rev-parse", "--short", "HEAD~1")]: "Add b fixture", [git("rev-parse", "--short", "HEAD")]: "Add c fixture\n\nNeeded by the parser tests." };
  const mapFile = join(mkdtempSync(join(tmpdir(), "unslop-map-")), "map.json");
  writeFileSync(mapFile, JSON.stringify(map));
  execFileSync("node", [script("unslop-git", "reword.mjs"), mapFile], { cwd: dir, encoding: "utf8" });
  assert.deepEqual(git("log", "--format=%s").split("\n"), ["Add c fixture", "Add b fixture", "Initial commit"]);
  assert.equal(git("log", "-1", "--format=%b"), "Needed by the parser tests.");
  assert.equal(git("rev-parse", "HEAD^{tree}"), tree);
  assert.match(git("for-each-ref", "refs/unslop"), /refs\/unslop\/backup-/);
});

test("git reword.mjs handles the root commit, a 6-char sha, a leading #, and untracked files", () => {
  const { dir, git, commit } = repo();
  commit("a.txt", "wip");
  commit("b.txt", "stuff");
  writeFileSync(join(dir, "scratch.log"), "untracked");
  const map = { [git("rev-parse", "HEAD~1").slice(0, 6)]: "Add a fixture", [git("rev-parse", "HEAD")]: "#123 Add b fixture\n\n#456 is the tracking issue." };
  const mapFile = join(mkdtempSync(join(tmpdir(), "unslop-map-")), "map.json");
  writeFileSync(mapFile, JSON.stringify(map));
  execFileSync("node", [script("unslop-git", "reword.mjs"), mapFile], { cwd: dir, encoding: "utf8" });
  assert.deepEqual(git("log", "--format=%s").split("\n"), ["#123 Add b fixture", "Add a fixture"]);
  assert.equal(git("log", "-1", "--format=%b"), "#456 is the tracking issue.");
  assert.equal(git("status", "--porcelain"), "?? scratch.log");
});

test("git reword.mjs refuses a dirty worktree and pushed commits", () => {
  const { dir, git, commit } = repo();
  commit("a.txt", "Initial commit");
  commit("b.txt", "wip");
  const mapFile = join(mkdtempSync(join(tmpdir(), "unslop-map-")), "map.json");
  writeFileSync(mapFile, JSON.stringify({ [git("rev-parse", "HEAD")]: "Add b" }));
  writeFileSync(join(dir, "a.txt"), "dirty");
  let r = spawnSync("node", [script("unslop-git", "reword.mjs"), mapFile], { cwd: dir, encoding: "utf8" });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /uncommitted changes/);
  git("checkout", "--", "a.txt");
  const remote = mkdtempSync(join(tmpdir(), "unslop-remote-"));
  execFileSync("git", ["init", "-q", "--bare", remote]);
  git("remote", "add", "origin", remote);
  git("push", "-q", "origin", "main");
  r = spawnSync("node", [script("unslop-git", "reword.mjs"), mapFile], { cwd: dir, encoding: "utf8" });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /already on a remote branch/);
});
