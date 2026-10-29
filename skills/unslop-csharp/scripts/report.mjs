#!/usr/bin/env node
// Renders the change ledger (.unslop/ledger.jsonl) as one self-contained HTML page: every
// change, keep, and proposal with its tell, reason, evidence, and git diff, plus the files that
// changed with no ledger entry. The source of truth is shared/report.mjs; tools/sync.mjs copies
// it into every skill's scripts/ folder.
//
// Usage: node report.mjs [--base <ref>] [--out <file>]
//   --base  diff against this ref. Default: the working-tree snapshot `ledger.mjs start` recorded
//           (uncommitted work at the start is not the run's change), else its HEAD, else HEAD.
//           The other side is the working tree now, untracked files included.
//   --out   output path. Default: report.html next to the ledger.
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { worktreeTree } from "./worktree.mjs";

const MAX_DIFF_LINES = 800;
const ACTIONS = ["remove", "delete-file", "rewrite", "merge", "move", "keep", "propose"];

const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log(readFileSync(new URL(import.meta.url), "utf8").split("\n").filter((l) => l.startsWith("//")).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
  process.exit(0);
}
const flag = (name) => { const i = args.indexOf(name); return i === -1 ? undefined : args[i + 1]; };
const fail = (message) => { console.error(`report: ${message}`); process.exit(2); };

const gitIn = (cwd) => (...a) => {
  try { return execFileSync("git", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 28 }).replace(/\n$/, ""); }
  catch { return null; }
};
const root = gitIn(process.cwd())("rev-parse", "--show-toplevel") ?? process.cwd();
const git = gitIn(root);


const isGit = git("rev-parse", "--is-inside-work-tree") === "true";
const lines = (out) => (out ?? "").split("\n").filter(Boolean);

const ledgerPath = process.env.UNSLOP_LEDGER ? resolve(process.env.UNSLOP_LEDGER) : join(root, ".unslop", "ledger.jsonl");
if (!existsSync(ledgerPath)) fail(`no ledger at ${ledgerPath}; record changes with ledger.mjs first`);
let unreadable = 0;
const records = lines(readFileSync(ledgerPath, "utf8")).flatMap((l) => {
  try { return [JSON.parse(l)]; } catch { unreadable++; return []; }
});
const start = records.find((r) => r.type === "start");
const entries = records.filter((r) => r.type === undefined);
const outPath = resolve(flag("--out") ?? join(dirname(ledgerPath), "report.html"));

// Tell titles come from the sibling skills' catalogs: "**ts-12 Middle men.**".
const titles = {};
const skillsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
for (const dir of existsSync(skillsDir) ? readdirSync(skillsDir) : []) {
  if (!dir.startsWith("unslop-")) continue;
  for (const doc of ["TELLS.md", "SKILL.md"]) {
    const path = join(skillsDir, dir, doc);
    if (!existsSync(path)) continue;
    for (const m of readFileSync(path, "utf8").matchAll(/\*\*([a-z]+-\d+) (.+?)(?: \([A-Z, ]+\))?\.?\*\*/g)) titles[m[1]] ??= m[2].trim();
  }
}

// What changed on disk since the base, so the page can show diffs and catch unexplained changes.
let base = flag("--base");
let baseLabel = base;
if (isGit && !base) {
  base = start?.snapshot ?? start?.head ?? "HEAD";
  baseLabel = start?.head ? `run start, ${String(start.time ?? "").replace("T", " ").slice(0, 16)} UTC${start.branch ? ` on ${start.branch}` : ""}` : "HEAD, no start record";
}
const changed = new Map();
const now = isGit ? worktreeTree(root) : null;
if (isGit) {
  if (git("rev-parse", "--verify", "-q", base) === null) fail(`unknown base ${base}`);
  for (const line of lines(git("diff", "--name-status", "--find-renames", base, ...(now ? [now] : [])))) {
    const parts = line.split("\t");
    changed.set(parts[parts.length - 1], { status: parts[0][0], from: parts.length > 2 ? parts[1] : null });
  }
  if (!now) {
    for (const f of lines(git("ls-files", "-o", "--exclude-standard"))) {
      if (!f.startsWith(".unslop/") && !changed.has(f)) changed.set(f, { status: "A", from: null });
    }
  }
}

