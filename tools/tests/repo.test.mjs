import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { root } from "./helpers.mjs";

test("vendored scanners match shared/scan.mjs", () => {
  const r = spawnSync("node", [join(root, "tools", "sync.mjs"), "--check"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
});
