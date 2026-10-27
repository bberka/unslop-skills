#!/usr/bin/env node
// Decides which unslop skills apply to a scope, and the order to run them in.
// Only files inside the scope count: a repo with C# elsewhere does not send unslop-csharp
// into a docs folder. Skills with nothing in scope are listed as skipped, with the reason.
//
// Usage: node detect.mjs [--json] [--exclude <path>]... [--passes <list>] [paths...]
//          files or folders (default: the whole repo)
//        node detect.mjs [--json] [--exclude <path>]... [--passes <list>] --changed[=<base>] [paths...]
//          files changed on this branch against <base> (default: the default branch),
//          plus uncommitted and untracked files, narrowed to [paths] when given
//        node detect.mjs --questions [--exclude <path>]... [--changed | paths...]
//          survey the scope and print JSON: what it holds, the edit rules in AGENTS.md,
//          CLAUDE.md, and CONTRIBUTING.md, ready-made questions in the shape AskUserQuestion
//          takes, and the detect.mjs flags each answer maps to
//   --exclude  leave a file or folder out (repeatable): areas the project's AGENTS.md or
//              CONTRIBUTING.md puts off limits, release records, generated code
//   --passes   run only these: tests, code, docs, commits, or entry skill names, comma-separated.
//              Picking commits audits the branch's history even when the scope is a folder.
// Agent tooling folders (.claude/, .agents/, .cursor/, ...) never count as project code.
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve, relative, dirname, posix } from "node:path";

const fail = (message) => { console.error(`detect: ${message}`); process.exit(2); };
const args = process.argv.slice(2);
const asking = args.includes("--questions");
const json = asking || args.includes("--json");
const changedArg = args.find((a) => a === "--changed" || a.startsWith("--changed="));
const paths = [];
const excludeArgs = [];
let passesArg = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--exclude") {
    if (!args[i + 1]) fail("--exclude needs a path");
    excludeArgs.push(resolve(args[++i]));
  } else if (args[i] === "--passes") {
    if (args[i + 1] === undefined) fail("--passes needs a list, e.g. code,docs");
    passesArg = args[++i];
  } else if (args[i].startsWith("--passes=")) {
    passesArg = args[i].slice("--passes=".length);
  } else if (!args[i].startsWith("--")) {
    paths.push(resolve(args[i]));
  }
}
for (const p of paths) if (!existsSync(p)) fail(`no such path: ${p}`);

const GROUPS = {
  tests: ["unslop-tests"],
  code: ["unslop-typescript", "unslop-csharp", "unslop-ui"],
  docs: ["unslop-text"],
  commits: ["unslop-git"],
};
const ENTRY = ["unslop-tests", "unslop-typescript", "unslop-csharp", "unslop-ui", "unslop-text", "unslop-git"];
let picked = null;
if (passesArg !== null) {
  picked = new Set();
  for (const raw of passesArg.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)) {
    const name = raw.replace(/^unslop-/, "");
    if (GROUPS[name]) GROUPS[name].forEach((s) => picked.add(s));
    else if (ENTRY.includes(`unslop-${name}`)) picked.add(`unslop-${name}`);
    else fail(`unknown pass "${raw}"; use tests, code, docs, commits, or an entry skill name`);
  }
}
const isPicked = (skill) => !picked || picked.has(skill);

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
const excludePaths = excludeArgs.map(rel);
const under = (f, p) => p === "" || f === p || f.startsWith(`${p}/`);
const inScope = (f) => (scopePaths.length === 0 || scopePaths.some((p) => under(f, p))) && !excludePaths.some((p) => under(f, p));