function diffFor(path) {
  const info = changed.get(path);
  if (!info) return null;
  let raw;
  if (!now && info.status === "A" && git("ls-files", "--error-unmatch", path) === null) {
    try { raw = readFileSync(join(root, path), "utf8").split("\n").map((l) => `+${l}`).join("\n"); } catch { raw = ""; }
  } else {
    raw = git("diff", "--no-color", "--find-renames", base, ...(now ? [now] : []), "--", ...(info.from ? [info.from, path] : [path])) ?? "";
  }
  const body = raw.split("\n").filter((l) => !/^(?:diff --git|index |--- |\+\+\+ |similarity |rename |new file|deleted file)/.test(l));
  const adds = body.filter((l) => l.startsWith("+")).length;
  const dels = body.filter((l) => l.startsWith("-")).length;
  return { status: info.status, adds, dels, lines: body.slice(0, MAX_DIFF_LINES), cut: Math.max(0, body.length - MAX_DIFF_LINES) };
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const weight = (e) => e.count ?? 1;
const STATUS = { A: "added", D: "deleted", M: "modified", R: "renamed", C: "copied", T: "type changed" };

const byFile = new Map();
const noFile = [];
for (const e of entries) {
  if (e.file) (byFile.get(e.file) ?? byFile.set(e.file, []).get(e.file)).push(e);
  else noFile.push(e);
}
const unexplained = [...changed.keys()].filter((f) => !byFile.has(f)).sort();

function renderEntry(e) {
  const search = [e.skill, e.tell, titles[e.tell], e.action, e.file, e.what, e.why, e.evidence, e.commit].filter(Boolean).join(" ").toLowerCase();
  return `<li class="entry" data-skill="${esc(e.skill)}" data-action="${esc(e.action)}" data-tell="${esc(e.tell)}" data-search="${esc(search)}">
  <div class="entry-head"><span class="action a-${esc(e.action)}">${esc(e.action)}</span><code class="tell">${esc(e.tell)}</code><span class="tell-title">${esc(titles[e.tell] ?? "")}</span>${e.line ? `<span class="meta">line ${esc(e.line)}</span>` : ""}${e.count ? `<span class="meta">x${esc(e.count)}</span>` : ""}${e.commit ? `<code class="meta">${esc(String(e.commit).slice(0, 12))}</code>` : ""}<span class="meta skill">${esc(e.skill)}</span></div>
  ${e.what ? `<p class="what">${esc(e.what)}</p>` : ""}
  <p><span class="label">Why</span>${esc(e.why)}</p>
  ${e.evidence ? `<p><span class="label">Evidence</span><code class="evidence">${esc(e.evidence)}</code></p>` : ""}
</li>`;
}

function renderDiff(d, open = false) {
  if (!d) return `<p class="note">No change on disk against the base for this file.</p>`;
  const body = d.lines.map((l) => {
    const cls = l.startsWith("@@") ? "h" : l.startsWith("+") ? "a" : l.startsWith("-") ? "d" : "c";
    return `<span class="${cls}">${esc(l) || " "}</span>`;
  }).join("");
  return `<details${open ? " open" : ""}><summary>Diff: ${STATUS[d.status] ?? d.status}, +${d.adds} -${d.dels}</summary><pre class="diff">${body}${d.cut ? `<span class="h">... ${d.cut} more lines not shown</span>` : ""}</pre></details>`;
}

function fileLink(path, line) {
  return `<a href="vscode://file/${esc(encodeURI(join(root, path)))}${line ? `:${line}` : ""}">${esc(path)}</a>`;
}

const fileSections = [...byFile.keys()].sort().map((path) => {
  const d = diffFor(path);
  const firstLine = byFile.get(path).find((e) => e.line)?.line;
  return `<article class="file" data-has-entries="1">
  <h3>${fileLink(path, firstLine)}${d ? ` <span class="status s-${esc(d.status)}">${STATUS[d.status] ?? d.status}</span>` : ""}</h3>
  <ul class="entries">${byFile.get(path).map(renderEntry).join("\n")}</ul>
  ${renderDiff(d)}
</article>`;
}).join("\n");

const unexplainedSection = unexplained.length ? `<section id="unexplained">
  <h2>Changed with no ledger entry (${unexplained.length})</h2>
  <p class="note">These files differ from the base, but no skill recorded why. Review them before merging.</p>
  ${unexplained.map((path) => `<article class="file"><h3>${fileLink(path)} <span class="status s-${esc(changed.get(path).status)}">${STATUS[changed.get(path).status] ?? changed.get(path).status}</span></h3>${renderDiff(diffFor(path))}</article>`).join("\n")}
</section>` : "";

const noFileSection = noFile.length ? `<section id="other"><h2>Commits and other entries (${noFile.length})</h2>
  <article class="file" data-has-entries="1"><ul class="entries">${noFile.map(renderEntry).join("\n")}</ul></article></section>` : "";

const skills = [...new Set(entries.map((e) => e.skill))].sort();
const tells = [...new Set(entries.map((e) => e.tell))].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
const sum = (list, action) => list.filter((e) => e.action === action).reduce((n, e) => n + weight(e), 0);
const summaryRows = skills.map((s) => {
  const mine = entries.filter((e) => e.skill === s);
  return `<tr><th scope="row">${esc(s)}</th>${ACTIONS.map((a) => `<td>${sum(mine, a) || ""}</td>`).join("")}</tr>`;
}).join("\n");
const deletedFiles = entries.filter((e) => e.action === "delete-file").map((e) => e.file).filter(Boolean);

const options = (list, label) => `<option value="">${label}</option>` + list.map((v) => `<option value="${esc(v)}">${esc(v)}${titles[v] ? ` ${esc(titles[v])}` : ""}</option>`).join("");
const shortBase = base ? `${esc(git("rev-parse", "--short", base) ?? base)}${baseLabel && baseLabel !== base ? ` (${esc(baseLabel)})` : ""}` : "none (not a git repository)";

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Unslop report: ${esc(basename(root))}</title>
<style>
:root { --bg: #fbfbf9; --fg: #1c1c1a; --muted: #5f5f58; --line: #deddd6; --panel: #ffffff; --code: #f2f1ec;
  --remove: #a8261b; --delete: #7a1610; --rewrite: #8a5300; --merge: #1f5aa6; --move: #0d6b70; --keep: #55554f; --propose: #5b3fa0;
  --add-bg: #e6f4ea; --del-bg: #fbe9e7; --warn: #8a5300; }
@media (prefers-color-scheme: dark) { :root { --bg: #161614; --fg: #e9e8e2; --muted: #a3a29a; --line: #34332f; --panel: #1e1e1b; --code: #262622;
  --remove: #f08a7e; --delete: #ff9c8f; --rewrite: #e6b35c; --merge: #8ab4f0; --move: #6cc9cc; --keep: #b5b4ac; --propose: #b9a3ef;
  --add-bg: #1d3324; --del-bg: #3a1f1c; --warn: #e6b35c; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width: 1100px; margin: 0 auto; padding: 32px 20px 64px; }
h1 { font-size: 26px; margin: 0 0 4px; }
h2 { font-size: 19px; margin: 36px 0 12px; }
h3 { font-size: 15px; margin: 0 0 10px; font-weight: 600; overflow-wrap: anywhere; }
a { color: inherit; }
a:focus-visible, select:focus-visible, input:focus-visible, summary:focus-visible { outline: 2px solid var(--merge); outline-offset: 2px; }
.meta-line { color: var(--muted); margin: 0 0 20px; }
table { border-collapse: collapse; width: 100%; background: var(--panel); border: 1px solid var(--line); }
th, td { padding: 6px 10px; border-bottom: 1px solid var(--line); text-align: right; font-variant-numeric: tabular-nums; }
th:first-child, td:first-child { text-align: left; }
thead th { font-weight: 600; color: var(--muted); font-size: 13px; }
.filters { position: sticky; top: 0; z-index: 1; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 10px 0; background: var(--bg); border-bottom: 1px solid var(--line); }
select, input { font: inherit; padding: 5px 8px; border: 1px solid var(--line); border-radius: 4px; background: var(--panel); color: var(--fg); }
input { flex: 1 1 220px; }
#visible { color: var(--muted); font-size: 13px; }
.file { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 14px 16px; margin: 0 0 12px; }
.entries { list-style: none; margin: 0; padding: 0; }
.entry { padding: 10px 0; border-top: 1px solid var(--line); }
.entry:first-child { border-top: 0; padding-top: 0; }
.entry p { margin: 4px 0 0; }
.entry-head { display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; }
.action { font-size: 12px; font-weight: 700; text-transform: lowercase; color: var(--keep); }
.a-remove { color: var(--remove); } .a-delete-file { color: var(--delete); } .a-rewrite { color: var(--rewrite); }
.a-merge { color: var(--merge); } .a-move { color: var(--move); } .a-keep { color: var(--keep); } .a-propose { color: var(--propose); }
.tell { font-weight: 600; }
.tell-title { font-weight: 600; }
.meta { color: var(--muted); font-size: 13px; }
.skill { margin-left: auto; }
.what { font-weight: 500; }
.label { display: inline-block; min-width: 72px; color: var(--muted); font-size: 13px; }
code { font: 13px/1.45 ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
.evidence { background: var(--code); padding: 1px 5px; border-radius: 3px; overflow-wrap: anywhere; }
.status { font-size: 12px; font-weight: 600; color: var(--muted); margin-left: 6px; }
.s-D { color: var(--delete); } .s-A { color: var(--move); }
details { margin-top: 10px; }
summary { cursor: pointer; color: var(--muted); font-size: 13px; }
pre.diff { margin: 8px 0 0; padding: 10px 0; background: var(--code); border-radius: 4px; overflow-x: auto; font: 12.5px/1.5 ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
pre.diff span { display: block; padding: 0 12px; white-space: pre; }
pre.diff .a { background: var(--add-bg); } pre.diff .d { background: var(--del-bg); } pre.diff .h { color: var(--muted); }
.note { color: var(--muted); font-size: 14px; }
#unexplained h2 { color: var(--warn); }
ul.plain { margin: 0; padding-left: 20px; }
</style>
</head>
<body>
<main>
<h1>Unslop report: ${esc(basename(root))}</h1>
<p class="meta-line">Generated ${esc(new Date().toISOString().replace("T", " ").slice(0, 16))} UTC. Diff base ${shortBase}. ${entries.length} ledger entries${unreadable ? `, ${unreadable} unreadable lines skipped` : ""}.</p>

<h2>By skill</h2>
<table><thead><tr><th scope="col">Skill</th>${ACTIONS.map((a) => `<th scope="col">${a}</th>`).join("")}</tr></thead>
<tbody>${summaryRows}</tbody></table>

${deletedFiles.length ? `<h2>Deleted files (${deletedFiles.length})</h2><ul class="plain">${deletedFiles.map((f) => `<li><a href="#" data-jump="${esc(f)}">${esc(f)}</a></li>`).join("")}</ul>` : ""}

${unexplainedSection}

<h2>Changes by file</h2>
<div class="filters" role="search">
  <select id="f-skill" aria-label="Skill">${options(skills, "All skills")}</select>
  <select id="f-action" aria-label="Action">${options(ACTIONS.filter((a) => entries.some((e) => e.action === a)), "All actions")}</select>
  <select id="f-tell" aria-label="Tell">${options(tells, "All tells")}</select>
  <input id="f-text" type="search" placeholder="Filter by text, path, or evidence" aria-label="Filter text">
  <span id="visible"></span>
</div>
<section id="files">
${fileSections || `<p class="note">No file entries recorded.</p>`}
</section>
${noFileSection}
</main>
<script>
const $ = (id) => document.getElementById(id);
function apply() {
  const skill = $("f-skill").value, action = $("f-action").value, tell = $("f-tell").value, text = $("f-text").value.trim().toLowerCase();
  let shown = 0;
  document.querySelectorAll(".entry").forEach((e) => {
    const ok = (!skill || e.dataset.skill === skill) && (!action || e.dataset.action === action) && (!tell || e.dataset.tell === tell) && (!text || e.dataset.search.includes(text));
    e.hidden = !ok;
    if (ok) shown++;
  });
  document.querySelectorAll('.file[data-has-entries="1"]').forEach((f) => { f.hidden = !f.querySelector(".entry:not([hidden])"); });
  $("visible").textContent = shown + " of ${entries.length} entries";
}
["f-skill", "f-action", "f-tell", "f-text"].forEach((id) => $(id).addEventListener("input", apply));
document.querySelectorAll("[data-jump]").forEach((a) => a.addEventListener("click", (ev) => {
  ev.preventDefault();
  $("f-text").value = a.dataset.jump.toLowerCase();
  apply();
  $("files").scrollIntoView();
}));
apply();
</script>
</body>
</html>
`;

writeFileSync(outPath, html);
const rel = relative(process.cwd(), outPath) || outPath;
console.log(`report: wrote ${rel} (${entries.length} entr${entries.length === 1 ? "y" : "ies"} across ${byFile.size} file${byFile.size === 1 ? "" : "s"}${unexplained.length ? `; ${unexplained.length} changed file${unexplained.length === 1 ? " has" : "s have"} no ledger entry` : ""})`);
