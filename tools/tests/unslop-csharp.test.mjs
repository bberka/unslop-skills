import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scannerTests, scan, script } from "./helpers.mjs";

scannerTests({ skill: "unslop-csharp", fixture: "csharp", slop: ["UserManager.cs", "Domain/Order.cs"], clean: ["OrderService.cs"],
  expect: ["cs-5", "cs-7", "cs-8", "cs-9", "cs-10", "cs-11", "cs-12", "cs-13", "cs-14", "cs-15", "cs-16", "cs-17", "cs-18", "cs-19", "cs-24", "cs-25"] });

test("csharp: implicit coupling is static mutable state or a service locator outside the composition root", () => {
  assert.deepEqual(titles(["UserManager.cs"], "cs-25"), ["Service locator: .GetRequiredService<IUserRepository>()", "Static mutable state: public static string CurrentTenant { get; set;"]);
  assert.deepEqual(titles(["Domain/Order.cs"], "cs-24"), ["Inner layer importing infrastructure: using Microsoft.EntityFrameworkCore"]);
});

const titles = (files, id) => scan("unslop-csharp", "csharp", files).filter((f) => f.id === id).map((f) => `${f.title}: ${f.match}`).sort();

test("csharp: the web project flags ConfigureAwait(false), the library keeps it", () => {
  assert.deepEqual(titles(["UserManager.cs"], "cs-9"),
    ["ConfigureAwait(false) in app code: .ConfigureAwait(false)", "Task.Run around async work: Task.Run(async", "async void: async void Refresh("]);
  assert.deepEqual(titles(["Lib/RetryPolicy.cs"], "cs-9"), []);
});

test("csharp: restating docs are judged by words, and a documented library keeps its public docs", () => {
  assert.deepEqual(titles(["UserManager.cs"], "cs-16"), ["Restating XML doc: param id", "Restating XML doc: summary restates GetUser"]);
  assert.deepEqual(titles(["Lib/RetryPolicy.cs"], "cs-16"), ["Restating XML doc: summary restates Delay"]);
});

test("csharp: null-forgiving operators are reported once per file, as a count", () => {
  assert.deepEqual(titles(["UserManager.cs"], "cs-11"), ["Null-forgiving spam: 3 null-forgiving operators"]);
});

test("csharp: generated files and projects that reference a test framework are skipped", () => {
  assert.deepEqual(scan("unslop-csharp", "csharp", ["Generated.cs", "Specs/Helpers.cs"]), []);
});

const hasDotnet = spawnSync("dotnet", ["--version"]).status === 0;
test("csharp dead-code.mjs reaches projects below the solution folder and leaves no files behind",
  { skip: !hasDotnet && "dotnet not installed", timeout: 300_000 }, () => {
    const dir = mkdtempSync(join(tmpdir(), "unslop-cs-"));
    const proj = join(dir, "src", "Demo");
    mkdirSync(proj, { recursive: true });
    const major = execFileSync("dotnet", ["--version"], { encoding: "utf8" }).split(".")[0];
    writeFileSync(join(proj, "Demo.csproj"), `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net${major}.0</TargetFramework><Nullable>enable</Nullable></PropertyGroup></Project>`);
    writeFileSync(join(proj, "Program.cs"), "using System.Text;\nnamespace Demo;\npublic class S { private int _unused; private void Helper() { } public int Add(int a, int b, int c) => a + b; }\n" +
      "public static class Program { public static void Main() => System.Console.WriteLine(new S().Add(1, 2, 3)); }\n");
    execFileSync("dotnet", ["new", "sln", "-n", "Demo", "-o", dir], { stdio: "ignore" });
    const sln = readdirSync(dir).find((f) => /^Demo\.slnx?$/.test(f));
    execFileSync("dotnet", ["sln", join(dir, sln), "add", join(proj, "Demo.csproj")], { stdio: "ignore" });
    const before = readdirSync(dir).sort();
    const out = execFileSync("node", [script("unslop-csharp", "dead-code.mjs"), join(dir, sln)], { cwd: dir, encoding: "utf8" });
    for (const id of ["IDE0005", "IDE0051", "IDE0060"]) assert.match(out, new RegExp(`src/Demo/Program.cs:\\d+  cs-7 ${id}`));
    assert.deepEqual(readdirSync(dir).sort(), before);
  });
