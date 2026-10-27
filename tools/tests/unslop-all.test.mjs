import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { script, fixtures, repo } from "./helpers.mjs";

const detect = (args, cwd) => JSON.parse(execFileSync("node", [script("unslop-all", "detect.mjs"), "--json", ...args], { cwd, encoding: "utf8" }));
const planned = (out) => out.plan.map((p) => p.skill);
const reason = (out, skill) => out.skipped.find((s) => s.skill === skill)?.reason;

// A small mixed repo: a C# API, a React web app with a plain TS client, docs, and tests.
function mixedRepo() {
  const r = repo();
  const put = (file, text) => { mkdirSync(join(r.dir, file, ".."), { recursive: true }); writeFileSync(join(r.dir, file), text); };
  put("api/Orders.cs", "namespace Api; public class Orders {}\n");
  put("web/App.tsx", "export function App() { return <main />; }\n");
  put("web/client.ts", "export const get = (url: string) => fetch(url);\n");
  put("web/useCart.ts", "import { useState } from \"react\";\nexport const useCart = () => useState(0);\n");
  put("web/app.test.ts", "test(\"adds\", () => expect(1).toBe(1));\n");
  put("docs/guide.md", "# Guide\n");
  r.git("add", ".");
  r.git("commit", "-q", "-m", "Add the app");
  return { ...r, put };
}

test("all detect.mjs plans every applicable pass for the whole repo", () => {
  const { dir } = mixedRepo();
  const out = detect([], dir);
  assert.equal(out.scope.mode, "repo");
  assert.deepEqual(planned(out), ["unslop-tests", "unslop-typescript", "unslop-csharp", "unslop-text", "unslop-git"]);
  assert.equal(reason(out, "unslop-ui"), "covered by unslop-react through unslop-typescript");
  assert.equal(out.detected.react.files, 2, "App.tsx and the module importing react");
});

test("all detect.mjs only plans skills that have files inside a folder or file scope", () => {
  const { dir } = mixedRepo();
  let out = detect([join(dir, "api")]);
  assert.deepEqual(planned(out), ["unslop-csharp"]);
  assert.equal(reason(out, "unslop-typescript"), "no TS/JS source files in scope");
  assert.equal(reason(out, "unslop-text"), "no docs in scope");
  assert.match(reason(out, "unslop-git"), /not history/);

  out = detect([join(dir, "docs", "guide.md")]);
  assert.deepEqual(planned(out), ["unslop-text"]);
  assert.equal(reason(out, "unslop-csharp"), "no C# source files in scope");

  out = detect([join(dir, "web", "client.ts")]);
  assert.deepEqual(planned(out), ["unslop-typescript"]);
  assert.equal(out.detected.react.uses, false, "a plain TS file in a React app is not React code");
  assert.equal(reason(out, "unslop-ui"), "no UI files in scope");
});

test("all detect.mjs --changed scopes to the branch's changed files", () => {
  const { dir, git, put } = mixedRepo();
  git("checkout", "-q", "-b", "feature");
  put("api/Orders.cs", "namespace Api; public class Orders { }\n");
  git("commit", "-q", "-am", "Space out the Orders body");
  const out = detect(["--changed"], dir);
  assert.equal(out.scope.mode, "changed");
  assert.equal(out.scope.base, "main");
  assert.deepEqual(planned(out), ["unslop-csharp", "unslop-git"]);
  assert.equal(out.plan.find((p) => p.skill === "unslop-git").range, "main..HEAD");
});

test("all detect.mjs skips changelogs when counting docs and picks the git range from the branch", () => {
  const { dir, git, commit } = repo();
  commit("README.md", "Add readme");
  commit("CHANGELOG.md", "Add changelog");
  assert.equal(detect([], dir).detected.text.files, 1);
  assert.equal(detect([], dir).plan.find((p) => p.skill === "unslop-git").range, "HEAD");
  git("checkout", "-q", "-b", "feature");
  commit("notes.txt", "Add notes");
  assert.equal(detect([], dir).plan.find((p) => p.skill === "unslop-git").range, "main..HEAD");
});

test("all detect.mjs runs on a folder of fixtures inside this repo", () => {
  const out = detect([fixtures("csharp")]);
  assert.ok(planned(out).includes("unslop-csharp"));
  assert.equal(reason(out, "unslop-text"), "no docs in scope");
});

test("all detect.mjs honours --exclude, ignores agent tooling, and counts only real tests in spec/ folders", () => {
  const { dir, git, put } = mixedRepo();
  put(".claude/skills/shadcn/assets/card.tsx", "import * as React from \"react\";\nexport const Card = () => <div />;\n");
  put("games/run/scripts/assets/spec/mobs.mjs", "export const mobs = [];\n");
  put("games/run/src/Game.ts", "export class Game {}\n");
  put("docs/changelog/pr-1.md", "- Fixed a thing\n");
  git("add", ".");
  git("commit", "-q", "-m", "Add tooling, a game, and a changelog entry");
  const out = detect(["--exclude", join(dir, "games")], dir);
  assert.deepEqual(out.scope.excluded, ["games"]);
  assert.equal(out.detected.tests.files, 1, "web/app.test.ts only");
  assert.equal(out.detected.typescript.files, 3, "no game or tooling files");
  assert.equal(out.detected.text.files, 1, "docs/guide.md, not the changelog entry");
  assert.equal(out.detected.react.files, 2, "the .claude skill asset is not React code");
});

