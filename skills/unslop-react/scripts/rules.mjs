// unslop-ignore-file
// Lexical React tells for scan.mjs. Ids match ../TELLS.md.
const files = /\.(?:jsx|tsx)$/i;
const hooksFiles = /\.(?:[cm]?[jt]sx?)$/i;
const exclude = /\.(?:test|spec|e2e|e2e-spec|stories)\.[cm]?[jt]sx?$|(?:^|\/)(?:__tests__|__mocks__|__fixtures__|e2e|playwright|cypress)\//;

// Top-level component declarations, used to judge each component on its own
// instead of the whole file (one 600-line file of twenty demos is not a god component).
const DECL = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+[A-Z]\w*\s*[(<]|^(?:export\s+)?const\s+[A-Z]\w*\s*(?::[^=]+)?=|^(?:export\s+)?(?:default\s+)?class\s+[A-Z]\w*\s+extends\b/;
const BOUNDARY = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:const|let|var|function|class|type|interface|enum|namespace|declare)\b|^export\s*[{*]/;
function segments(text) {
  const lines = text.split("\n");
  const starts = [];
  lines.forEach((l, i) => { if (DECL.test(l)) starts.push(i); });
  return starts.map((s, k) => {
    let end = k + 1 < starts.length ? starts[k + 1] : lines.length;
    for (let i = s + 1; i < end; i++) if (BOUNDARY.test(lines[i])) { end = i; break; }
    return { line: s + 1, lines: lines.slice(s, end) };
  });
}

function booleanSoup(text) {
  const hits = [];
  for (const seg of segments(text)) {
    const bools = seg.lines.map((l, i) => (/useState(?:<boolean>)?\(\s*(?:true|false)\s*\)/.test(l) ? seg.line + i : 0)).filter(Boolean);
    if (bools.length >= 3) hits.push({ line: bools[0], match: `${bools.length} boolean useState calls in one component` });
  }
  return hits;
}

function godComponent(text) {
  const hits = [];
  for (const seg of segments(text)) {
    const states = seg.lines.filter((l) => /\buseState\b\s*[(<]/.test(l)).length;
    if (seg.lines.length > 300 || states >= 6) hits.push({ line: seg.line, match: `${seg.lines.length} lines, ${states} useState` });
  }
  return hits;
}

// A capitalized function or arrow declared with indentation, unless it is the
// render function handed to forwardRef, memo, or a similar wrapper.
const nested = /^[ \t]{2,}(?:const\s+[A-Z]\w*\s*=\s*(?:\([^)]*\)|[a-z_]\w*)\s*=>|function\s+[A-Z]\w*\s*\()/;
const wrapperCall = /(?:forwardRef|memo|lazy|observer|styled\w*|with[A-Z]\w*)\s*(?:<[^\n]*>)?\(\s*$/;
function nestedComponent(text) {
  const lines = text.split("\n");
  const hits = [];
  lines.forEach((l, i) => {
    if (!nested.test(l)) return;
    let p = i - 1;
    while (p >= 0 && lines[p].trim() === "") p--;
    if (p >= 0 && wrapperCall.test(lines[p])) return;
    hits.push({ line: i + 1, match: l.trim().slice(0, 60) });
  });
  return hits;
}

// Index keys are fine on static lists; a skeleton row or Array.from(...) has nothing to reorder.
const indexKey = /\bkey=\{\s*(?:index|idx|i)\s*\}|\bkey=\{`[^`]*\$\{\s*(?:index|idx|i)\s*\}[^`]*`\}/;
const staticList = /Array\.from\(|new Array\(|\[\.\.\.Array\(|\.fill\(|skeleton/i;
function indexKeys(text) {
  const lines = text.split("\n");
  const hits = [];
  lines.forEach((l, i) => {
    const m = indexKey.exec(l);
    if (!m) return;
    if (lines.slice(Math.max(0, i - 3), i + 1).some((x) => staticList.test(x))) return;
    hits.push({ line: i + 1, match: m[0] });
  });
  return hits;
}

export default [
  { id: "react-1", title: "Effect that only sets state", files: hooksFiles, exclude,
    multiline: /useEffect\(\s*\(\)\s*=>\s*\{?\s*set[A-Z]\w*\([^;{}]*\)\s*;?\s*\}?\s*,\s*\[[^\]]*\]\s*\)/ },
  { id: "react-2", title: "Prop copied into state", files: hooksFiles, exclude,
    pattern: /useState(?:<[^>]*>)?\(\s*props\.\w+/ },
  { id: "react-4", title: "fetch inside useEffect", files: hooksFiles, exclude,
    multiline: /useEffect\(\s*(?:async\s*)?\(\)\s*=>\s*\{(?:(?!useEffect)[\s\S]){0,300}?\bfetch\(/ },
  { id: "react-5", title: "Boolean soup", files: hooksFiles, exclude, check: booleanSoup },
  { id: "react-7", title: "Silenced exhaustive-deps", files: hooksFiles, exclude,
    pattern: /eslint-disable(?:-next-line|-line)?\s+react-hooks\/exhaustive-deps/ },
  { id: "react-8", title: "Memoized trivial value", files: hooksFiles, exclude,
    pattern: /useMemo\(\s*\(\)\s*=>\s*(?:[\w.]+|["'`][^"'`]*["'`]|\d+|true|false)\s*,\s*\[/ },
  { id: "react-10", title: "God component", files, exclude, check: godComponent },
  { id: "react-11", title: "Component defined inside a component", files, exclude, check: nestedComponent },
  { id: "react-12", title: "Fragment around one child", files, exclude,
    multiline: /<>\s*<[\w.]+\b[^>]*\/>\s*<\/>/ },
  { id: "react-17", title: "Index as key", files, exclude, check: indexKeys },
  { id: "react-18", title: "Redundant handler arrow", files, exclude,
    pattern: /\bon[A-Z]\w*=\{\s*\(\)\s*=>\s*[\w.]*\b(?:handle|on)[A-Z]\w*\(\)\s*\}/ },
  { id: "react-19", title: "Hand-assembled className", files, exclude, pattern: /className=\{`[^`]*\$\{[^}]*\?/ },
  { id: "react-20", title: "length && renders 0", files, exclude, pattern: /\{\s*[\w.?]+\.length\s*&&/ },
];
