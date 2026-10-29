// The working tree as a git tree: tracked changes and untracked files, ignored files left out.
// ledger.mjs records it when a run starts and report.mjs diffs against it, so uncommitted work
// that was there before the run is not reported as the run's change. The source of truth is
// shared/worktree.mjs; tools/sync.mjs copies it into every skill's scripts/ folder.
import { copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

// Goes through a temporary copy of the index, so the real index and the worktree stay as they
// are. Returns null outside git, before the first commit, or when git refuses (a bare repo, a
// locked index): the snapshot is optional, and the callers fall back to HEAD.
export function worktreeTree(root) {
  const run = (env, ...a) => execFileSync("git", a, { cwd: root, env, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 28 }).trim();
  let head;
  try { head = run(process.env, "rev-parse", "--verify", "-q", "HEAD"); } catch { return null; }
  const dir = mkdtempSync(join(tmpdir(), "unslop-index-"));
  const index = join(dir, "index");
  try {
    const own = run(process.env, "rev-parse", "--path-format=absolute", "--git-path", "index");
    if (own && existsSync(own)) copyFileSync(own, index);
    const env = { ...process.env, GIT_INDEX_FILE: index };
    if (!existsSync(index)) run(env, "read-tree", head);
    run(env, "add", "-A");
    return run(env, "write-tree");
  } catch {
    return null;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
