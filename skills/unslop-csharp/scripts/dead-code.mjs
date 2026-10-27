#!/usr/bin/env node
// Reports dead C# code (cs-7) without editing project files: unused usings,
// private members, parameters, assignments, locals, and fields.
// It writes a temporary .globalconfig next to the target (the SDK picks it up
// for every project at or below that folder), runs one build with code-style
// enforcement, removes the file, and prints the deduplicated diagnostics.
// Usage: node dead-code.mjs [path/to/App.sln|App.csproj|folder]
import { writeFileSync, rmSync, existsSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve, relative } from "node:path";

const IDS = {
  IDE0005: "unused using", IDE0051: "unused private member", IDE0052: "private member never read",
  IDE0060: "unused parameter", IDE0059: "value assigned but never used", CS0168: "variable declared but never used",
  CS0219: "variable assigned but never used", CS0169: "field never used", CS0414: "field assigned but never read",
};

const target = resolve(process.argv[2] ?? ".");
if (!existsSync(target)) { console.error(`dead-code: no such path: ${target}`); process.exit(2); }
const folder = statSync(target).isDirectory() ? target : dirname(target);
const config = resolve(folder, ".globalconfig");
if (existsSync(config)) {
  console.error(`dead-code: ${config} already exists. Add these severities to it by hand instead:`);
  for (const id of Object.keys(IDS).filter((i) => i.startsWith("IDE"))) console.error(`  dotnet_diagnostic.${id}.severity = warning`);
  process.exit(2);
}

writeFileSync(config, ["is_global = true", ...Object.keys(IDS).filter((i) => i.startsWith("IDE"))
  .map((id) => `dotnet_diagnostic.${id}.severity = warning`)].join("\n") + "\n");

let result;
try {
  result = spawnSync("dotnet", ["build", target, "--no-incremental", "-nologo",
    "-p:EnforceCodeStyleInBuild=true", "-p:GenerateDocumentationFile=true",
    "-p:NoWarn=CS1591", "-p:TreatWarningsAsErrors=false", "-p:WarningsAsErrors="],
  { encoding: "utf8", maxBuffer: 1 << 28 });
} finally {
  rmSync(config, { force: true });
}

if (result.error) { console.error(`dead-code: could not run dotnet: ${result.error.message}`); process.exit(2); }
const output = `${result.stdout}\n${result.stderr}`;
const seen = new Set();
const rows = [];
for (const line of output.split("\n")) {
  const m = /^(.*?\.cs)\((\d+),\d+\): (?:warning|info|error) ((?:IDE|CS)\d{4}): (.*?)(?: \(https?:[^)]*\))? \[/.exec(line.trim());
  if (!m || !IDS[m[3]]) continue;
  const key = `${m[1]}:${m[2]}:${m[3]}:${m[4]}`;
  if (seen.has(key)) continue;
  seen.add(key);
  rows.push({ file: relative(process.cwd(), m[1]), line: Number(m[2]), id: m[3], message: m[4] });
}
rows.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

for (const r of rows) console.log(`${r.file}:${r.line}  cs-7 ${r.id}  ${r.message}`);
console.log(`\n${rows.length} dead-code diagnostics.`);
if (result.status !== 0 && rows.length === 0) {
  console.error("The build failed before analyzers ran. Last lines of output:");
  console.error(output.trim().split("\n").slice(-15).join("\n"));
  process.exit(1);
}
console.log("IDE0060 on public members of a shipped library API is a keep.");
