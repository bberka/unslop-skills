// unslop-ignore-file
// Lexical test tells for scan.mjs. Ids match ../TELLS.md.
// Covers JS/TS (Jest, Vitest, Mocha, Playwright, node:test, ava), C# (xUnit, NUnit, MSTest with
// Assert, FluentAssertions, Shouldly, Moq, NSubstitute), Python (pytest, unittest), and Go
// (testing, testify, is).
const files = /(?:^|\/)(?:__tests__|tests?|specs?|e2e)\/.*\.(?:[cm]?[jt]sx?|py|cs|go)$|\.(?:test|spec)\.[cm]?[jt]sx?$|(?:^|\/)test_[^/]*\.py$|_test\.(?:py|go)$|Tests?\.cs$|(?:^|\/)[\w.]*Tests?(?:\.[\w.]+)?\/.*\.cs$/;
const snaps = /\.snap$/;

const langOf = (path) =>
  /\.cs$/.test(path) ? "cs" : /\.go$/.test(path) ? "go" : /\.py$/.test(path) ? "py" : /\.[cm]?[jt]sx?$/.test(path) ? "js" : null;

// Anything that fails a test. Broad on purpose: a match only hides a hit.
const ASSERTS = {
  js: /\bexpect\w*\s*[.(<]|\bassert\w*\s*[.(<]|\.should\b|\bt\.(?:is|not|deepEqual|true|false|throws|notThrows|assert|like|snapshot|regex|pass|fail)\b|\bwaitFor\(|\b(?:get|find)(?:All)?By\w+\(|\.verify\w*\(|\bshould\(|\bsnapshot\(/,
  cs: /\b\w*Assert\.|\.Should\w*[(<]|\bShould\.|\.Verify\w*[(<]|\bExpect\(|\bThrows(?:Async)?\b|\bVerifier\.|\.(?:Received|DidNotReceive)\w*\(|\bAssert\w*\s*[(<]|\b\w*Ensure\w*\(|\bawait\s+Verify/,
  py: /\bassert\b|pytest\.(?:raises|warns|deprecated_call|fail|approx)|self\.assert|\.assert_\w+\(|\bexpect\(/,
  go: /\bassert\.|\brequire\.|\bis\.\w+\(/,
};
// Checks that pass for almost any value (tests-3).
const WEAK = {
  js: /\.toBeDefined\(\)|\.toBeTruthy\(\)|\.not\.toThrow\(\)|\.not\.toBeNull\(\)|\.not\.toBeUndefined\(\)|\.not\.toBeFalsy\(\)|\.resolves\.toBeDefined\(\)|\.rejects\.toBeDefined\(\)/,
  cs: /\bAssert\.(?:NotNull|IsNotNull)\(|\.Should\(\)\.NotBeNull\(\)|\.ShouldNotBeNull\(\)|Assert\.DoesNotThrow\w*\(|\.Should\(\)\.NotThrow\w*\(\)|Should\.NotThrow\w*\(/,
  py: /\bassert\s+[\w.]+\s+is\s+not\s+None\b|^\s*assert\s+[\w.]+\s*(?:#.*)?$/m,
  go: null,
};
// Go helpers take `t` to fail the test; a call that passes it counts as a check.
const goAsserts = (t) => new RegExp(`${ASSERTS.go.source}|\\b${t}\\.(?:Error|Errorf|Fatal|Fatalf|Fail|FailNow|Run)\\b|[(,]\\s*${t}\\s*[,)]`);

const eol = (text, i) => { const n = text.indexOf("\n", i); return n === -1 ? text.length : n; };
const lineAt = (text, index) => text.slice(0, index).split("\n").length;
const commented = (text, index) => /\/\/|^\s*\*|^\s*#/.test(text.slice(text.lastIndexOf("\n", index) + 1, index));

// JS: a `/` starts a regex literal when it follows an operator, a bracket, or a keyword.
function regexAllowed(text, i) {
  let j = i - 1;
  while (j >= 0 && /\s/.test(text[j])) j--;
  if (j < 0) return true;
  if (/[(,=:[!&|?{};+\-*%<>~^]/.test(text[j])) return true;
  const word = /(\w+)$/.exec(text.slice(Math.max(0, j - 10), j + 1))?.[1];
  return /^(?:return|typeof|case|in|of|yield|await|void|delete)$/.test(word ?? "");
}
function regexEnd(text, i) {
  let inClass = false;
  for (; i < text.length && text[i] !== "\n"; i++) {
    const c = text[i];
    if (c === "\\") { i++; continue; }
    if (c === "[") inClass = true;
    else if (c === "]") inClass = false;
    else if (c === "/" && !inClass) return i;
  }
  return i;
}
// Template literal: ends at the closing backtick, with `${ }` holes balanced.
function templateEnd(text, i) {
  for (; i < text.length; i++) {
    const c = text[i];
    if (c === "\\") { i++; continue; }
    if (c === "`") return i;
    if (c === "$" && text[i + 1] === "{") i = blockEnd(text, i + 1, "js") - 1;
  }
  return i;
}

// Index just past the brace that closes the block opened at `open`. Skips comments, strings
// (template literals, C# verbatim and raw strings, Go raw strings) and JS regex literals.
function blockEnd(text, open, lang) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (c === "/" && n === "/") { i = eol(text, i); continue; }
    if (c === "/" && n === "*") { i = text.indexOf("*/", i + 2); if (i === -1) return text.length; i++; continue; }
    if (lang === "cs" && (c === "@" || c === "$") && /^[$@]*"/.test(text.slice(i, i + 3)) && text.slice(i, i + 3).includes("@")) {
      i = text.indexOf('"', i);
      for (i++; i < text.length; i++) { if (text[i] === '"') { if (text[i + 1] === '"') { i++; continue; } break; } }
      continue;
    }
    if (c === '"' && n === '"' && text[i + 2] === '"') { i = text.indexOf('"""', i + 3); if (i === -1) return text.length; i += 2; continue; }
    if (c === "`" && lang === "js") { i = templateEnd(text, i + 1); continue; }
    if (c === "`" && lang === "go") { i = text.indexOf("`", i + 1); if (i === -1) return text.length; continue; }
    if (c === '"' || c === "'") {
      for (i++; i < text.length && text[i] !== c && text[i] !== "\n"; i++) if (text[i] === "\\") i++;
      continue;
    }
    if (c === "/" && lang === "js" && regexAllowed(text, i)) { i = regexEnd(text, i + 1); continue; }
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return i + 1;
  }
  return text.length;
}

// Python: the indented lines under a `def` (whose signature may span lines), and whether the
// def sits inside another def.
function pyBody(lines, i, indent) {
  const body = [];
  let depth = 0, j = i;
  for (; j < lines.length; j++) {
    const code = lines[j].replace(/#.*$/, "");
    depth += (code.match(/[([{]/g) ?? []).length - (code.match(/[)\]}]/g) ?? []).length;
    if (depth <= 0 && /:\s*$/.test(code)) break;
  }
  for (j++; j < lines.length; j++) {
    if (lines[j].trim() && lines[j].search(/\S/) <= indent) break;
    body.push(lines[j]);
  }
  return body.join("\n");
}
function pyNested(lines, i, indent) {
  for (let j = i - 1; j >= 0; j--) {
    const l = lines[j];
    if (!l.trim() || /^\s*[@#)]/.test(l) || l.search(/\S/) >= indent) continue;
    return /^\s*(?:async\s+)?def\b/.test(l);
  }
  return false;
}
const pyFixture = (lines, i) => {
  for (let j = i - 1; j >= 0 && /^\s*@/.test(lines[j]); j--) if (/fixture/.test(lines[j])) return true;
  return false;
};

// Every test in the file: { line, name, body, params }.
function testBlocks(text, path) {
  const lang = langOf(path);
  const blocks = [];
  if (lang === "js") {
    const re = /\b(?:it|test)(?:\.(?:concurrent|sequential|serial|only|skipIf|runIf)(?:\((?:[^()]|\([^()]*\))*\))?)*(?:\.each\((?:[^()]|\([^()]*\))*\))?\s*\(\s*(['"`])((?:(?!\1)[^\\\n]|\\.)*)\1\s*,\s*(?:\{[^{}]*\}\s*,\s*)?(?:async\s*)?(?:function\s*\w*\s*)?(?:\([^)]*\)|\w+)\s*(?:=>)?\s*\{/g;
    const matches = [...text.matchAll(re)].filter((m) => !commented(text, m.index));
    matches.forEach((m, k) => {
      const open = m.index + m[0].length - 1;
      const end = Math.min(blockEnd(text, open, "js"), matches[k + 1]?.index ?? text.length);
      blocks.push({ line: lineAt(text, m.index), name: m[2], body: text.slice(open, end) });
    });
  } else if (lang === "cs") {
    const attr = /^[ \t]*\[(?:Fact|Theory|Test|TestCase|TestCaseSource|TestMethod|DataTestMethod)\b[^\]]*\]/gm;
    const header = /\b(\w+)\s*\([^)]*\)\s*(?:where\s+[^{=]+)?(\{|=>)/g;
    const seen = new Set();
    for (const a of text.matchAll(attr)) {
      if (commented(text, a.index + a[0].search(/\S/))) continue;
      header.lastIndex = a.index + a[0].length;
      const h = header.exec(text);
      if (!h || seen.has(h.index)) continue;
      seen.add(h.index);
      const open = h.index + h[0].length - 1;
      const body = h[2] === "{" ? text.slice(open, blockEnd(text, open, "cs")) : text.slice(open, eol(text, text.indexOf(";", open)));
      blocks.push({ line: lineAt(text, h.index), name: h[1], body });
    }
  } else if (lang === "go") {
    for (const m of text.matchAll(/^func\s+(Test\w*)\s*\(\s*(\w+)\s+\*testing\.T\s*\)\s*\{/gm)) {
      const open = m.index + m[0].length - 1;
      blocks.push({ line: lineAt(text, m.index), name: m[1], body: text.slice(open, blockEnd(text, open, "go")), params: m[2] });
    }
  } else if (lang === "py") {
    const lines = text.split("\n");
    lines.forEach((l, i) => {
      const m = /^(\s*)(?:async\s+)?def\s+(test\w*)\s*\(/.exec(l);
      if (!m) return;
      const indent = m[1].length;
      if (pyNested(lines, i, indent) || pyFixture(lines, i)) return;
      blocks.push({ line: i + 1, name: m[2], body: pyBody(lines, i, indent) });
    });
  }
  return blocks;
}

// Names of functions defined in this file whose body asserts, so calling them counts as a check.
function assertingHelpers(text, path) {
  const lang = langOf(path);
  const defs = [];
  if (lang === "js") {
    for (const m of text.matchAll(/\b(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*\{|\b(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*=>\s*\{/g)) {
      const open = m.index + m[0].length - 1;
      defs.push({ name: m[1] ?? m[2], body: text.slice(open, blockEnd(text, open, "js")) });
    }
  } else if (lang === "cs") {
    for (const m of text.matchAll(/\b(?!return\b|new\b|else\b|await\b|throw\b)[\w<>\[\],?.]+\s+(\w+)\s*\([^)]*\)\s*(?:where\s+[^{=]+)?\{/g)) {
      if (/^(?:if|for|foreach|while|switch|using|lock|catch|fixed)$/.test(m[1])) continue;
      const open = m.index + m[0].length - 1;
      defs.push({ name: m[1], body: text.slice(open, blockEnd(text, open, "cs")) });
    }
  } else if (lang === "go") {
    for (const m of text.matchAll(/^func\s+(?:\([^)]*\)\s*)?(\w+)\s*\(([^)]*)\)[^{\n]*\{/gm)) {
      const open = m.index + m[0].length - 1;
      const t = /(\w+)\s+(?:\*testing\.T|testing\.TB)/.exec(m[2])?.[1] ?? "t";
      defs.push({ name: m[1], body: text.slice(open, blockEnd(text, open, "go")), t });
    }
  } else if (lang === "py") {
    const lines = text.split("\n");
    lines.forEach((l, i) => {
      const m = /^(\s*)(?:async\s+)?def\s+(\w+)\s*\(/.exec(l);
      if (m) defs.push({ name: m[2], body: pyBody(lines, i, m[1].length) });
    });
  }
  const helpers = new Set();
  const asserts = (d) => (lang === "go" ? goAsserts(d.t ?? "t") : ASSERTS[lang]).test(d.body) || callsHelper(d.body, helpers);
  for (let pass = 0; pass < 3; pass++) for (const d of defs) if (!helpers.has(d.name) && asserts(d)) helpers.add(d.name);
  return helpers;
}
const callsHelper = (body, helpers) => helpers.size > 0 && new RegExp(`\\b(?:${[...helpers].join("|")})\\s*[(<]`).test(body);

function checks(text, path) {
  const lang = langOf(path);
  const helpers = assertingHelpers(text, path);
  return testBlocks(text, path).map((b) => {
    const re = lang === "go" ? goAsserts(b.params ?? "t") : ASSERTS[lang];
    const lines = b.body.split("\n");
    const strong = lines.filter((l) => (re.test(l) && !(WEAK[lang] && WEAK[lang].test(l))) || callsHelper(l, helpers)).length;
    const weak = WEAK[lang] ? lines.filter((l) => WEAK[lang].test(l)).length : 0;
    return { ...b, strong, weak };
  });
}
const noAssertion = (text, path) =>
  checks(text, path).filter((b) => b.strong + b.weak === 0).map((b) => ({ line: b.line, match: b.name }));
const weakOnly = (text, path) =>
  checks(text, path).filter((b) => b.strong === 0 && b.weak > 0).map((b) => ({ line: b.line, match: b.name }));

// try/catch in JS tests: a catch that asserts (or swallows) hides the case where nothing threw,
// unless the try block itself fails on fall-through (`throw`, `fail()`, `expect.assertions`).
function catchHidesFailure(text, path) {
  const hits = [];
  const blocks = testBlocks(text, path);
  for (const m of text.matchAll(/\btry\s*\{/g)) {
    if (commented(text, m.index)) continue;
    const open = m.index + m[0].length - 1;
    const end = blockEnd(text, open, "js");
    const after = /^\s*catch\s*(?:\([^)]*\))?\s*\{/.exec(text.slice(end));
    if (!after) continue;
    const tryBody = text.slice(open, end);
    const test = blocks.find((b) => b.line <= lineAt(text, m.index) && lineAt(text, m.index) < b.line + b.body.split("\n").length);
    if (/\bthrow\b|\bfail\(|\.fail\(/.test(tryBody) || /expect\.(?:assertions|hasAssertions)\(/.test(test?.body ?? "")) continue;
    const cOpen = end + after[0].length - 1;
    const catchBody = text.slice(cOpen, blockEnd(text, cOpen, "js"));
    if (/\bexpect\w*\s*[.(]|\bassert\b/.test(catchBody) || /^\{\s*\}$/.test(catchBody)) {
      hits.push({ line: lineAt(text, cOpen), match: after[0].trim() });
    }
  }
  return hits;
}

function snapshotSprawl(text, path) {
  if (snaps.test(path)) {
    const n = text.split("\n").length;
    return n > 200 ? [{ line: 1, match: `${n}-line snapshot file` }] : [];
  }
  const hits = [];
  const external = (text.match(/toMatch(?:File)?Snapshot\(/g) ?? []).length;
  const inline = (text.match(/toMatchInlineSnapshot\(/g) ?? []).length;
  if (external > 5) hits.push({ line: 1, match: `${external} file snapshots` });
  if (inline > 25) hits.push({ line: 1, match: `${inline} inline snapshots` });
  return hits;
}

// One hit per file for Arrange/Act/Assert comments (a convention to judge once), one per console.log.
function narration(text) {
  const hits = [];
  const aaa = [];
  text.split("\n").forEach((l, i) => {
    if (/^\s*(?:\/\/|#)\s*(?:Arrange|Act|Assert)\s*$/i.test(l)) aaa.push(i + 1);
    if (/\bconsole\.log\(/.test(l)) hits.push({ line: i + 1, match: "console.log(" });
  });
  if (aaa.length) hits.unshift({ line: aaa[0], match: `${aaa.length} Arrange/Act/Assert comments` });
  return hits;
}

export default [
  { id: "tests-1", title: "Tautology", files,
    pattern: /expect\(\s*(true|false|null|undefined|\d+|'[^']*'|"[^"]*")\s*\)\.(?:toBe|toEqual|toStrictEqual)\(\s*\1\s*\)|expect\(\s*([\w.]+)\s*\)\.(?:toBe|toEqual|toStrictEqual)\(\s*\2\s*\)|Assert\.(?:True|IsTrue)\(\s*true\s*\)|Assert\.(?:False|IsFalse)\(\s*false\s*\)|Assert\.(?:Equal|AreEqual|Same)\(\s*([\w.]+)\s*,\s*\3\s*\)|^\s*assert\s+True\b|\bassert\s+([\w.]+)\s*==\s*\4\s*$/ },
  { id: "tests-2", title: "No assertion", files, check: noAssertion },
  { id: "tests-3", title: "Weak assertion only", files, check: weakOnly },
  { id: "tests-4", title: "Mock echo", files,
    multiline: /mock(?:Resolved|Returned)?(?:Return)?Value(?:Once)?\(\s*([^()\n]+?)\s*\)[\s\S]{0,400}?\.(?:toBe|toEqual|toStrictEqual)\(\s*\1\s*\)|\.Returns(?:Async)?\(\s*([^()\n]+?)\s*\)[\s\S]{0,400}?Assert\.(?:Equal|AreEqual|Same)\(\s*\2\s*,|return_value\s*=\s*([^\n]+?)\s*\n[\s\S]{0,400}?assert\s+[\w.]+(?:\([^)]*\))?\s*==\s*\3\b/ },
  { id: "tests-7", title: "Private access", files,
    pattern: /\(\s*\w+\s+as\s+any\s*\)\.\w+|\[\s*['"]_(?!_proto__)\w+['"]\s*\]|BindingFlags\.NonPublic|\w\._[a-z]\w*\s*\(/ },
  { id: "tests-8", title: "Sleep or fixed wait", files,
    pattern: /\bsetTimeout\((?![^)]*,\s*0\s*\))|\b(?:time\.|asyncio\.)?sleep\(\s*(?!0\s*\))|Thread\.Sleep\(|Task\.Delay\(\s*\d|waitForTimeout\(|cy\.wait\(\s*\d|time\.Sleep\(/ },
  { id: "tests-8", title: "Real clock", files,
    pattern: /\bnew Date\(\)|\bDate\.now\(\)|DateTime(?:Offset)?\.(?:Now|UtcNow)\b|datetime\.(?:now|utcnow)\(|time\.Now\(\)/ },
  { id: "tests-9", title: "Snapshot sprawl", files: new RegExp(`${files.source}|${snaps.source}`), check: snapshotSprawl },
  { id: "tests-11", title: "Skipped test", files,
    pattern: /\b(?:it|test|describe)\.(?:skip|fixme)\(|\bx(?:it|test|describe)\(|\[(?:Fact|Theory)\([^)]*Skip\s*=|\[(?:Ignore|Explicit)\b|@pytest\.mark\.skip\b|@unittest\.skip|\bt\.Skipf?\(/,
    filter: (_m, line) => !/#\d+|https?:\/\/|\b[A-Z][A-Z0-9]+-\d+/.test(line) },
  { id: "tests-11", title: "Focused test", files, pattern: /\b(?:it|test|describe)\.only\(|\bf(?:it|describe)\(/ },
  { id: "tests-12", title: "Commented-out test", files,
    pattern: /^\s*\/\/\s*(?:it|test|describe)(?:\.\w+)?\(|^\s*#\s*def test_|^\s*\/\/\s*\[(?:Fact|Theory|Test|TestMethod)\]/ },
  { id: "tests-13", title: "Name doesn't state behavior", files,
    pattern: /\b(?:it|test)\(\s*['"`](?:works|it works|should work|test\s*\d*|basic test|handles edge cases|renders(?: correctly| properly| without crashing)?|does stuff|todo)['"`]|\bvoid\s+(?:Test_?\d*|TestMethod\d+|Works|ShouldWork)\s*\(|def test_?(?:\d+|works|it_works|basic|something)\s*\(/i },
  { id: "tests-15", title: "try/catch hiding a failure", files, exclude: /\.(?:py|cs|go)$/, check: catchHidesFailure },
  { id: "tests-16", title: "Narration", files, check: narration },
];
