#!/usr/bin/env node
// Decides which unslop skills apply to a scope, and the order to run them in.
// Only files inside the scope count: a repo with C# elsewhere does not send unslop-csharp
// into a docs folder. Skills with nothing in scope are listed as skipped, with the reason.
//
// Usage: node detect.mjs [--json] [paths...]          files or folders (default: the whole repo)
//        node detect.mjs [--json] --changed[=<base>] [paths...]
//          files changed on this branch against <base> (default: the default branch),
//          plus uncommitted and untracked files, narrowed to [paths] when given
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve, relative, dirname } from "node:path";

const args = process.argv.slice(2);
const json = args.includes("--json");
const changedArg = args.find((a) => a === "--changed" || a.startsWith("--changed="));
const paths = args.filter((a) => !a.startsWith("--")).map((p) => resolve(p));
for (const p of paths) if (!existsSync(p)) { console.error(`detect: no such path: ${p}`); process.exit(2); }

const anchor = paths[0] ? (statSync(paths[0]).isDirectory() ? paths[0] : dirname(paths[0])) : process.cwd();
const git = (...a) => {
  try { return execFileSync("git", a, { cwd: anchor, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 28 }).trim(); }
  catch { return null; }
};
const top = git("rev-parse", "--show-toplevel");
const isGit = top !== null;
const root = isGit ? resolve(top) : (paths.length === 1 && statSync(paths[0]).isDirectory() ? paths[0] : process.cwd());
const gitAt = (...a) => {
  try { return execFileSync("git", a, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 28 }).trim(); }
  catch { return null; }
};
const lines = (out) => (out ?? "").split("\n").filter(Boolean);

let branch = null, defaultBranch = null;
if (isGit) {
  branch = gitAt("rev-parse", "--abbrev-ref", "HEAD");
  defaultBranch = gitAt("symbolic-ref", "--short", "refs/remotes/origin/HEAD")?.replace(/^origin\//, "")
    ?? ["main", "master", "trunk", "develop"].find((b) => gitAt("rev-parse", "--verify", "-q", b) !== null) ?? null;
}

// Paths that name the repo root itself mean "the whole repo".
const rel = (p) => relative(root, p).split("\\").join("/");
const scopePaths = paths.map(rel).filter((p) => p !== "");
const mode = changedArg ? "changed" : scopePaths.length ? "paths" : "repo";
const inScope = (f) => scopePaths.length === 0 || scopePaths.some((p) => f === p || f.startsWith(`${p}/`));

const SKIP = /(?:^|\/)(?:node_modules|\.git|dist|build|out|bin|obj|coverage|\.next|\.nuxt|\.svelte-kit|\.turbo|vendor|target|\.venv|venv|__pycache__)\//;
let files;
let base = null;
if (mode === "changed") {
  if (!isGit) { console.error("detect: --changed needs a git repository"); process.exit(2); }
  base = changedArg.includes("=") ? changedArg.split("=")[1] : defaultBranch;
  if (!base) { console.error("detect: no default branch found; pass --changed=<base>"); process.exit(2); }
  const committed = gitAt("diff", "--name-only", "--diff-filter=d", `${base}...HEAD`);
  if (committed === null) { console.error(`detect: cannot diff against ${base}`); process.exit(2); }
  files = [...new Set([...lines(committed), ...lines(gitAt("ls-files", "-mo", "--exclude-standard"))])];
} else if (isGit) {
  files = lines(gitAt("ls-files", "-co", "--exclude-standard", "--", ...(scopePaths.length ? scopePaths : ["."])));
  // A file the user named counts even when git ignores it.
  for (const p of paths) if (statSync(p).isFile() && !files.includes(rel(p))) files.push(rel(p));
} else {
  files = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { if (!SKIP.test(`${rel(p)}/`)) walk(p); } else files.push(rel(p));
    }
  };
  for (const p of paths.length ? paths : [root]) statSync(p).isDirectory() ? walk(p) : files.push(rel(p));
}
files = files.filter((f) => inScope(f) && !SKIP.test(f) && !/\.min\.(?:js|css)$/.test(f) && existsSync(join(root, f)));

const count = (list, re) => list.filter((f) => re.test(f)).length;
const byExt = (list, exts) => Object.fromEntries(exts.map((e) => [e, count(list, new RegExp(`\\.${e}$`, "i"))]).filter(([, n]) => n));

const TEST = /(?:^|\/)(?:__tests__|tests?|specs?|e2e)\/.*\.(?:[cm]?[jt]sx?|py|cs|go)$|\.(?:test|spec)\.[cm]?[jt]sx?$|(?:^|\/)test_[^/]*\.py$|_test\.(?:py|go)$|Tests?\.cs$|(?:^|\/)[\w.]*Tests?(?:\.[\w.]+)?\/.*\.cs$/;
const sourceJs = files.filter((f) => /\.(?:[cm]?tsx?|[cm]?jsx?)$/i.test(f) && !/\.d\.[cm]?ts$/.test(f) && !TEST.test(f) && !/(?:^|\/)[\w.-]+\.config\.[cm]?[jt]s$/.test(f));
const sourceCs = files.filter((f) => /\.cs$/i.test(f) && !TEST.test(f));
const tests = files.filter((f) => TEST.test(f));
// Changelogs are skipped for the same reason unslop-text's scanner skips them: release tooling writes them.
const docs = files.filter((f) => /\.(?:md|mdx|markdown|txt|rst|adoc)$/i.test(f) && !/(?:^|\/)(?:LICENSE|NOTICE|THIRD[-_]PARTY|CHANGELOG|CHANGES|HISTORY|RELEASE[-_]?NOTES)/i.test(f));
const uiFiles = files.filter((f) => /\.(?:css|scss|sass|less|html?|jsx|tsx|vue|svelte|astro|razor|cshtml)$/i.test(f) && !TEST.test(f));

