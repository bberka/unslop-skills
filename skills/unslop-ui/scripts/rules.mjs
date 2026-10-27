// unslop-ignore-file
// Lexical UI tells for scan.mjs. Ids match ../TELLS.md.
const files = /\.(?:css|scss|sass|less|html?|jsx|tsx|vue|svelte|astro|razor|cshtml)$/i;
const markup = /\.(?:html?|jsx|tsx|vue|svelte|astro|razor|cshtml)$/i;
const exclude = /\.(?:test|spec|e2e|stories)\.|(?:^|\/)(?:__tests__|__mocks__|__fixtures__|e2e|playwright|cypress)\//;
// Static assets under public/ are usually vendored (icon indexes, third-party pages).
const vendoredHtml = /(?:^|\/)public\/.*\.html?$/i;

// One hit per file with the count: the list of values lives in tokens.mjs.
function perFile(re, label) {
  return (text) => {
    const lines = text.split("\n");
    let first = null;
    let n = 0;
    lines.forEach((l, i) => {
      for (const m of l.matchAll(re)) { n++; first ??= { line: i + 1, match: m[0] }; }
    });
    return n ? [{ line: first.line, match: n === 1 ? first.match : `${n} ${label} in this file, e.g. ${first.match}` }] : [];
  };
}

function reducedMotion(text) {
  if (/prefers-reduced-motion|useReducedMotion|motion-reduce:|motion-safe:|MotionConfig[^>]*reducedMotion/.test(text)) return [];
  const lines = text.split("\n");
  const i = lines.findIndex((l) => /@keyframes|\banimation\s*:|from ['"](?:framer-motion|motion\/react)['"]|\banimate-(?!spin\b)\w+\b/.test(l));
  return i === -1 ? [] : [{ line: i + 1, match: lines[i].trim() }];
}

// outline-none (outline-hidden in Tailwind v4) is fine when a visible focus state sits
// in the same class list, which in a cn(...) call often spans several lines. Menu items
// show focus through data-highlighted or data-focus states instead of a ring.
const outlineRemoved = /\b(?:focus:)?outline-(?:none|hidden)\b|outline:\s*(?:none|0)\b/;
const focusReplacement = /focus-visible|focus:ring|:focus-visible|focus:outline-(?!none|hidden)|focus:border|focus:bg|focus-within:|data-\[?(?:highlighted|focus|focus-visible|active)\]?:|aria-selected:/;
function focusRemoved(text) {
  const lines = text.split("\n");
  const hits = [];
  lines.forEach((l, i) => {
    const m = outlineRemoved.exec(l);
    if (!m) return;
    if (lines.slice(Math.max(0, i - 8), i + 9).some((x) => focusReplacement.test(x))) return;
    hits.push({ line: i + 1, match: m[0] });
  });
  return hits;
}

// Compiled Tailwind output is build output, not the UI source these tells judge.
const compiled = (text) => /^\/\*! tailwindcss v/.test(text);

const rules = [
  { id: "ui-1", title: "Default gradient", files, exclude,
    pattern: /\b(?:bg-gradient-to-[trbl]{1,2}|bg-linear-to-[trbl]{1,2})\b[^"'`\n]*?\bfrom-(?:purple|violet|indigo|fuchsia|pink)-\d{2,3}/ },
  { id: "ui-1", title: "Gradient text", files, exclude,
    pattern: /\bbg-clip-text\b|(?:-webkit-)?background-clip:\s*text/ },
  { id: "ui-5", title: "Glass or glow", files, exclude,
    pattern: /\bbackdrop-blur(?:-\w+)?\b|backdrop-filter:\s*blur|\bblur-(?:2xl|3xl)\b|\bblur-\[\d{2,}px\]|shadow-\[0_0_\d+px|box-shadow:\s*0 0 \d{2,}px/ },
  { id: "ui-6", title: "Stock icon as content", files, exclude,
    pattern: /\bimport\s*\{[^}]*\b(?:Sparkles?|Zap|Rocket|ShieldCheck|Wand2?|Bolt|Lightning)\b[^}]*\}\s*from\s*['"](?:lucide-react|@heroicons|react-icons|@tabler|@phosphor|phosphor-react)/ },
  { id: "ui-6", title: "Emoji in UI", files: markup, exclude,
    check: perFile(/(?![©®™])\p{Extended_Pictographic}/gu, "emoji") },
  { id: "ui-7", title: "ALL-CAPS eyebrow", files, exclude,
    pattern: /\buppercase\b[^"'`\n]*\btracking-(?:wide|wider|widest|\[)|\btracking-(?:wider|widest)\b[^"'`\n]*\buppercase\b/ },
  { id: "ui-7", title: "Template chrome", files: markup, exclude,
    pattern: /\s·\s|→\s*(?:<\/|['"`])/ },
  { id: "ui-8", title: "Fabricated proof", files: markup, exclude,
    pattern: /\b\d+(?:[.,]\d+)?[kKmM]?\+\s*(?:users|customers|developers|teams|companies|downloads|businesses|happy)\b|\b99\.9+%|\b(?:Trusted by|Loved by|Join) (?:thousands|millions|over|\d)/i },
  { id: "ui-11", title: "Motion everywhere", files, exclude,
    pattern: /\banimate-(?:pulse|bounce|ping)\b|\bhover:(?:scale-\d+|-translate-y-\d+)\b|\btransition-all\b|initial=\{\{\s*opacity:\s*0,\s*y:/,
    filter: (m, line, path) => !(m === "animate-pulse" && /skeleton|loading|loader/i.test(line + " " + path)) },
  { id: "ui-13", title: "Arbitrary values", files, exclude,
    check: perFile(/\b[a-z][\w-]*-\[(?:-?\d*\.?\d+(?:px|rem|em|%|vh|vw)|#[0-9a-fA-F]{3,8})\]/g, "arbitrary values") },
  { id: "ui-15", title: "Low-contrast text", files, exclude,
    pattern: /(?<!dark:)\b(?:text|placeholder)-(?:gray|slate|zinc|neutral|stone)-(?:300|400)\b/ },
  { id: "ui-16", title: "Focus outline removed", files, exclude, check: focusRemoved },
  { id: "ui-17", title: "Clickable non-button", files: markup, exclude,
    pattern: /<(?:div|span|li|td)\b[^>]*\bonClick=/ },
  { id: "ui-17", title: "Image without alt", files: markup, exclude,
    multiline: /<img\b(?![^>]*\balt=)[^>]*>/, filter: (_m, _line, path) => !vendoredHtml.test(path) },
  { id: "ui-19", title: "Animation without reduced-motion path", files, exclude, check: reducedMotion },
  { id: "ui-20", title: "Copy slop", files: markup, exclude,
    pattern: /\b(?:Unlock|Supercharge|Unleash|Elevate|Revolutioni[sz]e|Seamless(?:ly)?|Effortless(?:ly)?|Next[- ]gen(?:eration)?|Game[- ]chang(?:er|ing)|Cutting[- ]edge|Oops|Something went wrong|Learn more|Get started(?: today| now| for free)?)\b/i },
  { id: "ui-21", title: "Placeholder residue", files: markup, exclude,
    pattern: /\blorem ipsum\b|\b(?:John|Jane) Doe\b|\bexample\.com\b|\bAcme(?: Inc| Corp)?\b|\bFeature (?:One|Two|Three|[123])\b|placehold\.co|via\.placeholder\.com|picsum\.photos/i,
    filter: (m, line) => !(/example\.com/i.test(m) && /placeholder=/.test(line)) },
];

export default rules.map((rule) => ({ skipFile: compiled, ...rule }));