const survey = (args, cwd) => JSON.parse(execFileSync("node", [script("unslop-all", "detect.mjs"), "--questions", ...args], { cwd, encoding: "utf8" }));
const question = (out, header) => out.questions.find((q) => q.header === header);
const labels = (q) => q?.options.map((o) => o.label);

// The mixed repo plus the things a survey proposes to leave alone.
function guardedRepo() {
  const r = mixedRepo();
  r.put("AGENTS.md", [
    "- Treat `docs/history/` as read-only.",
    "- Touch another game only when the owner names it.",
    "- Never add bots unless the owner asks for them.",
  ].join("\n") + "\n");
  r.put("docs/history/2024-plan.md", "# Old plan\n");
  r.put("docs/changelog/pr-1.md", "- Fixed a thing\n");
  r.put("web/history/history.ts", "export const past = [];\n");
  r.git("add", ".");
  r.git("commit", "-q", "-m", "Add rules, history, and a changelog");
  return r;
}

test("all detect.mjs --questions builds AskUserQuestion-shaped questions with an answer for every option", () => {
  const { dir } = guardedRepo();
  const out = survey([], dir);
  assert.deepEqual(out.questions.map((q) => q.header), ["Scope", "Exclude", "Passes", "Changes"]);
  for (const q of out.questions) {
    assert.ok(q.header.length <= 12, q.header);
    assert.ok(q.options.length >= 2 && q.options.length <= 4, `${q.header}: ${q.options.length} options`);
    assert.equal(new Set(labels(q)).size, q.options.length, `${q.header}: labels repeat`);
    for (const o of q.options) {
      assert.deepEqual(Object.keys(o).sort(), ["description", "label"]);
      assert.ok(out.answers[q.header][o.label], `${q.header} / ${o.label} has no answer`);
    }
  }
  assert.equal(labels(question(out, "Scope"))[0], "Whole repo (Recommended)");
  assert.deepEqual(labels(question(out, "Passes")), ["Tests", "Code", "Docs", "Commit messages"]);
  assert.deepEqual(labels(question(out, "Changes")), ["Review branch (Recommended)", "Current branch", "Report only"]);
  assert.equal(question(out, "Exclude").multiSelect, true);
});

test("all detect.mjs --questions proposes protected folders, release records, and the rules that name an area in words", () => {
  const { dir } = guardedRepo();
  const out = survey([], dir);
  assert.deepEqual(labels(question(out, "Exclude")), ["Protected areas", "Release records", "Nothing extra"]);
  assert.deepEqual(out.answers.Exclude["Protected areas"].flags, ["--exclude", join(dir, "docs/history")]);
  assert.deepEqual(out.answers.Exclude["Release records"].flags, ["--exclude", join(dir, "docs/changelog")], "web/history holds code, so it is not a record");
  assert.deepEqual(out.rules.map((r) => [r.line, r.paths]), [[1, ["docs/history"]], [2, []]], "the bots rule is about behavior, not scope");
});

test("all detect.mjs --questions asks only what the scope leaves open", () => {
  const { dir, git, put } = guardedRepo();
  let out = survey([join(dir, "api")]);
  assert.deepEqual(out.questions.map((q) => q.header), ["Passes", "Changes"], "a named folder settles Scope, and api/ has nothing to exclude");
  assert.deepEqual(labels(question(out, "Passes")), ["Code", "Commit messages"]);

  git("checkout", "-q", "-b", "feature");
  put("web/client.ts", "export const get = (url: string) => fetch(url, { cache: \"no-store\" });\n");
  out = survey([], dir);
  assert.equal(labels(question(out, "Scope"))[0], "Branch changes (Recommended)");
  assert.deepEqual(out.answers.Scope["Branch changes (Recommended)"].flags, ["--changed"]);
  assert.match(question(out, "Changes").question, /uncommitted changes/);
});

test("all detect.mjs --passes runs only the picked passes, and commits audits history even for a folder", () => {
  const { dir } = mixedRepo();
  const out = detect(["--passes", "code,commits", join(dir, "api")], dir);
  assert.deepEqual(planned(out), ["unslop-csharp", "unslop-git"]);
  assert.equal(reason(out, "unslop-tests"), "not picked");
  assert.equal(reason(out, "unslop-text"), "not picked");
  const bad = spawnSync("node", [script("unslop-all", "detect.mjs"), "--passes", "lint"], { cwd: dir, encoding: "utf8" });
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /unknown pass "lint"/);
});

test("all detect.mjs accepts the flags its own answers map to", () => {
  const { dir } = guardedRepo();
  const answers = survey([], dir).answers;
  const flags = [...answers.Scope["Whole repo (Recommended)"].flags, ...answers.Exclude["Protected areas"].flags, ...answers.Exclude["Release records"].flags];
  const out = detect([...flags, "--passes", answers.Passes.Docs.passes.join(",")], dir);
  assert.deepEqual(out.scope.excluded, ["docs/history", "docs/changelog"]);
  assert.deepEqual(planned(out), ["unslop-text"]);
  assert.equal(out.detected.text.files, 2, "docs/guide.md and AGENTS.md");
});
