// Shared helpers for the per-skill fixture tests in this folder.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const script = (skill, name) => join(root, "skills", skill, "scripts", name);
export const fixtures = (name) => join(root, "fixtures", name);

export function scan(skill, fixture, files) {
  const out = execFileSync("node", [script(skill, "scan.mjs"), "--json", ...files], { cwd: fixtures(fixture), encoding: "utf8" });
  return JSON.parse(out);
}

// Registers the two standard scanner tests: every expected tell is found in the
// slop fixture, and the clean fixture produces no findings.
export function scannerTests({ skill, fixture, slop, clean, expect }) {
  test(`${skill}: finds every expected tell in the slop fixture`, () => {
    const found = new Set(scan(skill, fixture, slop).map((f) => f.id));
    const missing = expect.filter((id) => !found.has(id));
    assert.deepEqual(missing, [], `missing ${missing.join(", ")}`);
  });
  test(`${skill}: stays silent on the clean fixture`, () => {
    const findings = scan(skill, fixture, clean);
    assert.deepEqual(findings.map((f) => `${f.file}:${f.line} ${f.id} ${f.match}`), []);
  });
}

// A throwaway git repo with a commit helper.
export function repo() {
  const dir = mkdtempSync(join(tmpdir(), "unslop-git-"));
  const git = (...a) => execFileSync("git", a, { cwd: dir, encoding: "utf8" }).trim();
  git("init", "-q", "-b", "main");
  git("config", "user.email", "t@example.org");
  git("config", "user.name", "t");
  const commit = (file, ...msg) => { writeFileSync(join(dir, file), file); git("add", "."); git("commit", "-q", ...msg.flatMap((m) => ["-m", m])); };
  return { dir, git, commit };
}
