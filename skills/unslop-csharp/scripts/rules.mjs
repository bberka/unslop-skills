// unslop-ignore-file
// Lexical C# tells for scan.mjs. Ids match ../TELLS.md.
// Test projects are excluded (by path, and by the nearest .csproj referencing a test framework):
// unslop-tests owns them. Generated files and sample, snippet, and benchmark folders are skipped
// where the tell needs shipped code.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const files = /\.cs$/i;
const exclude = /(?:^|\/)tests?\/|(?:^|\/)[\w.]*Tests?(?:\.[\w.]+)?\/|Tests?\.cs$|(?:^|\/)(?:obj|bin|Migrations)\/|\.(?:g|g\.i|[Dd]esigner|[Gg]enerated)\.cs$|AssemblyInfo\.cs$/;
const demo = /(?:^|\/)(?:samples?|examples?|snippets?|docs?|bench(?:marks?)?|templates?)\//i;

// The nearest .csproj above a file (cached per folder), with the properties the tells depend on.
// Directory.Build.props values fill in what the .csproj leaves unset.
const projects = new Map();
const prop = (xml, name) => new RegExp(`<${name}>\\s*([^<]*?)\\s*</${name}>`, "i").exec(xml)?.[1];
function readProject(dir, csproj) {
  const xml = readFileSync(join(dir, csproj), "utf8");
  const layers = [xml];
  for (let d = dir; ; d = dirname(d)) {
    const props = join(d, "Directory.Build.props");
    if (existsSync(props)) layers.push(readFileSync(props, "utf8"));
    if (dirname(d) === d) break;
  }
  const get = (name) => layers.map((l) => prop(l, name)).find((v) => v !== undefined) ?? "";
  const sdk = /Sdk\s*=\s*"([^"]+)"/.exec(xml)?.[1] ?? "";
  const ui = /true/i.test(get("UseMaui") + get("UseWPF") + get("UseWindowsForms"));
  return {
    app: /\.(?:Web|Worker)$/i.test(sdk) || (/exe/i.test(get("OutputType")) && !ui && !/Razor|Blazor/i.test(sdk)),
    docs: /true/i.test(get("GenerateDocumentationFile")),
    test: /true/i.test(get("IsTestProject")) || /PackageReference\s+Include="(?:xunit|nunit|MSTest|TUnit|Microsoft\.NET\.Test\.Sdk)/i.test(xml),
  };
}
function projectOf(path) {
  const chain = [];
  let dir = resolve(dirname(path));
  let info = null;
  for (;;) {
    if (projects.has(dir)) { info = projects.get(dir); break; }
    chain.push(dir);
    let csproj;
    try { csproj = readdirSync(dir).find((f) => /\.csproj$/i.test(f)); } catch { csproj = undefined; }
    if (csproj) { info = readProject(dir, csproj); break; }
    if (dirname(dir) === dir) break;
    dir = dirname(dir);
  }
  for (const d of chain) projects.set(d, info);
  return info;
}

// Generated files and test projects are not the shipped code these tells judge.
const notShipped = (text, path) =>
  /<auto-?generated|generated code|This code was generated/i.test(text.slice(0, 600)) || projectOf(path)?.test === true;

// cs-16: a summary restates the member when its words (minus ceremony) all come from the member's
// name. `<param name="id">The id.</param>` is the same tell. In a project that generates
// documentation, CS1591 demands docs on everything visible, so only private and internal members
// are checked there.
const STOP = new Set(["gets", "sets", "or", "the", "a", "an", "of", "this", "that", "for", "to", "is", "whether", "value", "new",
  "instance", "initializes", "class", "struct", "record", "interface", "enum", "returns", "represents", "defines", "specifies",
  "indicates", "current", "given", "specified", "provides", "creates", "in", "on", "with", "and", "async", "asynchronously",
  "method", "property", "constructor", "type", "object", "object's", "its", "if", "when", "as", "default", "by"]);
