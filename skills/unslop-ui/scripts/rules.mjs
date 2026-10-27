// unslop-ignore-file
// Lexical UI tells for scan.mjs. Ids match ../TELLS.md.
const files = /\.(?:css|scss|sass|less|html?|jsx|tsx|vue|svelte|astro|razor|cshtml)$/i;
const markup = /\.(?:html?|jsx|tsx|vue|svelte|astro|razor|cshtml)$/i;
const exclude = /(?:\.test\.|\.spec\.|\.stories\.|__tests__\/)/;

function reducedMotion(text) {
  if (/prefers-reduced-motion|useReducedMotion|motion-reduce:|MotionConfig[^>]*reducedMotion/.test(text)) return [];
  const lines = text.split("\n");
  const i = lines.findIndex((l) => /@keyframes|\banimation\s*:|from ['"](?:framer-motion|motion\/react)['"]|\banimate-(?:\w+)\b/.test(l));
  return i === -1 ? [] : [{ line: i + 1, match: lines[i].trim() }];
}

export default [
  { id: "ui-1", title: "Default gradient", files, exclude,
    pattern: /\b(?:bg-gradient-to-[trbl]{1,2}|bg-linear-to-[trbl]{1,2})\b[^"'`\n]*?\bfrom-(?:purple|violet|indigo|fuchsia|pink)-\d{2,3}/ },
  { id: "ui-1", title: "Gradient text", files, exclude,
    pattern: /\bbg-clip-text\b|(?:-webkit-)?background-clip:\s*text/ },
  { id: "ui-5", title: "Glass or glow", files, exclude,
    pattern: /\bbackdrop-blur(?:-\w+)?\b|backdrop-filter:\s*blur|\bblur-(?:2xl|3xl)\b|\bblur-\[\d{2,}px\]|shadow-\[0_0_\d+px|box-shadow:\s*0 0 \d{2,}px/ },
  { id: "ui-6", title: "Stock icon as content", files, exclude,
    pattern: /\bimport\s*\{[^}]*\b(?:Sparkles?|Zap|Rocket|ShieldCheck|Wand2?|Bolt|Lightning)\b[^}]*\}\s*from\s*['"](?:lucide-react|@heroicons|react-icons|@tabler|@phosphor|phosphor-react)/ },
  { id: "ui-6", title: "Emoji in UI", files: markup, exclude,
    pattern: /\p{Extended_Pictographic}/u, filter: (m) => !/[©®™]/.test(m) },
  { id: "ui-7", title: "ALL-CAPS eyebrow", files, exclude,
    pattern: /\buppercase\b[^"'`\n]*\btracking-(?:wide|wider|widest|\[)|\btracking-(?:wider|widest)\b[^"'`\n]*\buppercase\b/ },
  { id: "ui-7", title: "Template chrome", files: markup, exclude,
    pattern: /\s·\s|→\s*(?:<\/|['"`])/ },
  { id: "ui-8", title: "Fabricated proof", files: markup, exclude,
    pattern: /\b\d+(?:[.,]\d+)?[kKmM]?\+\s*(?:users|customers|developers|teams|companies|downloads|businesses|happy)\b|\b99\.9+%|\b(?:Trusted by|Loved by|Join) (?:thousands|millions|over|\d)/i },
  { id: "ui-11", title: "Motion everywhere", files, exclude,
    pattern: /\banimate-(?:pulse|bounce|ping)\b|\bhover:(?:scale-\d+|-translate-y-\d+)\b|\btransition-all\b|initial=\{\{\s*opacity:\s*0,\s*y:/ },
  { id: "ui-13", title: "Arbitrary value", files, exclude,
    pattern: /\b[a-z][\w-]*-\[(?:-?\d*\.?\d+(?:px|rem|em|%|vh|vw)|#[0-9a-fA-F]{3,8})\]/ },
  { id: "ui-15", title: "Low-contrast text", files, exclude,
    pattern: /\b(?:text|placeholder)-(?:gray|slate|zinc|neutral|stone)-(?:300|400)\b/ },
  { id: "ui-16", title: "Focus outline removed", files, exclude,
    pattern: /\b(?:focus:)?outline-none\b|outline:\s*(?:none|0)\b/,
    filter: (_m, line) => !/focus-visible|focus:ring|:focus-visible|focus:outline-(?!none)/.test(line) },
  { id: "ui-17", title: "Clickable non-button", files: markup, exclude,
    pattern: /<(?:div|span|li|td)\b[^>]*\bonClick=/ },
  { id: "ui-17", title: "Image without alt", files: markup, exclude,
    pattern: /<img\b(?![^>]*\balt=)[^>]*>/ },
  { id: "ui-19", title: "Animation without reduced-motion path", files, exclude, check: reducedMotion },
  { id: "ui-20", title: "Copy slop", files: markup, exclude,
    pattern: /\b(?:Unlock|Supercharge|Unleash|Elevate|Revolutioni[sz]e|Seamless(?:ly)?|Effortless(?:ly)?|Next[- ]gen(?:eration)?|Game[- ]chang(?:er|ing)|Cutting[- ]edge|Oops|Something went wrong|Learn more|Get started(?: today| now| for free)?)\b/i },
  { id: "ui-21", title: "Placeholder residue", files: markup, exclude,
    pattern: /\blorem ipsum\b|\b(?:John|Jane) Doe\b|\bexample\.com\b|\bAcme(?: Inc| Corp)?\b|\bFeature (?:One|Two|Three|[123])\b|placehold\.co|via\.placeholder\.com|picsum\.photos/i },
];