// React counts only when the scope itself holds React code: a backend folder in a monorepo
// whose root package.json lists react is not React code.
const IMPORTS_REACT = /\bfrom\s+['"](?:react|preact|react-dom|react-native|next)(?:\/[^'"]*)?['"]|\brequire\(\s*['"](?:react|preact)['"]\s*\)/;
const reactFiles = [];
for (const f of sourceJs) {
  if (/\.(?:jsx|tsx)$/i.test(f)) { reactFiles.push(f); continue; }
  try { if (IMPORTS_REACT.test(readFileSync(join(root, f), "utf8").slice(0, 20_000))) reactFiles.push(f); } catch {}
}
const usesReact = reactFiles.length > 0;

const plan = [];
const skipped = [];
const step = (skill, applies, why, reason) => (applies ? plan.push({ skill, why }) : skipped.push({ skill, reason }));

step("unslop-tests", tests.length > 0, `${tests.length} test files`, "no test files in scope");
step("unslop-typescript", sourceJs.length > 0,
  `${sourceJs.length} TS/JS source files` + (usesReact ? `, continues into unslop-react (${reactFiles.length} React files) and then unslop-ui` : ", no React in scope"),
  "no TS/JS source files in scope");
step("unslop-csharp", sourceCs.length > 0, `${sourceCs.length} C# source files`, "no C# source files in scope");
step("unslop-ui", uiFiles.length > 0 && !usesReact, `${uiFiles.length} UI files, no React, so it runs on its own`,
  uiFiles.length === 0 ? "no UI files in scope" : "covered by unslop-react through unslop-typescript");
step("unslop-text", docs.length > 0, `${docs.length} docs`, "no docs in scope");

let range = null;
if (!isGit) {
  skipped.push({ skill: "unslop-git", reason: "not a git repository" });
} else if (mode === "paths") {
  skipped.push({ skill: "unslop-git", reason: "the scope is files or folders, not history; run unslop-git on a commit range directly" });
} else {
  // On the default branch there is no branch range, so the last 20 commits (or the whole
  // history when it is shorter) stand in. Every form is a valid `git log` argument.
  if (mode === "changed") range = `${base}..HEAD`;
  else if (defaultBranch && branch && branch !== defaultBranch) range = `${defaultBranch}..HEAD`;
  else range = Number(gitAt("rev-list", "--count", "HEAD") ?? 0) > 20 ? "HEAD~20..HEAD" : "HEAD";
  const commits = Number(gitAt("rev-list", "--count", range) ?? 0);
  step("unslop-git", commits > 0, `audit ${range} (${commits} commits)`, `no commits in ${range}`);
  if (commits > 0) plan[plan.length - 1].range = range;
}

const scope = { mode, paths: scopePaths, base, files: files.length };
const detected = {
  tests: { files: tests.length },
  typescript: { files: sourceJs.length, byExt: byExt(sourceJs, ["ts", "tsx", "mts", "cts", "js", "jsx", "mjs", "cjs"]) },
  react: { uses: usesReact, files: reactFiles.length },
  csharp: { files: sourceCs.length, projects: count(files, /\.(?:csproj|sln|slnx)$/i) },
  ui: { files: uiFiles.length, byExt: byExt(uiFiles, ["css", "scss", "less", "html", "vue", "svelte", "astro", "razor", "cshtml", "tsx", "jsx"]) },
  text: { files: docs.length },
  git: { repo: isGit, branch, defaultBranch },
};

if (json) {
  console.log(JSON.stringify({ root, scope, detected, plan, skipped }, null, 2));
} else {
  const scopeLine = mode === "repo" ? "whole repo" : mode === "changed" ? `changes against ${base}${scopePaths.length ? ` under ${scopePaths.join(", ")}` : ""}` : scopePaths.join(", ");
  console.log(`Project: ${root}`);
  console.log(`Scope:   ${scopeLine} (${files.length} files)`);
  console.log(isGit ? `Git:     on ${branch}, default branch ${defaultBranch ?? "unknown"}` : "Git:     not a repository");
  console.log("\nIn scope:");
  console.log(`  tests       ${tests.length} files`);
  console.log(`  typescript  ${sourceJs.length} source files ${JSON.stringify(detected.typescript.byExt)}`);
  console.log(`  react       ${usesReact ? `${reactFiles.length} files` : "none"}`);
  console.log(`  csharp      ${sourceCs.length} source files, ${detected.csharp.projects} project/solution files`);
  console.log(`  ui          ${uiFiles.length} files ${JSON.stringify(detected.ui.byExt)}`);
  console.log(`  text        ${docs.length} docs`);
  console.log("\nRun order:");
  plan.forEach((p, i) => console.log(`  ${i + 1}. ${p.skill.padEnd(18)} ${p.why}`));
  if (!plan.length) console.log("  nothing to unslop in this scope");
  console.log("\nSkipped:");
  skipped.forEach((s) => console.log(`  - ${s.skill.padEnd(18)} ${s.reason}`));
}