const stem = (w) => (w.length > 3 ? w.replace(/s$/, "") : w);
const words = (s) => s.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2").toLowerCase()
  .split(/[^a-z0-9']+/).filter((w) => w && !STOP.has(w)).map(stem);
const memberName = (line) => {
  const decl = line.replace(/\bwhere\b.*$/, "").replace(/\s*:.*$/, "");
  return /\b(?:class|struct|record|interface|enum|event\s+[\w<>?]+|delegate\s+[\w<>?]+)\s+(\w+)/.exec(decl)?.[1]
    ?? /\b(\w+)\s*(?:<[^>]*>)?\s*(?:\(|\{|=>|;|=|$)/.exec(decl)?.[1];
};
function restatingDocs(text, path) {
  if (notShipped(text, path)) return [];
  const docs = projectOf(path)?.docs === true;
  const hits = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*\/\/\/\s*<summary>/.test(lines[i])) continue;
    let j = i;
    while (j < lines.length && /^\s*(?:\/\/\/|\[)/.test(lines[j])) j++;
    const block = lines.slice(i, j).filter((l) => /^\s*\/\/\//.test(l)).map((l) => l.replace(/^\s*\/\/\/\s?/, "")).join("\n");
    const decl = lines[j] ?? "";
    if (docs && !/\b(?:private|internal)\b/.test(decl)) continue;
    const name = memberName(decl.trim());
    if (!name) continue;
    const own = new Set(words(name));
    const summary = /<summary>([\s\S]*?)<\/summary>/.exec(block)?.[1] ?? "";
    const plain = summary.replace(/<see\s+cref="([^"]+)"\s*\/>/g, (_m, c) => c.replace(/[{(].*$/, "").split(".").pop())
      .replace(/<[^>]+>/g, " ");
    const rest = words(plain).filter((w) => !STOP.has(w));
    if (rest.every((w) => own.has(w))) hits.push({ line: i + 1, match: `summary restates ${name}` });
    for (const p of block.matchAll(/<param name="(\w+)">\s*(?:The|A|An)\s+([^<]*?)\.?\s*<\/param>/gi)) {
      if (words(p[2]).every((w) => words(p[1]).includes(w))) hits.push({ line: i + 1 + block.slice(0, p.index).split("\n").length - 1, match: `param ${p[1]}` });
    }
  }
  return hits;
}

// cs-11: the tell is density, so one hit per file once `!` shows up three times or more.
function nullForgiving(text, path) {
  if (notShipped(text, path)) return [];
  const lines = text.split("\n");
  let first = 0, count = 0;
  lines.forEach((l, i) => {
    if (/^\s*\/\//.test(l)) return;
    const n = (l.match(/\bnull!|[\w)\]]!(?=[.;),\]\s])/g) ?? []).length;
    if (n && !first) first = i + 1;
    count += n;
  });
  return count >= 3 ? [{ line: first, match: `${count} null-forgiving operators` }] : [];
}

