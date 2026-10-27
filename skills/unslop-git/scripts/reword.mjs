#!/usr/bin/env node
// Rewrites commit messages without an interactive editor.
// Usage: node reword.mjs <messages.json> [--allow-pushed]
//   messages.json maps commit shas (full or abbreviated) to complete new messages:
//   { "a1b2c3d": "Reject expired tokens in auth middleware\n\nThe old check compared...", ... }
// Safety: requires a clean worktree, refuses ranges containing merges, refuses
// commits already on a remote branch unless --allow-pushed, and saves the old
// HEAD under refs/unslop/backup-<timestamp> before rebasing.
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const self = fileURLToPath(import.meta.url);
const git = (...a) => execFileSync("git", a, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const fail = (msg) => { console.error(`reword: ${msg}`); process.exit(1); };

// Sequence-editor mode: git calls us with the todo file path.
if (process.argv[2] === "--todo") {
  const plan = JSON.parse(readFileSync(process.argv[3], "utf8"));
  const todo = process.argv[4];
  const out = [];
  for (const line of readFileSync(todo, "utf8").split("\n")) {
    out.push(line);
    const m = /^(?:p|pick)\s+([0-9a-f]+)/.exec(line);
    if (!m) continue;
    const entry = plan.find((e) => e.sha.startsWith(m[1]) || m[1].startsWith(e.sha));
    if (entry) out.push(`exec git commit --amend --no-verify --allow-empty --quiet -F "${entry.file}"`);
  }
  writeFileSync(todo, out.join("\n"));
  process.exit(0);
}

const input = process.argv[2];
if (!input) fail("usage: node reword.mjs <messages.json> [--allow-pushed]");
const allowPushed = process.argv.includes("--allow-pushed");
const messages = JSON.parse(readFileSync(input, "utf8"));

if (git("status", "--porcelain")) fail("worktree is not clean; commit or stash first");
const gitDir = git("rev-parse", "--git-dir");
if (["rebase-merge", "rebase-apply"].some((d) => existsSync(join(gitDir, d)))) fail("a rebase is already in progress");

const dir = mkdtempSync(join(tmpdir(), "unslop-reword-"));
const plan = Object.entries(messages).map(([sha, message], i) => {
  let full;
  try { full = git("rev-parse", "--verify", `${sha}^{commit}`); } catch { fail(`unknown commit ${sha}`); }
  try { git("merge-base", "--is-ancestor", full, "HEAD"); } catch { fail(`${sha} is not an ancestor of HEAD`); }
  if (!message.trim()) fail(`empty message for ${sha}`);
  const file = join(dir, `msg-${i}.txt`);
  writeFileSync(file, message.endsWith("\n") ? message : message + "\n");
  return { sha: full, file };
});

const isAncestor = (a, b) => { try { git("merge-base", "--is-ancestor", a, b); return true; } catch { return false; } };
const oldest = plan.map((p) => p.sha).find((s) => plan.every((p) => isAncestor(s, p.sha)));
const parents = git("rev-list", "--parents", "-n", "1", oldest).split(" ").slice(1);
const range = parents.length ? `${oldest}^..HEAD` : "HEAD";

if (git("rev-list", "--merges", range)) fail("the range contains merge commits; reword those by hand");
if (!allowPushed) {
  for (const { sha } of plan) {
    if (git("branch", "-r", "--contains", sha)) {
      fail(`${sha.slice(0, 7)} is already on a remote branch. Rewriting it needs a force-push; rerun with --allow-pushed only if the user approved that.`);
    }
  }
}

const head = git("rev-parse", "HEAD");
const backup = `refs/unslop/backup-${Date.now()}`;
git("update-ref", backup, head);

const planFile = join(dir, "plan.json");
writeFileSync(planFile, JSON.stringify(plan));
const rebaseArgs = ["rebase", "-i", "--no-autosquash", "--no-update-refs", parents.length ? `${oldest}^` : "--root"];
try {
  execFileSync("git", rebaseArgs, {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, GIT_SEQUENCE_EDITOR: `node "${self}" --todo "${planFile}"`, GIT_EDITOR: "true" },
  });
} catch (e) {
  try { git("rebase", "--abort"); } catch {}
  fail(`rebase failed and was aborted; HEAD is unchanged.\n${e.stderr?.toString() ?? e.message}`);
}

console.log(`Reworded ${plan.length} commit(s). Old HEAD saved as ${backup} (${head.slice(0, 7)}).`);
console.log(`Undo with: git reset --hard ${backup}`);
console.log(git("log", "--format=%h %s", range));
