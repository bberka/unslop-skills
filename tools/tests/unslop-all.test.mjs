import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { script, fixtures } from "./helpers.mjs";

test("all detect.mjs plans the passes from the fixtures", () => {
  const out = JSON.parse(execFileSync("node", [script("unslop-all", "detect.mjs"), "--json", fixtures(".")], { encoding: "utf8" }));
  const skills = out.plan.map((p) => p.skill);
  assert.deepEqual(skills.filter((s) => s !== "unslop-git"), ["unslop-tests", "unslop-typescript", "unslop-csharp", "unslop-text"]);
  assert.equal(out.detected.react.uses, true);
});
