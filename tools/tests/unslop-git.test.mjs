import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { script, repo } from "./helpers.mjs";

test("git lint-msg.mjs flags slop and passes a good message", () => {
  const { dir, commit } = repo();
  commit("a.txt", "Initial commit");
  commit("b.ts", "Update files", "- Updated b.ts to add b\n- Added c.ts\n\n**Summary:** This commit enhances overall code quality.\n\n🤖 Generated with Claude Code");
  commit("c.ts", "Reject expired tokens in auth middleware", "The old check compared local time, so tokens issued near midnight UTC\nstayed valid an extra day.");
  const out = JSON.parse(execFileSync("node", [script("unslop-git", "lint-msg.mjs"), "--json", "--range", "main~2..main"], { cwd: dir, encoding: "utf8" }));
  const [good, bad] = out;
  assert.deepEqual(good.hits, []);
  assert.deepEqual([...new Set(bad.hits.map((h) => h.id))].sort(), ["git-1", "git-3", "git-4", "git-5", "git-6", "git-7", "git-9"]);
  const hook = spawnSync("node", [script("unslop-git", "lint-msg.mjs"), "--check", "-"], { input: "Fix bug\n", encoding: "utf8" });
  assert.equal(hook.status, 1);
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

test("git reword.mjs refuses a dirty worktree and pushed commits", () => {
  const { dir, git, commit } = repo();
  commit("a.txt", "Initial commit");
  commit("b.txt", "wip");
  const mapFile = join(mkdtempSync(join(tmpdir(), "unslop-map-")), "map.json");
  writeFileSync(mapFile, JSON.stringify({ [git("rev-parse", "HEAD")]: "Add b" }));
  writeFileSync(join(dir, "a.txt"), "dirty");
  let r = spawnSync("node", [script("unslop-git", "reword.mjs"), mapFile], { cwd: dir, encoding: "utf8" });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /not clean/);
  git("checkout", "--", "a.txt");
  const remote = mkdtempSync(join(tmpdir(), "unslop-remote-"));
  execFileSync("git", ["init", "-q", "--bare", remote]);
  git("remote", "add", "origin", remote);
  git("push", "-q", "origin", "main");
  r = spawnSync("node", [script("unslop-git", "reword.mjs"), mapFile], { cwd: dir, encoding: "utf8" });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /already on a remote branch/);
});
