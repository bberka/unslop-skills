import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
