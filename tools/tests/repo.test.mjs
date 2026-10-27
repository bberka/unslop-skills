import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { root } from "./helpers.mjs";

test("vendored scanners match shared/scan.mjs", () => {
  const r = spawnSync("node", [join(root, "tools", "sync.mjs"), "--check"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
});

test("scan.mjs writes a complete --json report through a pipe, past the 64 KB pipe buffer", () => {
  const dir = mkdtempSync(join(tmpdir(), "unslop-pipe-"));
  writeFileSync(join(dir, "noisy.ts"), "export const f = (x: any) => x;\n".repeat(3000));
  const out = execFileSync("node", [join(root, "skills", "unslop-typescript", "scripts", "scan.mjs"), "--json", "noisy.ts"], { cwd: dir, encoding: "utf8", maxBuffer: 1 << 26 });
  assert.ok(out.length > 65536);
  assert.equal(JSON.parse(out).length, 3000);
});
