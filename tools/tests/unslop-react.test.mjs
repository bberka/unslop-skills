import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { scannerTests, script, fixtures } from "./helpers.mjs";

scannerTests({ skill: "unslop-react", fixture: "react", slop: ["Slop.tsx"], clean: ["Clean.tsx", "Buttons.tsx"],
  expect: ["react-1", "react-2", "react-4", "react-5", "react-7", "react-8", "react-10", "react-11", "react-12", "react-17", "react-18", "react-19", "react-20"] });

test("react inventory.mjs groups same-role components", () => {
  const report = JSON.parse(execFileSync("node", [script("unslop-react", "inventory.mjs"), "--json", "."], { cwd: fixtures("react"), encoding: "utf8" }));
  assert.deepEqual(report.similar.Button.map((c) => c.name).sort(), ["BlueButton", "PrimaryButton", "SaveButton", "SubmitButton"]);
  assert.ok(report.duplicateNames.Profile);
});