const SKIP = /(?:^|\/)(?:node_modules|\.git|dist|build|out|bin|obj|coverage|\.next|\.nuxt|\.svelte-kit|\.turbo|vendor|target|\.venv|venv|__pycache__|\.agents|\.claude|\.cursor|\.codex|\.gemini|\.windsurf|\.unslop)\//;
function walkFrom(starts) {
  const acc = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { if (!SKIP.test(`${rel(p)}/`)) walk(p); } else acc.push(rel(p));
    }
  };
  for (const p of starts) statSync(p).isDirectory() ? walk(p) : acc.push(rel(p));
  return acc;
}

let files;
let base = null;
if (mode === "changed") {
  if (!isGit) fail("--changed needs a git repository");
  base = changedArg.includes("=") ? changedArg.split("=")[1] : defaultBranch;
  if (!base) fail("no default branch found; pass --changed=<base>");
  const committed = gitAt("diff", "--name-only", "--diff-filter=d", `${base}...HEAD`);
  if (committed === null) fail(`cannot diff against ${base}`);
  files = [...new Set([...lines(committed), ...lines(gitAt("ls-files", "-mo", "--exclude-standard"))])];
} else if (isGit) {
  files = lines(gitAt("ls-files", "-co", "--exclude-standard", "--", ...(scopePaths.length ? scopePaths : ["."])));
  // A file the user named counts even when git ignores it.
  for (const p of paths) if (statSync(p).isFile() && !files.includes(rel(p))) files.push(rel(p));
} else {
  files = walkFrom(paths.length ? paths : [root]);
}
files = files.filter((f) => inScope(f) && !SKIP.test(f) && !/\.min\.(?:js|css)$/.test(f) && existsSync(join(root, f)));

const count = (list, re) => list.filter((f) => re.test(f)).length;
const byExt = (list, exts) => Object.fromEntries(exts.map((e) => [e, count(list, new RegExp(`\\.${e}$`, "i"))]).filter(([, n]) => n));

