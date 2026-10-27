import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { script, fixtures, repo } from "./helpers.mjs";

const detect = (path) => JSON.parse(execFileSync("node", [script("unslop-all", "detect.mjs"), "--json", path], { encoding: "utf8" }));

test("all detect.mjs plans the passes from the fixtures", () => {
  const out = detect(fixtures("."));
  const skills = out.plan.map((p) => p.skill);
  assert.deepEqual(skills.filter((s) => s !== "unslop-git"), ["unslop-tests", "unslop-typescript", "unslop-csharp", "unslop-text"]);
  assert.equal(out.detected.react.uses, true);
  const git = out.plan.find((p) => p.skill === "unslop-git");
  assert.match(git.range, /^(?:HEAD|HEAD~20\.\.HEAD|\S+\.\.HEAD)$/, "a range git log accepts");
});

test("all detect.mjs skips changelogs when counting docs and picks the git range from the branch", () => {
  const { dir, git, commit } = repo();
  commit("README.md", "Add readme");
  commit("CHANGELOG.md", "Add changelog");
  assert.equal(detect(dir).detected.text.files, 1);
  assert.equal(detect(dir).plan.find((p) => p.skill === "unslop-git").range, "HEAD");
  git("checkout", "-q", "-b", "feature");
  commit("notes.txt", "Add notes");
  assert.equal(detect(dir).plan.find((p) => p.skill === "unslop-git").range, "main..HEAD");
});
