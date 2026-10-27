#!/usr/bin/env node
// Reports dead C# code (cs-7) without touching the repo: unused usings, private members,
// parameters, assignments, locals, and fields.
// It writes a global analyzer config and a one-item MSBuild targets file to a temp folder,
// injects them into every project of one build through CustomAfterMicrosoftCommonTargets,
// deletes the temp folder, and prints the deduplicated diagnostics. A severity the repo's own
// .editorconfig sets for one of these ids wins over the injected config.
// Usage: node dead-code.mjs [path/to/App.sln|App.slnx|App.csproj|folder]
import { writeFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve, relative } from "node:path";

const IDS = {
  IDE0005: "unused using", IDE0051: "unused private member", IDE0052: "private member never read",
  IDE0060: "unused parameter", IDE0059: "value assigned but never used", CS0168: "variable declared but never used",
  CS0219: "variable assigned but never used", CS0169: "field never used", CS0414: "field assigned but never read",
};

const target = resolve(process.argv[2] ?? ".");
if (!existsSync(target)) { console.error(`dead-code: no such path: ${target}`); process.exit(2); }

const temp = mkdtempSync(join(tmpdir(), "unslop-dead-code-"));
const config = join(temp, "unslop.globalconfig");
const targets = join(temp, "unslop.targets");
writeFileSync(config, ["is_global = true", "global_level = 1000",
  ...Object.keys(IDS).filter((i) => i.startsWith("IDE")).map((id) => `dotnet_diagnostic.${id}.severity = warning`)].join("\n") + "\n");
writeFileSync(targets, `<Project>\n  <ItemGroup>\n    <EditorConfigFiles Include="${config}" />\n  </ItemGroup>\n</Project>\n`);

let result;
try {
  result = spawnSync("dotnet", ["build", target, "--no-incremental", "-nologo",
    "-p:EnforceCodeStyleInBuild=true", "-p:GenerateDocumentationFile=true",
    "-p:NoWarn=CS1591", "-p:TreatWarningsAsErrors=false", "-p:WarningsAsErrors=",
    `-p:CustomAfterMicrosoftCommonTargets=${targets}`],
  { encoding: "utf8", maxBuffer: 1 << 28 });
} finally {
  rmSync(temp, { recursive: true, force: true });
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
if (rows.length === 0 && /Unable to find a project to restore/.test(output)) {
  console.error("The solution holds no projects. Point at a .csproj or a solution that lists them.");
  process.exit(1);
}
if (result.status !== 0 && rows.length === 0) {
  console.error("The build failed before analyzers ran. Last lines of output:");
  console.error(output.trim().split("\n").slice(-15).join("\n"));
  process.exit(1);
}
console.log("IDE0060 on public members of a shipped library API is a keep.");
