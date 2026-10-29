// The files under a folder: what git tracks or could track (ignored files left out), or a plain
// walk outside git, skipping the folders in `skip`. The source of truth is shared/files.mjs;
// tools/sync.mjs copies it into the skills whose inventory scripts read a folder.
import { readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

export function listFiles(dir, skip) {
  try {
    return execFileSync("git", ["ls-files", "-z", "-co", "--exclude-standard"], { cwd: dir, maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] })
      .toString().split("\0").filter(Boolean).map((f) => join(dir, f));
  } catch {
    const acc = [];
    const walk = (d) => readdirSync(d, { withFileTypes: true }).forEach((e) => {
      const p = join(d, e.name);
      if (e.isDirectory() && !skip.test(p)) walk(p); else if (e.isFile()) acc.push(p);
    });
    walk(dir);
    return acc;
  }
}