// cs-22: lines of code, with blank lines and comment lines left out.
function godFile(text, path) {
  if (notShipped(text, path)) return [];
  const n = text.split("\n").filter((l) => l.trim() && !/^\s*\/\//.test(l)).length;
  return n >= 600 ? [{ line: 1, match: `${n} lines of code` }] : [];
}

const INNER_LAYER = /(?:^|\/)[\w.]*(?:Domain|Core|Entities|Abstractions)(?:\.[\w.]+)?\//;
const COMPOSITION_ROOT = /(?:^|\/)(?:Program|Startup|[\w.]*Extensions|DependencyInjection|ServiceCollection\w*|[\w.]*Module)\.cs$/;

export default [
  { id: "cs-22", title: "God file", files, exclude, check: godFile },
  { id: "cs-24", title: "Inner layer importing infrastructure", files, exclude, skipFile: notShipped,
    pattern: /^\s*using\s+(?:Microsoft\.(?:EntityFrameworkCore|AspNetCore|Data\.SqlClient)|System\.Data(?:\.\w+)?|Dapper|Npgsql|MongoDB\.Driver|StackExchange\.Redis)\b/,
    filter: (_m, _line, path) => INNER_LAYER.test(path) },
  { id: "cs-25", title: "Static mutable state", files, exclude, skipFile: notShipped,
    pattern: /\b(?:public|internal|protected)\s+static\s+(?!readonly\b|class\b|void\b|async\b|implicit\b|explicit\b|operator\b|event\b|extern\b|partial\b|unsafe\b|abstract\b|override\b|virtual\b|new\b|record\b|struct\b|interface\b|enum\b|delegate\b)[\w<>\[\],?.]+\s+\w+\s*(?:\{\s*get;\s*set;|=(?!>)|;)/ },
  { id: "cs-25", title: "Service locator", files, exclude, skipFile: notShipped,
    pattern: /\.Get(?:Required)?Service<\w+>\(\)/,
    filter: (_m, _line, path) => !COMPOSITION_ROOT.test(path) },
  { id: "cs-5", title: "Junk-drawer class", files, exclude: new RegExp(`${exclude.source}|${demo.source}`, "i"), skipFile: notShipped,
    pattern: /\b(?:class|interface)\s+I?\w*(?:Manager|Helpers?|Utils?|Utility|Utilities|Processor)\b/ },
  { id: "cs-7", title: "Commented-out code", files, exclude, skipFile: notShipped,
    multiline: /(?:^[ \t]*\/\/(?!\/)[ \t]*(?:var |return\b|if ?\(|for(?:each)? ?\(|while ?\(|await |using |public |private |new |\}|[\w.]+\(.*\);\s*$|[\w.]+\s*=\s*.+;\s*$)[^\n]*\n){2,}/m },
  { id: "cs-8", title: "Blocking on async", files, exclude, skipFile: notShipped,
    pattern: /\)\s*\.Result\b(?!\s*=)|\b\w*[tT]ask\w*\.Result\b(?!\s*=)|\.Wait\(\)|\.GetAwaiter\(\)\.GetResult\(\)|\bTask\.Wait(?:All|Any)\(/ },
  { id: "cs-9", title: "async void", files, exclude, pattern: /\basync\s+void\s+\w+\s*\(/,
    skipFile: notShipped, filter: (_m, line) => !/EventArgs|\bsender\b/.test(line) },
  { id: "cs-9", title: "Task.Run around async work", files, exclude, skipFile: notShipped, pattern: /Task\.Run\(\s*async\b/ },
  { id: "cs-9", title: "ConfigureAwait(false) in app code", files, exclude: new RegExp(`${exclude.source}|${demo.source}`, "i"), pattern: /\.ConfigureAwait\(false\)/,
    skipFile: notShipped, filter: (_m, _line, path) => projectOf(path)?.app === true },
  { id: "cs-10", title: "throw ex resets the stack", files, exclude, skipFile: notShipped, pattern: /\bthrow\s+(?:ex|e|exception|err)\s*;/ },
  { id: "cs-10", title: "Empty or swallowing catch", files, exclude, skipFile: notShipped,
    multiline: /catch(?:\s*\((?!\s*(?:System\.)?(?:Operation|Task)Canceled)[^)]*\))?(?!\s*when\b)\s*\{\s*(?:return(?:\s+(?:null|false|default|0|string\.Empty|""))?\s*;\s*)?\}/ },
  { id: "cs-10", title: "Log-and-rethrow", files, exclude, skipFile: notShipped,
    multiline: /catch\s*\(\s*Exception\s+\w+\s*\)\s*\{\s*_?\w*[Ll]ogger\??\.Log\w*\([^;]*\);\s*throw\s*;\s*\}/ },
  { id: "cs-11", title: "Null-forgiving spam", files, exclude, check: nullForgiving },
  { id: "cs-12", title: "LINQ detour", files, exclude, skipFile: notShipped,
    pattern: /\.Count\(\)\s*(?:>\s*0|!=\s*0|>=\s*1)|\.Where\([^()]*(?:\([^()]*\)[^()]*)*\)\.(?:First|FirstOrDefault|Single|SingleOrDefault|Any|Count|Last|LastOrDefault)\(\)|\.ToList\(\)\.(?:ForEach|Where|Select|Any|First|FirstOrDefault|Count)\(/ },
  { id: "cs-13", title: "string.Format", files, exclude, skipFile: notShipped, pattern: /\b[Ss]tring\.Format\(/ },
  { id: "cs-14", title: "Magic string key", files, exclude, skipFile: notShipped,
    pattern: /(?:Configuration|_?config(?:uration)?)\s*\[\s*"[^"]+"\s*\]|FindFirst(?:Value)?\(\s*"[^"]+"\s*\)|HasClaim\(\s*"[^"]+"\s*,/ },
  { id: "cs-15", title: "HttpClient per call", files, exclude: new RegExp(`${exclude.source}|${demo.source}`, "i"), skipFile: notShipped,
    pattern: /new\s+HttpClient\s*\(/ },
  { id: "cs-15", title: "GC.Collect", files, exclude, skipFile: notShipped, pattern: /\bGC\.Collect\(/ },
  { id: "cs-16", title: "Restating XML doc", files, exclude, check: restatingDocs },
  { id: "cs-17", title: "Region or banner", files, exclude: new RegExp(`${exclude.source}|${demo.source}`, "i"),
    pattern: /^\s*#region\b[^\n]*|^\s*\/\/\s*[=\-*#]{4,}/,
    skipFile: notShipped, filter: (m) => !/#region\s+\S*-/.test(m) },
  { id: "cs-18", title: "Interpolated log template", files, exclude, skipFile: notShipped,
    pattern: /\.Log(?:Trace|Debug|Information|Warning|Error|Critical)\(\s*(?:\w+\s*,\s*)?\$"/ },
  { id: "cs-18", title: "Trace log noise", files, exclude, skipFile: notShipped,
    pattern: /\.Log\w*\(\s*\$?"(?:Entering|Exiting|Entered|Exited|Inside|Leaving)\b/i },
  { id: "cs-19", title: "Debug residue", files, exclude: new RegExp(`${exclude.source}|${demo.source}`, "i"),
    pattern: /\bConsole\.Write(?:Line)?\(|\bDebug\.Write(?:Line)?\(/,
    skipFile: notShipped, filter: (_m, _line, path) => !/(?:^|\/)Program\.cs$/.test(path) },
  { id: "cs-19", title: "Not implemented", files, exclude: new RegExp(`${exclude.source}|${demo.source}`, "i"), skipFile: notShipped,
    pattern: /throw\s+new\s+NotImplementedException\(/ },
  { id: "cs-19", title: "TODO without issue", files, exclude, skipFile: notShipped,
    pattern: /\/\/\s*(?:TODO|FIXME|XXX|HACK)\b(?!.*(?:#\d+|https?:\/\/|\b[A-Z][A-Z0-9]+-\d+))/ },
];
