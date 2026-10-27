import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { scannerTests, scan, script, fixtures } from "./helpers.mjs";

scannerTests({ skill: "unslop-react", fixture: "react", slop: ["Slop.tsx"], clean: ["Clean.tsx", "Buttons.tsx"],
  expect: ["react-1", "react-2", "react-4", "react-5", "react-7", "react-8", "react-10", "react-11", "react-12", "react-17", "react-18", "react-19", "react-20"] });

test("unslop-react: god components and boolean soup are judged per component, not per file", () => {
  const hits = scan("unslop-react", "react", ["Slop.tsx"]);
  const god = hits.filter((f) => f.id === "react-10");
  assert.equal(god.length, 1);
  assert.equal(god[0].line, 3);
  assert.match(god[0].match, /6 useState/);
  assert.match(hits.find((f) => f.id === "react-5").match, /^3 boolean useState calls/);
});

const inventory = (...paths) =>
  JSON.parse(execFileSync("node", [script("unslop-react", "inventory.mjs"), "--json", ...paths], { cwd: fixtures("react"), encoding: "utf8" }));

test("react inventory.mjs groups same-role components", () => {
  const report = inventory(".");
  assert.deepEqual(report.similar.Button.map((c) => c.name).sort(), ["BlueButton", "PrimaryButton", "SaveButton", "SubmitButton"]);
  assert.ok(report.duplicateNames.Profile);
});

test("react inventory.mjs finds wrapped components and measures each body on its own", () => {
  const byName = Object.fromEntries(inventory(".").components.map((c) => [`${c.file}:${c.name}`, c]));
  const textField = byName["Clean.tsx:TextField"];
  assert.ok(textField, "forwardRef with a nested generic and the function on the next line");
  assert.equal(textField.lines, 10);
  assert.ok(byName["Clean.tsx:ProfileSkeleton"]);
  const profile = byName["Slop.tsx:Profile"];
  assert.equal(profile.useState, 6);
  assert.ok(profile.lines >= 40 && profile.lines <= 45, `Profile spans ${profile.lines} lines`);
});
