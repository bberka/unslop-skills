import { scannerTests } from "./helpers.mjs";

scannerTests({ skill: "unslop-typescript", fixture: "typescript", slop: ["slop.ts"], clean: ["clean.ts"],
  expect: ["ts-1", "ts-2", "ts-3", "ts-4", "ts-7", "ts-9", "ts-10", "ts-11", "ts-17", "ts-18", "ts-19", "ts-20"] });
