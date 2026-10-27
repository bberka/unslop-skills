// unslop-ignore-file
// Lexical test tells for scan.mjs. Ids match ../TELLS.md.
// Covers JS/TS (Jest, Vitest, Mocha, Playwright), C# (xUnit, NUnit, MSTest), Python (pytest, unittest), and Go.
const files = /(?:^|\/)(?:__tests__|tests?|specs?|e2e)\/.*\.(?:[cm]?[jt]sx?|py|cs|go)$|\.(?:test|spec)\.[cm]?[jt]sx?$|(?:^|\/)test_[^/]*\.py$|_test\.(?:py|go)$|Tests?\.cs$|(?:^|\/)[\w.]*Tests?(?:\.[\w.]+)?\/.*\.cs$/;
const js = /\.[cm]?[jt]sx?$/;
const snaps = /\.snap$/;

const ASSERTS = {
  js: /\bexpect(?:Type)?(?:Of)?\s*[.(]|\bassert\b|\.should\b|\bt\.(?:is|not|deepEqual|true|false|throws|assert)\b|\bwaitFor\(|\b(?:get|find)(?:All)?By\w+\(|\.verify\w*\(|\bexpectTypeOf\b/,
  cs: /\bAssert\.|\.Should\(|\bShould\.|\.Verify\w*\(|\bExpect\(|\bThrows(?:Async)?\b|\bVerifier\./,
  py: /\bassert\b|pytest\.raises|self\.assert|\.assert_\w+\(|pytest\.fail/,
  go: /\bt\.(?:Error|Errorf|Fatal|Fatalf|Fail|FailNow)\b|\bassert\.|\brequire\./,
};

// Index just past the brace that closes the block opened at `open`; skips strings and comments.
function blockEnd(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === "/" && text[i + 1] === "/") { i = text.indexOf("\n", i); if (i === -1) return text.length; continue; }
    if (c === "/" && text[i + 1] === "*") { i = text.indexOf("*/", i + 2); if (i === -1) return text.length; i++; continue; }
    if (c === '"' || c === "'" || c === "`") {
      for (i++; i < text.length && text[i] !== c; i++) if (text[i] === "\\") i++;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return i + 1;
  }
  return text.length;
}

const lineAt = (text, index) => text.slice(0, index).split("\n").length;

function noAssertion(text, path) {
  const hits = [];
  const report = (index, name) => hits.push({ line: lineAt(text, index), match: name });
  if (js.test(path)) {
    const re = /\b(?:it|test)(?:\.each\([\s\S]*?\))?\s*\(\s*(['"`])((?:(?!\1).)*)\1\s*,\s*(?:async\s*)?(?:function\s*\w*\s*)?\([^)]*\)\s*(?:=>)?\s*\{/g;
    for (const m of text.matchAll(re)) {
      const open = m.index + m[0].length - 1;
      if (!ASSERTS.js.test(text.slice(open, blockEnd(text, open)))) report(m.index, m[2]);
    }
  } else if (/\.cs$/.test(path)) {
    const re = /\[(?:Fact|Theory|Test|TestCase|TestMethod|DataTestMethod)\b[^\]]*\][\s\S]*?\b(\w+)\s*\([^)]*\)\s*\{/g;
    for (const m of text.matchAll(re)) {
      const open = m.index + m[0].length - 1;
      if (!ASSERTS.cs.test(text.slice(open, blockEnd(text, open)))) report(m.index, m[1]);
    }
  } else if (/\.go$/.test(path)) {
    const re = /func\s+(Test\w+)\s*\(\s*t\s+\*testing\.T\s*\)\s*\{/g;
    for (const m of text.matchAll(re)) {
      const open = m.index + m[0].length - 1;
      const body = text.slice(open, blockEnd(text, open));
      if (!ASSERTS.go.test(body) && !/\bt\.Run\(/.test(body)) report(m.index, m[1]);
    }
  } else if (/\.py$/.test(path)) {
    const lines = text.split("\n");
    lines.forEach((l, i) => {
      const m = /^(\s*)(?:async\s+)?def\s+(test\w*)\s*\(/.exec(l);
      if (!m) return;
      const indent = m[1].length;
      const body = [];
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim() && lines[j].search(/\S/) <= indent) break;
        body.push(lines[j]);
      }
      if (!ASSERTS.py.test(body.join("\n"))) hits.push({ line: i + 1, match: m[2] });
    });
  }
  return hits;
}

function catchHidesFailure(text) {
  if (/expect\.(?:assertions|hasAssertions)\(/.test(text)) return [];
  const hits = [];
  for (const m of text.matchAll(/\bcatch\s*(?:\([^)]*\))?\s*\{/g)) {
    const open = m.index + m[0].length - 1;
    const body = text.slice(open, blockEnd(text, open));
    if (/\bexpect\(|\bAssert\.|\bassert\b/.test(body) || /^\{\s*\}$/.test(body)) {
      hits.push({ line: lineAt(text, m.index), match: m[0] });
    }
  }
  return hits;
}

function snapshotSprawl(text, path) {
  if (snaps.test(path)) {
    const n = text.split("\n").length;
    return n > 200 ? [{ line: 1, match: `${n}-line snapshot file` }] : [];
  }
  const count = (text.match(/toMatch(?:Inline)?Snapshot\(/g) ?? []).length;
  return count > 5 ? [{ line: 1, match: `${count} snapshot assertions` }] : [];
}

export default [
  { id: "tests-1", title: "Tautology", files,
    pattern: /expect\(\s*(true|false|null|undefined|\d+|'[^']*'|"[^"]*")\s*\)\.(?:toBe|toEqual|toStrictEqual)\(\s*\1\s*\)|expect\(\s*([\w.]+)\s*\)\.(?:toBe|toEqual|toStrictEqual)\(\s*\2\s*\)|Assert\.(?:True|IsTrue)\(\s*true\s*\)|Assert\.(?:False|IsFalse)\(\s*false\s*\)|Assert\.(?:Equal|AreEqual|Same)\(\s*([\w.]+)\s*,\s*\3\s*\)|^\s*assert\s+True\b|\bassert\s+([\w.]+)\s*==\s*\4\s*$/ },
  { id: "tests-2", title: "No assertion", files, check: noAssertion },
  { id: "tests-3", title: "Weak assertion", files,
    pattern: /\.toBeDefined\(\)|\.toBeTruthy\(\)|\.not\.toThrow\(\)|\.not\.toBeNull\(\)|\.not\.toBeUndefined\(\)|Assert\.(?:NotNull|IsNotNull)\(|\.Should\(\)\.NotBeNull\(\)|\bassert\s+\w+\s+is\s+not\s+None\b/ },
  { id: "tests-4", title: "Mock echo", files,
    multiline: /mock(?:Resolved|Returned)?(?:Return)?Value(?:Once)?\(\s*([^()\n]+?)\s*\)[\s\S]{0,400}?\.(?:toBe|toEqual|toStrictEqual)\(\s*\1\s*\)|\.Returns(?:Async)?\(\s*([^()\n]+?)\s*\)[\s\S]{0,400}?Assert\.(?:Equal|AreEqual|Same)\(\s*\2\s*,|return_value\s*=\s*([^\n]+?)\s*\n[\s\S]{0,400}?assert\s+[\w.]+(?:\([^)]*\))?\s*==\s*\3\b/ },
  { id: "tests-7", title: "Private access", files,
    pattern: /\(\s*\w+\s+as\s+any\s*\)\.\w+|\[\s*['"]_\w+['"]\s*\]|BindingFlags\.NonPublic|\w\._[a-z]\w*\s*\(/ },
  { id: "tests-8", title: "Sleep or fixed wait", files,
    pattern: /\bsetTimeout\(|\bsleep\(|Thread\.Sleep\(|Task\.Delay\(\s*\d|time\.sleep\(|waitForTimeout\(|cy\.wait\(\s*\d|time\.Sleep\(/ },
  { id: "tests-8", title: "Real clock", files,
    pattern: /\bnew Date\(\)|\bDate\.now\(\)|DateTime(?:Offset)?\.(?:Now|UtcNow)\b|datetime\.(?:now|utcnow)\(|time\.Now\(\)/ },
  { id: "tests-9", title: "Snapshot sprawl", files: new RegExp(`${files.source}|${snaps.source}`), check: snapshotSprawl },
  { id: "tests-11", title: "Skipped test", files,
    pattern: /\b(?:it|test|describe)\.skip\(|\bx(?:it|test|describe)\(|\[(?:Fact|Theory)\([^)]*Skip\s*=|\[Ignore\b|@pytest\.mark\.skip|@unittest\.skip|\bt\.Skip\(/,
    filter: (_m, line) => !/#\d+|https?:\/\/|\b[A-Z][A-Z0-9]+-\d+/.test(line) },
  { id: "tests-11", title: "Focused test", files, pattern: /\b(?:it|test|describe)\.only\(|\bf(?:it|describe)\(/ },
  { id: "tests-12", title: "Commented-out test", files,
    pattern: /^\s*\/\/\s*(?:it|test|describe)(?:\.\w+)?\(|^\s*#\s*def test_|^\s*\/\/\s*\[(?:Fact|Theory|Test|TestMethod)\]/ },
  { id: "tests-13", title: "Name doesn't state behavior", files,
    pattern: /\b(?:it|test)\(\s*['"`](?:works|it works|should work|test\s*\d*|basic test|handles edge cases|renders(?: correctly| properly| without crashing)?|does stuff|todo)['"`]|\bvoid\s+(?:Test_?\d*|TestMethod\d+|Works|ShouldWork)\s*\(|def test_?(?:\d+|works|it_works|basic|something)\s*\(/i },
  { id: "tests-15", title: "try/catch hiding a failure", files, exclude: /\.(?:py|cs|go)$/, check: catchHidesFailure },
  { id: "tests-16", title: "Narration", files, pattern: /^\s*\/\/\s*(?:Arrange|Act|Assert)\s*$|\bconsole\.log\(/ },
];
