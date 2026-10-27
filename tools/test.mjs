// Fixture tests for every skill script. Run with `npm test` (node --test).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const script = (skill, name) => join(root, "skills", skill, "scripts", name);
const fixtures = (name) => join(root, "fixtures", name);

function scan(skill, fixture, files) {
  const out = execFileSync("node", [script(skill, "scan.mjs"), "--json", ...files], { cwd: fixtures(fixture), encoding: "utf8" });
  return JSON.parse(out);
}
const ids = (findings) => new Set(findings.map((f) => f.id));

const SCANNERS = [
  { skill: "unslop-text", fixture: "text", slop: ["slop.md"], clean: ["clean.md"],
    expect: ["text-1", "text-5", "text-7", "text-8", "text-9", "text-10", "text-11", "text-12", "text-15", "text-16", "text-17", "text-19", "text-20", "text-25", "text-26", "text-27", "text-30"] },
  { skill: "unslop-typescript", fixture: "typescript", slop: ["slop.ts"], clean: ["clean.ts"],
    expect: ["ts-1", "ts-2", "ts-3", "ts-4", "ts-7", "ts-9", "ts-10", "ts-11", "ts-17", "ts-18", "ts-19", "ts-20"] },
  { skill: "unslop-react", fixture: "react", slop: ["Slop.tsx"], clean: ["Clean.tsx", "Buttons.tsx"],
    expect: ["react-1", "react-2", "react-4", "react-5", "react-7", "react-8", "react-10", "react-11", "react-12", "react-17", "react-18", "react-19", "react-20"] },
  { skill: "unslop-csharp", fixture: "csharp", slop: ["UserManager.cs"], clean: ["OrderService.cs"],
    expect: ["cs-5", "cs-7", "cs-8", "cs-9", "cs-10", "cs-11", "cs-12", "cs-13", "cs-14", "cs-15", "cs-16", "cs-17", "cs-18", "cs-19"] },
  { skill: "unslop-tests", fixture: "tests", slop: ["slop.test.ts", "UserServiceTests.cs", "test_slop.py", "slop_test.go"], clean: ["clean.test.ts"],
    expect: ["tests-1", "tests-2", "tests-3", "tests-4", "tests-7", "tests-8", "tests-11", "tests-12", "tests-13", "tests-15", "tests-16"] },
  { skill: "unslop-ui", fixture: "ui", slop: ["Landing.tsx", "site.css"], clean: ["Clean.tsx"],
    expect: ["ui-1", "ui-5", "ui-6", "ui-7", "ui-8", "ui-11", "ui-13", "ui-15", "ui-16", "ui-17", "ui-19", "ui-20", "ui-21"] },
];

for (const s of SCANNERS) {
  test(`${s.skill}: finds every expected tell in the slop fixture`, () => {
    const found = ids(scan(s.skill, s.fixture, s.slop));
    const missing = s.expect.filter((id) => !found.has(id));
    assert.deepEqual(missing, [], `missing ${missing.join(", ")}`);
  });
  test(`${s.skill}: stays silent on the clean fixture`, () => {
    const findings = scan(s.skill, s.fixture, s.clean);
    assert.deepEqual(findings.map((f) => `${f.file}:${f.line} ${f.id} ${f.match}`), []);
  });
}

test("vendored scanners match shared/scan.mjs", () => {
  const r = spawnSync("node", [join(root, "tools", "sync.mjs"), "--check"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
});

test("scan.mjs honours unslop-ignore markers", () => {
  const dir = mkdtempSync(join(tmpdir(), "unslop-ignore-"));
  writeFileSync(join(dir, "a.md"), "We delve into it. <!-- unslop-ignore -->\nWe delve again.\n");
  writeFileSync(join(dir, "b.md"), "<!-- unslop-ignore-file -->\nWe delve into it.\n");
  const out = JSON.parse(execFileSync("node", [script("unslop-text", "scan.mjs"), "--json", "a.md", "b.md"], { cwd: dir, encoding: "utf8" }));
  assert.deepEqual(out.map((f) => `${f.file}:${f.line}`), ["a.md:2"]);
});

test("ui tokens.mjs counts sprawl and unused variables", () => {
  const report = JSON.parse(execFileSync("node", [script("unslop-ui", "tokens.mjs"), "--json", "."], { cwd: fixtures("ui"), encoding: "utf8" }));
  assert.ok(report.colors.length >= 10);
  assert.deepEqual(report.cssVariables.unused.sort(), ["paper", "unused-token"]);
  assert.ok(report.arbitrary.some((a) => a.value === "mt-[13px]"));
});

test("react inventory.mjs groups same-role components", () => {
  const report = JSON.parse(execFileSync("node", [script("unslop-react", "inventory.mjs"), "--json", "."], { cwd: fixtures("react"), encoding: "utf8" }));
  assert.deepEqual(report.similar.Button.map((c) => c.name).sort(), ["BlueButton", "PrimaryButton", "SaveButton", "SubmitButton"]);
  assert.ok(report.duplicateNames.Profile);
});

function repo() {
  const dir = mkdtempSync(join(tmpdir(), "unslop-git-"));
  const git = (...a) => execFileSync("git", a, { cwd: dir, encoding: "utf8" }).trim();
  git("init", "-q", "-b", "main");
  git("config", "user.email", "t@example.org");
  git("config", "user.name", "t");
  const commit = (file, ...msg) => { writeFileSync(join(dir, file), file); git("add", "."); git("commit", "-q", ...msg.flatMap((m) => ["-m", m])); };
  return { dir, git, commit };
}

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

test("all detect.mjs plans the passes from the fixtures", () => {
  const out = JSON.parse(execFileSync("node", [script("unslop-all", "detect.mjs"), "--json", fixtures(".")], { encoding: "utf8" }));
  const skills = out.plan.map((p) => p.skill);
  assert.deepEqual(skills.filter((s) => s !== "unslop-git"), ["unslop-tests", "unslop-typescript", "unslop-csharp", "unslop-text"]);
  assert.equal(out.detected.react.uses, true);
});

const hasDotnet = spawnSync("dotnet", ["--version"]).status === 0;
test("csharp dead-code.mjs reports unused members and removes its .globalconfig", { skip: !hasDotnet && "dotnet not installed", timeout: 300_000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), "unslop-cs-"));
  writeFileSync(join(dir, "Demo.csproj"), '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net' +
    execFileSync("dotnet", ["--version"], { encoding: "utf8" }).split(".")[0] + '.0</TargetFramework><Nullable>enable</Nullable></PropertyGroup></Project>');
  writeFileSync(join(dir, "Program.cs"), "using System.Text;\nnamespace Demo;\npublic class S { private int _unused; private void Helper() { } public int Add(int a, int b, int c) => a + b; }\n" +
    "public static class Program { public static void Main() => System.Console.WriteLine(new S().Add(1, 2, 3)); }\n");
  const out = execFileSync("node", [script("unslop-csharp", "dead-code.mjs"), join(dir, "Demo.csproj")], { cwd: dir, encoding: "utf8" });
  for (const id of ["IDE0005", "IDE0051", "IDE0060"]) assert.match(out, new RegExp(id));
  assert.equal(existsSync(join(dir, ".globalconfig")), false);
});
