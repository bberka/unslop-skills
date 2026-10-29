// unslop-ignore-file
// Lexical TypeScript/JavaScript tells for scan.mjs. Ids match ../TELLS.md.
// Test files are excluded: unslop-tests owns them. In .svelte, .vue, and .astro files only the
// <script> blocks are read (the `script` option of scan.mjs), so markup never matches a code rule.
const files = /\.(?:[cm]?tsx?|[cm]?jsx?|svelte|vue|astro)$/i;
const tsOnly = /\.(?:[cm]?tsx?|svelte|vue|astro)$/i;
const exclude = /\.d\.[cm]?ts$|\.(?:test|spec|e2e|e2e-spec|stories)\.[cm]?[jt]sx?$|(?:^|\/)(?:__tests__|__mocks__|__fixtures__|generated|__generated__|e2e|playwright|cypress)\/|\.min\.js$|\.config\.[cm]?[jt]s$/;
// Scripts, CLIs, and build tools print to the console on purpose, and the files they read
// (package.json, a manifest) are the repo's own, not a trust boundary.
const tooling = /(?:^|\/)(?:scripts?|bin|cli|tools)\//;

const junkDrawerFile = (_text, path) =>
  /(?:^|\/)(?:utils?|helpers?|common|misc)\.[cm]?[jt]sx?$/.test(path) ? [{ line: 1, match: path.split("/").pop() }] : [];

// A lone `!` is a judgment call; a chain on one line or a pile in one file is spam.
const nonNull = /[\w\])]!(?=[.[\]),;])/g;
const graphqlVar = /\$\w+\s*:\s*\w+!/;
function nonNullSpam(text) {
  const hits = [];
  let total = 0;
  text.split("\n").forEach((l, i) => {
    if (graphqlVar.test(l)) return;
    const n = (l.match(nonNull) ?? []).length;
    total += n;
    if (n >= 2) hits.push({ line: i + 1, match: l.trim().slice(0, 60) });
  });
  if (hits.length === 0 && total >= 8) hits.push({ line: 1, match: `${total} non-null assertions in this file` });
  return hits;
}

// Blank out comments and the contents of string and template literals, keeping newlines and the
// quote characters, so braces and keywords inside them never count as code.
function codeOnly(text) {
  let out = "";
  const stack = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const inTemplate = stack[stack.length - 1] === "`";
    if (inTemplate) {
      if (c === "\\") { out += "  "; i++; continue; }
      if (c === "`") { stack.pop(); out += c; continue; }
      if (c === "$" && text[i + 1] === "{") { stack.push("{"); out += "${"; i++; continue; }
      out += c === "\n" ? c : " ";
      continue;
    }
    if (c === "/" && text[i + 1] === "/") {
      const end = text.indexOf("\n", i);
      const stop = end === -1 ? text.length : end;
      out += " ".repeat(stop - i);
      i = stop - 1;
      continue;
    }
    if (c === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      const stop = end === -1 ? text.length : end + 2;
      out += text.slice(i, stop).replace(/[^\n]/g, " ");
      i = stop - 1;
      continue;
    }
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== c && text[j] !== "\n") j += text[j] === "\\" ? 2 : 1;
      out += c + " ".repeat(Math.max(0, j - i - 1)) + (j < text.length ? text[j] : "");
      i = j;
      continue;
    }
    if (c === "`") { stack.push("`"); out += c; continue; }
    if (c === "{" && stack.length) stack.push("{");
    if (c === "}" && stack[stack.length - 1] === "{") stack.pop();
    out += c;
  }
  return out;
}

function matching(code, open) {
  const pairs = { "{": "}", "(": ")", "[": "]" };
  const close = pairs[code[open]];
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    if (code[i] === code[open]) depth++;
    else if (code[i] === close && --depth === 0) return i;
  }
  return -1;
}

