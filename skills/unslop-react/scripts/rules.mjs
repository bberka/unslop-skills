// unslop-ignore-file
// Lexical React tells for scan.mjs. Ids match ../TELLS.md.
const files = /\.(?:jsx|tsx)$/i;
const hooksFiles = /\.(?:[cm]?[jt]sx?)$/i;
const exclude = /\.(?:test|spec|stories)\.[cm]?[jt]sx?$|(?:^|\/)(?:__tests__|__mocks__)\//;

function booleanSoup(text) {
  const lines = text.split("\n");
  const hits = lines.map((l, i) => (/useState(?:<boolean>)?\(\s*(?:true|false)\s*\)/.test(l) ? i + 1 : 0)).filter(Boolean);
  return hits.length >= 3 ? [{ line: hits[0], match: `${hits.length} boolean useState calls` }] : [];
}

function godComponent(text) {
  const lines = text.split("\n");
  const states = lines.filter((l) => /\buseState\b\s*[(<]/.test(l)).length;
  if (lines.length > 300 || states >= 6) {
    return [{ line: 1, match: `${lines.length} lines, ${states} useState` }];
  }
  return [];
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
  { id: "react-10", title: "Large component file", files, exclude, check: godComponent },
  { id: "react-11", title: "Component defined inside a component", files, exclude,
    pattern: /^[ \t]{2,}(?:const\s+[A-Z]\w*\s*=\s*(?:\([^)]*\)|[a-z_]\w*)\s*=>|function\s+[A-Z]\w*\s*\()/ },
  { id: "react-12", title: "Fragment around one child", files, exclude,
    multiline: /<>\s*<[\w.]+\b[^>]*\/>\s*<\/>/ },
  { id: "react-17", title: "Index as key", files, exclude,
    pattern: /\bkey=\{\s*(?:index|idx|i)\s*\}|\bkey=\{`[^`]*\$\{\s*(?:index|idx|i)\s*\}[^`]*`\}/ },
  { id: "react-18", title: "Redundant handler arrow", files, exclude,
    pattern: /\bon[A-Z]\w*=\{\s*\(\)\s*=>\s*[\w.]+\(\)\s*\}/ },
  { id: "react-19", title: "Hand-assembled className", files, exclude, pattern: /className=\{`[^`]*\$\{[^}]*\?/ },
  { id: "react-20", title: "length && renders 0", files, exclude, pattern: /\{\s*[\w.?]+\.length\s*&&/ },
];
