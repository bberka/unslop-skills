#!/usr/bin/env node
// Decides which unslop skills apply to a project and the order to run them in.
// Usage: node detect.mjs [path] [--json]
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve, basename } from "node:path";

const args = process.argv.slice(2);
const json = args.includes("--json");
const root = resolve(args.find((a) => !a.startsWith("--")) ?? ".");
if (!existsSync(root)) { console.error(`detect: no such path: ${root}`); process.exit(2); }

const SKIP = /(?:^|\/)(?:node_modules|\.git|dist|build|out|bin|obj|coverage|\.next|\.nuxt|\.svelte-kit|\.turbo|vendor|target|\.venv|venv|__pycache__)\//;
const git = (...a) => {
  try { return execFileSync("git", a, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 28 }).trim(); }
  catch { return null; }
};

const isGit = git("rev-parse", "--is-inside-work-tree") === "true";
let files;
if (isGit) {
  files = git("ls-files", "-co", "--exclude-standard").split("\n").filter(Boolean);
} else {
  files = [];
  const walk = (dir, rel) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) { if (!SKIP.test(`${r}/`)) walk(join(dir, e.name), r); } else files.push(r);
    }
  };
  walk(root, "");
}
files = files.filter((f) => !SKIP.test(f) && !/\.min\.(?:js|css)$/.test(f));

const count = (re) => files.filter((f) => re.test(f)).length;
const byExt = (list) => Object.fromEntries(list.map((e) => [e, count(new RegExp(`\\.${e}$`, "i"))]).filter(([, n]) => n));

const TEST = /(?:^|\/)(?:__tests__|tests?|specs?|e2e)\/.*\.(?:[cm]?[jt]sx?|py|cs|go)$|\.(?:test|spec)\.[cm]?[jt]sx?$|(?:^|\/)test_[^/]*\.py$|_test\.(?:py|go)$|Tests?\.cs$|(?:^|\/)[\w.]*Tests?(?:\.[\w.]+)?\/.*\.cs$/;
const sourceJs = files.filter((f) => /\.(?:[cm]?tsx?|[cm]?jsx?)$/i.test(f) && !/\.d\.[cm]?ts$/.test(f) && !TEST.test(f) && !/(?:^|\/)[\w.-]+\.config\.[cm]?[jt]s$/.test(f));
const sourceCs = files.filter((f) => /\.cs$/i.test(f) && !TEST.test(f));
const tests = files.filter((f) => TEST.test(f));
const docs = files.filter((f) => /\.(?:md|mdx|markdown|txt|rst|adoc)$/i.test(f) && !/(?:^|\/)(?:LICENSE|NOTICE|THIRD[-_]PARTY)/i.test(f));
const uiFiles = files.filter((f) => /\.(?:css|scss|sass|less|html?|jsx|tsx|vue|svelte|astro|razor|cshtml)$/i.test(f) && !TEST.test(f));

const reactIn = [];
for (const f of files.filter((p) => basename(p) === "package.json")) {
  try {
    const pkg = JSON.parse(readFileSync(join(root, f), "utf8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
    const hit = ["react", "preact", "next", "@remix-run/react", "react-native"].find((d) => deps[d]);
    if (hit) reactIn.push(`${hit}@${deps[hit]} in ${f}`);
  } catch {}
}
const usesReact = reactIn.length > 0 || count(/\.(?:jsx|tsx)$/i) > 0;

let branch = null, defaultBranch = null;
if (isGit) {
  branch = git("rev-parse", "--abbrev-ref", "HEAD");
  defaultBranch = git("symbolic-ref", "--short", "refs/remotes/origin/HEAD")?.replace(/^origin\//, "")
    ?? ["main", "master", "trunk", "develop"].find((b) => git("rev-parse", "--verify", "-q", b) !== null) ?? null;
}

const detected = {
  tests: { files: tests.length },
  typescript: { files: sourceJs.length, byExt: byExt(["ts", "tsx", "mts", "cts", "js", "jsx", "mjs", "cjs"]) },
  react: { uses: usesReact, evidence: reactIn },
  csharp: { files: sourceCs.length, projects: count(/\.(?:csproj|sln|slnx)$/i) },
  ui: { files: uiFiles.length, byExt: byExt(["css", "scss", "less", "html", "vue", "svelte", "astro", "razor", "cshtml", "tsx", "jsx"]) },
  text: { files: docs.length },
  git: { repo: isGit, branch, defaultBranch },
};

const plan = [];
if (tests.length) plan.push({ skill: "unslop-tests", why: `${tests.length} test files` });
if (sourceJs.length) plan.push({ skill: "unslop-typescript", why: `${sourceJs.length} TS/JS source files` + (usesReact ? ", continues into unslop-react and then unslop-ui" : "") });
if (sourceCs.length) plan.push({ skill: "unslop-csharp", why: `${sourceCs.length} C# source files` });
if (uiFiles.length && !usesReact) plan.push({ skill: "unslop-ui", why: `${uiFiles.length} UI files (no React, so it runs on its own)` });
if (docs.length) plan.push({ skill: "unslop-text", why: `${docs.length} docs` });
if (isGit) {
  const range = defaultBranch && branch && branch !== defaultBranch ? `${defaultBranch}..HEAD` : "the last 20 commits";
  plan.push({ skill: "unslop-git", why: `audit ${range}`, range });
}

if (json) {
  console.log(JSON.stringify({ root, detected, plan }, null, 2));
} else {
  console.log(`Project: ${root}`);
  console.log(isGit ? `Git: on ${branch}, default branch ${defaultBranch ?? "unknown"}` : "Git: not a repository (no per-pass commits; unslop-git skipped)");
  console.log("\nDetected:");
  console.log(`  tests       ${tests.length} files`);
  console.log(`  typescript  ${sourceJs.length} source files ${JSON.stringify(detected.typescript.byExt)}`);
  console.log(`  react       ${usesReact ? "yes" : "no"}${reactIn.length ? ` (${reactIn.join("; ")})` : ""}`);
  console.log(`  csharp      ${sourceCs.length} source files, ${detected.csharp.projects} project/solution files`);
  console.log(`  ui          ${uiFiles.length} files ${JSON.stringify(detected.ui.byExt)}`);
  console.log(`  text        ${docs.length} docs`);
  console.log("\nRun order:");
  plan.forEach((p, i) => console.log(`  ${i + 1}. ${p.skill.padEnd(18)} ${p.why}`));
  if (!plan.length) console.log("  nothing to unslop");
}
