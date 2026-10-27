import { scannerTests } from "./helpers.mjs";

scannerTests({ skill: "unslop-tests", fixture: "tests", slop: ["slop.test.ts", "UserServiceTests.cs", "test_slop.py", "slop_test.go"], clean: ["clean.test.ts"],
  expect: ["tests-1", "tests-2", "tests-3", "tests-4", "tests-7", "tests-8", "tests-11", "tests-12", "tests-13", "tests-15", "tests-16"] });