// A test by its name, or a file in a test folder that holds tests. Asset specs and helpers in a
// `spec/` folder are not tests.
const TEST_NAME = /\.(?:test|spec)\.[cm]?[jt]sx?$|(?:^|\/)test_[^/]*\.py$|_test\.(?:py|go)$|Tests?\.cs$/;
const TEST_DIR = /(?:^|\/)(?:__tests__|tests?|specs?|e2e)\/.*\.(?:[cm]?[jt]sx?|py|cs|go)$|(?:^|\/)[\w.]*Tests?(?:\.[\w.]+)?\/.*\.cs$/;
const TEST_MARKERS = /\b(?:describe|it|test)(?:\.\w+)?\s*\(|\[(?:Fact|Theory|Test|TestMethod|TestCase)\b|\bdef test_\w*\s*\(|\bfunc Test\w*\s*\(|\bclass \w*Test\w*\b/;
const isTest = (f) => {
  if (TEST_NAME.test(f)) return true;
  if (!TEST_DIR.test(f)) return false;
  try { return TEST_MARKERS.test(readFileSync(join(root, f), "utf8").slice(0, 200_000)); } catch { return false; }
};
const testFiles = new Set(files.filter(isTest));
const TEST = { test: (f) => testFiles.has(f) };
const sourceJs = files.filter((f) => /\.(?:[cm]?tsx?|[cm]?jsx?)$/i.test(f) && !/\.d\.[cm]?ts$/.test(f) && !TEST.test(f) && !/(?:^|\/)[\w.-]+\.config\.[cm]?[jt]s$/.test(f));
const sourceCs = files.filter((f) => /\.cs$/i.test(f) && !TEST.test(f));
const tests = files.filter((f) => TEST.test(f));
// Changelogs are skipped for the same reason unslop-text's scanner skips them: release tooling writes them.
const docs = files.filter((f) => /\.(?:md|mdx|markdown|txt|rst|adoc)$/i.test(f) && !/(?:^|\/)(?:LICENSE|NOTICE|THIRD[-_]PARTY|CHANGELOG|CHANGES|HISTORY|RELEASE[-_]?NOTES)/i.test(f) && !/(?:^|\/)(?:changelogs?|release[-_]?notes|\.changeset)\//i.test(f));
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

// The history the git pass audits. On the default branch there is no branch range, so the last
// 20 commits (or the whole history when it is shorter) stand in. Every form is a valid
// `git log` argument.
function gitRange() {
  if (mode === "changed") return `${base}..HEAD`;
  if (defaultBranch && branch && branch !== defaultBranch) return `${defaultBranch}..HEAD`;
  return Number(gitAt("rev-list", "--count", "HEAD") ?? 0) > 20 ? "HEAD~20..HEAD" : "HEAD";
}
const range = isGit ? gitRange() : null;
// Merges are skipped, as lint-msg.mjs skips them.
const commits = isGit ? Number(gitAt("rev-list", "--count", "--no-merges", range) ?? 0) : 0;

const plan = [];
const skipped = [];
const step = (skill, applies, why, reason) => {
  if (!isPicked(skill)) skipped.push({ skill, reason: "not picked" });
  else if (applies) plan.push({ skill, why });
  else skipped.push({ skill, reason });
};

step("unslop-tests", tests.length > 0, `${tests.length} test files`, "no test files in scope");
step("unslop-typescript", sourceJs.length > 0,
  `${sourceJs.length} TS/JS source files` + (usesReact ? `, continues into unslop-react (${reactFiles.length} React files) and then unslop-ui` : ", no React in scope"),
  "no TS/JS source files in scope");
step("unslop-csharp", sourceCs.length > 0, `${sourceCs.length} C# source files`, "no C# source files in scope");
step("unslop-ui", uiFiles.length > 0 && !usesReact, `${uiFiles.length} UI files, no React, so it runs on its own`,
  uiFiles.length === 0 ? "no UI files in scope" : "covered by unslop-react through unslop-typescript");
step("unslop-text", docs.length > 0, `${docs.length} docs`, "no docs in scope");

if (!isGit) {
  skipped.push({ skill: "unslop-git", reason: "not a git repository" });
} else if (!isPicked("unslop-git")) {
  skipped.push({ skill: "unslop-git", reason: "not picked" });
} else if (mode === "paths" && !picked) {
  skipped.push({ skill: "unslop-git", reason: "the scope is files or folders, not history; pass --passes with commits to audit the branch too" });
} else {
  step("unslop-git", commits > 0, `audit ${range} (${commits} commits)`, `no commits in ${range}`);
  if (commits > 0) plan[plan.length - 1].range = range;
}

const scope = { mode, paths: scopePaths, excluded: excludePaths, base, files: files.length };
const detected = {
  tests: { files: tests.length },
  typescript: { files: sourceJs.length, byExt: byExt(sourceJs, ["ts", "tsx", "mts", "cts", "js", "jsx", "mjs", "cjs"]) },
  react: { uses: usesReact, files: reactFiles.length },
  csharp: { files: sourceCs.length, projects: count(files, /\.(?:csproj|sln|slnx)$/i) },
  ui: { files: uiFiles.length, byExt: byExt(uiFiles, ["css", "scss", "less", "html", "vue", "svelte", "astro", "razor", "cshtml", "tsx", "jsx"]) },
  text: { files: docs.length },
  git: { repo: isGit, branch, defaultBranch },
};

if (asking) {
  console.log(JSON.stringify(survey(), null, 2));
} else if (json) {
  console.log(JSON.stringify({ root, scope, detected, plan, skipped }, null, 2));
} else {
  const scopeLine = mode === "repo" ? "whole repo" : mode === "changed" ? `changes against ${base}${scopePaths.length ? ` under ${scopePaths.join(", ")}` : ""}` : scopePaths.join(", ");
  console.log(`Project: ${root}`);
  console.log(`Scope:   ${scopeLine} (${files.length} files)${excludePaths.length ? `, excluding ${excludePaths.join(", ")}` : ""}`);
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

// --questions: what the scope holds, and the questions to settle before a run. Each question
// follows AskUserQuestion's limits (header up to 12 characters, 2 to 4 options, recommended
// option first), and `answers` maps every option label to the detect.mjs flags it stands for.
function survey() {
  const allFiles = (isGit ? lines(gitAt("ls-files", "-co", "--exclude-standard")) : walkFrom([root])).filter((f) => !SKIP.test(f));
  const dirs = new Set();
  for (const f of allFiles) {
    const parts = f.split("/");
    for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join("/"));
  }
  const holdsScope = (d) => files.some((f) => under(f, d));
  const withSlash = (list) => {
    const shown = list.slice(0, 4).map((d) => `${d}/`).join(", ");
    return list.length > 4 ? `${shown}, and ${list.length - 4} more` : shown;
  };
  const outermost = (list) => list.filter((d) => !list.some((o) => o !== d && under(d, o)));

  // Lines in instruction files that restrict edits, and the folders they name.
  const INSTRUCTIONS = /(?:^|\/)(?:AGENTS|CLAUDE|CONTRIBUTING)\.md$|(?:^|\/)\.github\/copilot-instructions\.md$/i;
  const RESTRICTS = /\b(?:read[- ]only|off[- ]limits|(?:do(?:es)? not|don'?t|never|must not) (?:edit|touch|modify|change|refactor|reformat|rewrite)|untouched|frozen|leave\b[^.]{0,40}\balone|only when the owner|unless the owner|(?:auto-?)?generated (?:code|files?|by)|vendored)\b/i;
  // A rule with no path counts only when it limits edits to an area in words ("touch another
  // game only when the owner names it"); rules about behavior ("never add bots") are not scope.
  const EDITS = /\b(?:touch|edit|modif|change|work(?:s|ed)? on|rewrit|refactor|reformat)\w*/i;
  const AREA = /\b(?:folders?|director(?:y|ies)|files?|games?|packages?|modules?|areas?|apps?|projects?|paths?|code)\b/i;
  const rules = [];
  const protectedDirs = new Map();
  for (const file of allFiles.filter((f) => INSTRUCTIONS.test(f))) {
    let text;
    try { text = readFileSync(join(root, file), "utf8"); } catch { continue; }
    const here = posix.dirname(file) === "." ? "" : posix.dirname(file);
    text.split("\n").forEach((line, i) => {
      if (!RESTRICTS.test(line)) return;
      const tokens = [...line.matchAll(/`([^`\s]+)`/g)].map((m) => m[1])
        .concat([...line.matchAll(/(?:^|[\s(])((?:\.\/)?[\w.@-]+(?:\/[\w.@-]+)*\/)(?=[\s,.;:)]|$)/g)].map((m) => m[1]));
      const named = new Set();
      for (const raw of tokens) {
        const t = raw.replace(/^\.\//, "").replace(/\/\*{1,2}$/, "").replace(/\/$/, "");
        if (!t || /^(?:https?:|-|@)/.test(t)) continue;
        for (const candidate of [here ? posix.normalize(`${here}/${t}`) : t, posix.normalize(t)]) {
          if (!candidate.startsWith("..") && dirs.has(candidate)) { named.add(candidate); break; }
        }
      }
      if (!named.size && !(EDITS.test(line) && AREA.test(line))) return;
      rules.push({ file, line: i + 1, text: line.trim().slice(0, 240), paths: [...named] });
      for (const d of named) if (holdsScope(d) && !protectedDirs.has(d)) protectedDirs.set(d, `${file}:${i + 1}`);
    });
  }
  const protectedList = outermost([...protectedDirs.keys()]);
  const covered = (d) => protectedList.some((p) => under(d, p));

  // Release records hold no code; a `history/` folder of source files is a feature, not a record.
  const CODE = /\.(?:[cm]?[jt]sx?|cs|py|go|rs|java|kt|rb|php|svelte|vue|astro|css|scss|less|html?)$/i;
  const recordDirs = outermost([...dirs].filter((d) => /(?:^|\/)(?:changelogs?|history|release[-_]?notes|\.changeset)$/i.test(d)
    && holdsScope(d) && !covered(d) && !allFiles.some((f) => under(f, d) && CODE.test(f))));
  const generatedDirs = outermost([...dirs].filter((d) => /(?:^|\/)(?:generated|__generated__|third[-_]party|vendored)$/i.test(d)
    && holdsScope(d) && !covered(d)));

  // Top-level areas by code, test, and doc files. One folder holding everything is not a choice,
  // so the survey looks inside it.
  const relevant = [...new Set([...tests, ...sourceJs, ...sourceCs, ...uiFiles, ...docs])];
  let prefix = "";
  let areas = [];
  for (let depth = 0; depth < 4; depth++) {
    const counts = new Map();
    let loose = 0;
    for (const f of relevant) {
      if (!under(f, prefix)) continue;
      const rest = prefix ? f.slice(prefix.length + 1) : f;
      const cut = rest.indexOf("/");
      if (cut === -1) { loose++; continue; }
      const area = prefix ? `${prefix}/${rest.slice(0, cut)}` : rest.slice(0, cut);
      counts.set(area, (counts.get(area) ?? 0) + 1);
    }
    areas = [...counts].sort((a, b) => b[1] - a[1]).map(([path, n]) => ({ path, files: n }));
    if (areas.length === 1 && loose === 0) { prefix = areas[0].path; continue; }
    break;
  }

  let branchChanges = 0;
  if (mode === "repo" && isGit && defaultBranch && branch && branch !== defaultBranch) {
    const changed = new Set([...lines(gitAt("diff", "--name-only", "--diff-filter=d", `${defaultBranch}...HEAD`)), ...lines(gitAt("ls-files", "-mo", "--exclude-standard"))]);
    branchChanges = [...changed].filter((f) => !SKIP.test(f) && (CODE.test(f) || /\.(?:md|mdx|markdown|txt|rst|adoc)$/i.test(f))).length;
  }
  const dirty = isGit && lines(gitAt("status", "--porcelain")).length > 0;

  const kindList = [
    [tests.length, "test"], [sourceJs.length, "TS/JS"], [sourceCs.length, "C#"], [uiFiles.length, "UI"], [docs.length, "doc"],
  ].filter(([n]) => n).map(([n, k]) => `${n} ${k}`);
  const kinds = kindList.length > 1 ? `${kindList.slice(0, -1).join(", ")}, and ${kindList.at(-1)} files` : kindList.length ? `${kindList[0]} files` : "";

  const questions = [];
  const answers = {};
  const ask = (header, question, multiSelect, options) => {
    if (options.length < 2) return;
    questions.push({ question, header, multiSelect, options: options.map(({ label, description }) => ({ label, description })) });
    answers[header] = Object.fromEntries(options.map((o) => [o.label, o.answer]));
  };
  const excludeFlags = (list) => list.flatMap((d) => ["--exclude", join(root, d)]);

  if (mode === "repo") {
    const whole = { label: "Whole repo", description: `Every file git tracks: ${kinds || "no code, tests, or docs"}.`, answer: { flags: [] } };
    const options = branchChanges > 0
      ? [{ label: "Branch changes (Recommended)", description: `The ${branchChanges} files ${branch} changes against ${defaultBranch}, plus uncommitted work.`, answer: { flags: ["--changed"] } }, whole]
      : [{ ...whole, label: "Whole repo (Recommended)" }];
    if (areas.length >= 2) {
      for (const a of areas.slice(0, 4 - options.length).slice(0, 2)) {
        options.push({ label: a.path, description: `Only ${a.path}/, with ${a.files} code, test, and doc files.`, answer: { flags: [join(root, a.path)] } });
      }
    }
    ask("Scope", "What should the unslop run cover? Other takes folders or files.", false, options);
  }

  const exclusions = [];
  if (protectedList.length) {
    const sources = [...new Set(protectedList.map((d) => protectedDirs.get(d)))].join(", ");
    exclusions.push({ label: "Protected areas", description: `${sources} restricts edits to ${withSlash(protectedList)}.`, answer: { flags: excludeFlags(protectedList) } });
  }
  if (recordDirs.length) exclusions.push({ label: "Release records", description: `Changelogs and history, kept as written: ${withSlash(recordDirs)}.`, answer: { flags: excludeFlags(recordDirs) } });
  if (generatedDirs.length) exclusions.push({ label: "Generated code", description: `Code a tool writes or a vendor ships: ${withSlash(generatedDirs)}.`, answer: { flags: excludeFlags(generatedDirs) } });
  if (exclusions.length) {
    exclusions.push({ label: "Nothing extra", description: "Cover every file in scope. Agent tooling folders such as .claude/ are always left out.", answer: { flags: [] } });
    ask("Exclude", "Which areas should the run leave alone? Other takes folders.", true, exclusions);
  }

  const passes = [];
  if (tests.length) passes.push({ label: "Tests", description: `unslop-tests on ${tests.length} test files.`, answer: { passes: ["tests"] } });
  const code = [];
  if (sourceJs.length) code.push(`unslop-typescript on ${sourceJs.length} TS/JS files${usesReact ? ", then unslop-react and unslop-ui" : ""}`);
  if (sourceCs.length) code.push(`unslop-csharp on ${sourceCs.length} C# files`);
  if (uiFiles.length && !usesReact) code.push(`unslop-ui on ${uiFiles.length} UI files`);
  if (code.length) passes.push({ label: "Code", description: `${code.join("; ")}.`, answer: { passes: ["code"] } });
  if (docs.length) passes.push({ label: "Docs", description: `unslop-text on ${docs.length} docs.`, answer: { passes: ["docs"] } });
  if (isGit && commits > 0) passes.push({ label: "Commit messages", description: `unslop-git audits ${range} (${commits} commits) and proposes rewordings. It rewrites nothing without your approval.`, answer: { passes: ["commits"] } });
  ask("Passes", "Which passes should run? Pick every one you want.", true, passes);

  const date = new Date().toLocaleDateString("sv-SE");
  const report = { label: "Report only", description: "Change no file. Every finding goes into .unslop/report.html as a proposal to pick from.", answer: { mode: "report" } };
  const landing = isGit
    ? [
      { label: "Review branch (Recommended)", description: `Create unslop/${date} from HEAD and commit each pass on its own, so any pass can be reverted alone.`, answer: { mode: "branch" } },
      { label: "Current branch", description: `Edit files on ${branch} and leave every pass uncommitted for you to review and commit.`, answer: { mode: "uncommitted" } },
      report,
    ]
    : [
      { label: "Edit in place (Recommended)", description: "Edit the files directly. Without git, a pass can't be reverted on its own.", answer: { mode: "uncommitted" } },
      report,
    ];
  const dirtyNote = dirty ? " The worktree has uncommitted changes: editing needs them committed or stashed first." : "";
  ask("Changes", `How should the changes land?${dirtyNote}`, false, landing);

  return {
    root,
    survey: {
      scope,
      git: { repo: isGit, branch, defaultBranch, dirty, branchChanges, range, commits },
      counts: { tests: tests.length, typescript: sourceJs.length, react: reactFiles.length, csharp: sourceCs.length, ui: uiFiles.length, docs: docs.length },
      areas: areas.slice(0, 8),
      protected: protectedList.map((d) => ({ path: d, source: protectedDirs.get(d) })),
      releaseRecords: recordDirs,
      generated: generatedDirs,
      plan: plan.map((p) => p.skill),
    },
    rules,
    questions,
    answers,
  };
}