function matchingBack(code, close) {
  const pairs = { "}": "{", ")": "(", "]": "[" };
  const open = pairs[code[close]];
  let depth = 0;
  for (let i = close; i >= 0; i--) {
    if (code[i] === code[close]) depth++;
    else if (code[i] === open && --depth === 0) return i;
  }
  return -1;
}

// Top-level statements in a block body: semicolons at depth 0, or for semicolon-free code, lines
// that start a statement at depth 0.
function statementCount(body) {
  let depth = 0;
  let semis = 0;
  const starts = [];
  let lineStart = true;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (lineStart && depth === 0 && /\S/.test(c)) { starts.push(i); lineStart = false; }
    if (c === "\n") lineStart = true;
    if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) depth--;
    else if (c === ";" && depth === 0) semis++;
  }
  if (semis > 0) return semis + (/;\s*$/.test(body) || !body.trim() ? 0 : 1);
  return starts.filter((at, k) => {
    if (k === 0) return true;
    const before = body.slice(0, at).trimEnd();
    return !/[,([{=+\-*/|&?:>.]$/.test(before) && !/^[.?:)\]},+\-*/|&=]/.test(body.slice(at));
  }).length;
}

// The last top-level statement of a block body.
function lastStatement(body) {
  const trimmed = body.replace(/;?\s*$/, "");
  let depth = 0;
  let cut = 0;
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i];
    if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) depth--;
    else if (depth === 0 && (c === ";" || (c === "\n" && /^\s*return\b/.test(trimmed.slice(i + 1))))) cut = i + 1;
  }
  return trimmed.slice(cut).trim();
}

