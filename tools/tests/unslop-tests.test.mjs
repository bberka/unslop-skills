import { test } from "node:test";
import assert from "node:assert/strict";
import { scannerTests, scan } from "./helpers.mjs";

const slop = ["slop.test.ts", "UserServiceTests.cs", "test_slop.py", "slop_test.go"];
const clean = ["clean.test.ts", "CleanTests.cs", "test_clean.py", "clean_test.go"];

scannerTests({ skill: "unslop-tests", fixture: "tests", slop, clean,
  expect: ["tests-1", "tests-2", "tests-3", "tests-4", "tests-7", "tests-8", "tests-11", "tests-12", "tests-13", "tests-15", "tests-16"] });

const matches = (id) => scan("unslop-tests", "tests", slop).filter((f) => f.id === id).map((f) => `${f.file}:${f.line} ${f.match}`).sort();

test("tests: no-assertion names each test that checks nothing, in every language, and skips commented-out attributes", () => {
  assert.deepEqual(matches("tests-2"), [
    "UserServiceTests.cs:39 LoadsEveryUser",
    "UserServiceTests.cs:7 Test1",
    "slop.test.ts:5 works",
    "slop_test.go:8 TestAdd",
    "test_slop.py:9 test_1",
  ]);
});

test("tests: weak-assertion fires only when a test has nothing stronger", () => {
  assert.deepEqual(matches("tests-3"), ["UserServiceTests.cs:30 Constructs", "slop.test.ts:13 creates a cart", "test_slop.py:13 test_works"]);
});

test("tests: a catch that asserts is flagged unless the try block fails on fall-through", () => {
  assert.deepEqual(matches("tests-15"), ["slop.test.ts:41 catch (e) {"]);
});

test("tests: Arrange/Act/Assert comments are one hit per file", () => {
  assert.deepEqual(matches("tests-16"), ["slop.test.ts:25 3 Arrange/Act/Assert comments", "slop.test.ts:51 console.log("]);
});

test("unslop-tests: a file in a spec/ folder with no tests is not scanned", () => {
  assert.deepEqual(scan("unslop-tests", "tests", ["assets/spec/mobs.mjs"]), []);
});
