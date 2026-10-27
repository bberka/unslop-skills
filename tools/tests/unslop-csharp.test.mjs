import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scannerTests, script } from "./helpers.mjs";

scannerTests({ skill: "unslop-csharp", fixture: "csharp", slop: ["UserManager.cs"], clean: ["OrderService.cs"],
  expect: ["cs-5", "cs-7", "cs-8", "cs-9", "cs-10", "cs-11", "cs-12", "cs-13", "cs-14", "cs-15", "cs-16", "cs-17", "cs-18", "cs-19"] });

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