// A catch that drops the error (empty, or returns a default) around a single statement is a
// probe: a feature check or a best-effort cleanup, where a trailing `return true` is the probe's
// answer, not a second statement. Reading stored or external data (JSON.parse, web storage, URL
// parsing) fails on bad input, so a default is the handling. Around several other statements the
// catch hides which one failed. A catch that logs is handling at a boundary, not swallowing.
const PARSES_INPUT = /\bJSON\.parse\(|\b(?:local|session)Storage\b|\bnew URL\(|\bdecodeURI(?:Component)?\(|\batob\(|\bstructuredClone\(/;
const DEFAULT_RETURN = /^(?:return(?:\s+(?:null|undefined|false|true|0|-1|\[\s*\]|\{\s*\}|''|""|``))?\s*;?)?$/;
function swallowedErrors(text) {
  const code = codeOnly(text);
  const hits = [];
  for (const m of code.matchAll(/\bcatch\s*(?:\([^)]*\))?\s*\{/g)) {
    const open = m.index + m[0].length - 1;
    const close = matching(code, open);
    if (close === -1 || !DEFAULT_RETURN.test(code.slice(open + 1, close).trim())) continue;
    const tryClose = code.slice(0, m.index).trimEnd().length - 1;
    if (code[tryClose] !== "}") continue;
    const tryOpen = matchingBack(code, tryClose);
    if (tryOpen === -1 || !/\btry\s*$/.test(code.slice(0, tryOpen))) continue;
    const body = code.slice(tryOpen + 1, tryClose);
    if (PARSES_INPUT.test(body)) continue;
    const answer = /^return\b/.test(lastStatement(body)) ? 1 : 0;
    const statements = statementCount(body) - answer;
    if (statements >= 2) hits.push({ line: code.slice(0, m.index).split("\n").length, match: `catch drops the error from ${statements} statements` });
  }
  return hits;
}

// ts-22: an object type that holds loading, error, and data as independent fields can hold them
// all at once. The React version (react-5) counts boolean useState calls instead.
function illegalStates(text) {
  const code = codeOnly(text);
  const hits = [];
  for (const m of code.matchAll(/\b(?:interface\s+\w+(?:<[^>]*>)?(?:\s+extends\s+[^{]+)?|type\s+\w+(?:<[^>]*>)?\s*=)\s*\{/g)) {
    const open = m.index + m[0].length - 1;
    const close = matching(code, open);
    if (close === -1) continue;
    const body = code.slice(open + 1, close);
    const loading = /\b(?:is|has)?[lL]oading\??\s*:\s*boolean\b|\bisPending\??\s*:\s*boolean\b/.test(body);
    const outcome = /\b(?:is)?[eE]rror\??\s*:|\b(?:data|result|value|payload|items)\??\s*:/.test(body);
    if (loading && outcome) hits.push({ line: code.slice(0, m.index).split("\n").length, match: "loading, error, and data as independent fields" });
  }
  return hits;
}

// ts-23: lines of code, with blank lines and comments left out.
function godFile(text) {
  const n = codeOnly(text).split("\n").filter((l) => l.trim()).length;
  return n >= 600 ? [{ line: 1, match: `${n} lines of code` }] : [];
}

// ts-25: dependencies point inward. Presentation code reaching the database or the disk, and
// domain code reaching the web framework, are the two directions a scanner can see.
const INFRA = /\bfrom\s+['"](?:@prisma\/client|drizzle-orm(?:\/[\w-]+)?|knex|pg|mysql2?|mongoose|typeorm|mongodb|better-sqlite3|ioredis|redis|node:fs(?:\/promises)?|fs(?:\/promises)?|node:child_process|child_process|node:net)['"]/;
const FRAMEWORK = /\bfrom\s+['"](?:react|react-dom(?:\/[\w-]+)?|next(?:\/[\w-]+)?|express|fastify|hono|koa|@nestjs\/common|@prisma\/client|drizzle-orm(?:\/[\w-]+)?|mongoose|typeorm|svelte|vue)['"]/;
const PRESENTATION = /(?:^|\/)(?:components|ui|views|hooks|stores?|widgets)\//;
const SERVER_FILE = /(?:^|\/)(?:route|actions?|server|loader)\.[cm]?[jt]sx?$|\.server\.[cm]?[jt]sx?$|\+(?:page|layout)\.server\.|\+server\./;
const DOMAIN = /(?:^|\/)(?:domain|core|entities|use-?cases)\//;

const rules = [
  { id: "ts-8", title: "Unvalidated boundary cast", files: tsOnly, exclude,
    pattern: /\b(?:req(?:uest)?\.(?:body|query|params)|\w+\.json\(\)\)?|JSON\.parse\((?:[^()]|\([^()]*\))*\))\s*as\s+(?!unknown\b|const\b|any\b)\w+/,
    filter: (_m, _line, path) => !tooling.test(path) },
  { id: "ts-22", title: "Representable illegal state", files: tsOnly, exclude, check: illegalStates },
  { id: "ts-23", title: "God file", files, exclude, check: godFile },
  { id: "ts-25", title: "UI layer reaching infrastructure", files, exclude, pattern: INFRA,
    filter: (_m, _line, path) => PRESENTATION.test(path) && !SERVER_FILE.test(path) },
  { id: "ts-25", title: "Domain importing a framework", files, exclude, pattern: FRAMEWORK,
    filter: (_m, _line, path) => DOMAIN.test(path) },
  { id: "ts-1", title: "Type escape hatch", files: tsOnly, exclude,
    pattern: /:\s*any\b|\bas any\b|<any>|\bany\[\]|Array<any>|Record<string,\s*any>|\bas unknown as\b/ },
  { id: "ts-2", title: "Silenced check without reason", files, exclude,
    pattern: /@ts-(?:ignore|nocheck)\b|@ts-expect-error\s*(?:\*\/)?\s*$|eslint-disable(?:-next-line|-line)?\s*(?:\*\/)?\s*$/ },
  { id: "ts-3", title: "Non-null assertion spam", files: tsOnly, exclude, check: nonNullSpam },
  { id: "ts-4", title: "Redundant annotation", files: tsOnly, exclude,
    pattern: /\b(?:const|let)\s+\w+\s*:\s*(?:string|number|boolean)\s*=\s*(?:["'`\d-]|true\b|false\b)/ },
  { id: "ts-7", title: "Deep optional chain", files, exclude, pattern: /(?:\?\.[\w$]+(?:\([^)]*\))?){4,}/ },
  { id: "ts-9", title: "Catch-and-rethrow", files, exclude,
    multiline: /catch\s*\(\s*(\w+)[^)]*\)\s*\{\s*(?:console\.\w+\([^;]*\);?\s*)?throw\s+\1\s*;?\s*\}/ },
  { id: "ts-9", title: "Swallowed error", files, exclude, check: swallowedErrors },
  { id: "ts-10", title: "Async Promise executor", files, exclude, pattern: /new Promise\s*\(\s*async\b/ },
  { id: "ts-11", title: "Verbose boolean", files, exclude,
    pattern: /\?\s*true\s*:\s*false\b|\?\s*false\s*:\s*true\b|\.filter\((?:[^()]|\([^()]*\))*\)\.length\s*(?:>|!==|!=)\s*0/ },
  { id: "ts-11", title: "if-return-true-else-false", files, exclude,
    multiline: /if\s*\([^)]+\)\s*\{?\s*return\s+(?:true|false);?\s*\}?\s*(?:else\s*\{?\s*)?return\s+(?:true|false);?/ },
  { id: "ts-17", title: "Junk-drawer module", files, exclude, check: junkDrawerFile },
  { id: "ts-17", title: "Junk-drawer class", files, exclude,
    pattern: /\b(?:class|interface)\s+\w*(?:Manager|Helpers?|Utils?|Utility|Processor)\b/ },
  { id: "ts-18", title: "Narrating comment", files, exclude,
    pattern: /^\s*\/\/\s*(?:Imports?|Define|Defining|Create|Creating|Initiali[sz]e|Initiali[sz]ing|Set ?up|Returns?|Returning|Call|Calling|Get|Getting|Check if|Loop (?:through|over)|Iterate (?:through|over)|Handle|Handling|Export|Declare|Update|Updating|Fetch|Fetching|Render|Rendering)\b[^.]{0,40}$/i },
  { id: "ts-18", title: "Section banner", files, exclude, pattern: /^\s*(?:\/\/|\/\*+)\s*[=\-*#]{4,}/ },
  { id: "ts-18", title: "JSDoc restating the signature", files, exclude,
    pattern: /@param\s+(?:\{[^}]*\}\s+)?\[?(\w+)\]?\s*-?\s*(?:The|A|An)\s+\1\b\.?\s*$|@returns?\s+(?:\{[^}]*\}\s+)?(?:The result|Returns? the|the return value)\b/i },
  { id: "ts-19", title: "Commented-out code", files, exclude,
    multiline: /(?:^[ \t]*\/\/[ \t]*(?:const |let |var |if ?\(|for ?\(|while ?\(|return\b|import |export |function |await |class |\}|[\w.]+\(.*\);?\s*$|[\w.]+\s*=\s*.+;\s*$)[^\n]*\n){2,}/m },
  { id: "ts-20", title: "Debug residue", files, exclude, pattern: /\bconsole\.(?:log|debug|trace)\(|^\s*debugger\b/,
    filter: (_m, _line, path) => !tooling.test(path) },
  { id: "ts-20", title: "Demo residue", files, exclude,
    pattern: /\bIn a real (?:app|application|implementation|project|world)|for demonstration purposes|simplified (?:version|example|implementation)|throw new Error\(\s*['"`]Not implemented/i },
  { id: "ts-20", title: "TODO without owner or issue", files, exclude,
    pattern: /\/\/\s*(?:TODO|FIXME|XXX|HACK)\b(?!\s*(?:\([\w.@ -]+\)|@\w+))(?!.*(?:#\d+|https?:\/\/|\b[A-Z][A-Z0-9]+-\d+))/ },
];

export default rules.map((rule) => ({ script: true, ...rule }));
