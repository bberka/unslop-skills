// unslop-ignore-file
// Lexical UI tells for scan.mjs. Ids match ../TELLS.md.
const files = /\.(?:css|scss|sass|less|html?|jsx|tsx|vue|svelte|astro|razor|cshtml)$/i;
const markup = /\.(?:html?|jsx|tsx|vue|svelte|astro|razor|cshtml)$/i;
const exclude = /\.(?:test|spec|e2e|stories)\.|(?:^|\/)(?:__tests__|__mocks__|__fixtures__|e2e|playwright|cypress)\//;
// Static assets under public/ are usually vendored (icon indexes, third-party pages).
const vendoredHtml = /(?:^|\/)public\/.*\.html?$/i;

// One hit per file with the count: the list of values lives in tokens.mjs. `min` is the count
// a file needs before it is reported, for tells that are density rather than presence.
function perFile(re, label, min = 1) {
  return (text) => {
    const lines = text.split("\n");
    let first = null;
    let n = 0;
    lines.forEach((l, i) => {
      for (const m of l.matchAll(re)) { n++; first ??= { line: i + 1, match: m[0] }; }
    });
    if (n < min) return [];
    return [{ line: first.line, match: n === 1 ? first.match : `${n} ${label} in this file, e.g. ${first.match}` }];
  };
}

// Distinct opacity levels in one file: Tailwind `/NN` color modifiers, `opacity-NN`, and the
// alpha of rgba()/hsla() literals. Four or more is a palette made of mixes.
const OPACITY = /\b(?:bg|text|border|ring|from|via|to|fill|stroke|divide|outline|shadow|placeholder|decoration)-[a-z]+(?:-\d{2,3})?\/(\d{1,3})\b|\bopacity-(\d{1,3})\b|\b(?:rgba|hsla)\([^)]*,\s*(0?\.\d+)\s*\)|\bopacity:\s*(0?\.\d+)/g;
function opacityStack(text) {
  const seen = new Map();
  text.split("\n").forEach((l, i) => {
    for (const m of l.matchAll(OPACITY)) {
      const level = m[1] ?? m[2] ?? m[3] ?? m[4];
      if (!seen.has(level)) seen.set(level, { line: i + 1, match: m[0] });
    }
  });
  if (seen.size < 4) return [];
  const [first] = seen.values();
  return [{ line: first.line, match: `${seen.size} distinct opacity levels in this file, e.g. ${first.match}` }];
}

// A bordered, rounded, padded block per line; five in one file is a page of outlined containers.
const boxed = (l) => /\b(?:border|ring-1)\b/.test(l) && /\brounded(?:-\w+)?\b/.test(l) && /\bp[xy]?-\d/.test(l);
function borderedBoxes(text) {
  const lines = text.split("\n");
  const hits = lines.map((l, i) => (boxed(l) ? i + 1 : 0)).filter(Boolean);
  const css = lines.map((l, i) => (/\bborder:\s*1px\s+solid\b/.test(l) ? i + 1 : 0)).filter(Boolean);
  const all = hits.length >= 5 ? hits : css.length >= 5 ? css : [];
  return all.length ? [{ line: all[0], match: `${all.length} bordered boxes in this file` }] : [];
}

// An inline SVG with many shapes is a drawn diagram, not an icon. Icon sprites and icon
// components are skipped by path.
const iconFile = /(?:^|\/)icons?(?:\/|\.)|Icon\.(?:[jt]sx|svelte|vue|astro|html?)$/i;
function inlineDiagram(text, path) {
  if (iconFile.test(path)) return [];
  const lines = text.split("\n");
  const svgLine = lines.findIndex((l) => /<svg\b/.test(l));
  if (svgLine === -1) return [];
  const shapes = (text.match(/<(?:circle|line|path|rect|ellipse|polyline|polygon)\b/g) ?? []).length;
  return shapes >= 12 ? [{ line: svgLine + 1, match: `inline SVG with ${shapes} shapes` }] : [];
}

// `A · B` meta strings, once per file. A page title separator ("Docs · Product") is the
// browser-tab convention, not chrome.
function middleDots(text) {
  const kept = text.split("\n").map((l) => (/<title\b|svelte:head|document\.title|\btitle\s*[:=]/.test(l) ? "" : l)).join("\n");
  return perFile(/\s·\s/g, "middle-dot separators")(kept);
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
  { id: "ui-1", title: "Dark-mode gradient hero", files, exclude,
    pattern: /\bbg-(?:black|zinc-950|neutral-950|gray-950|slate-950|stone-950|\[#0[0-9a-fA-F]{5}\])\b[^"'`\n]*\b(?:bg-gradient-to-|bg-linear-to-|bg-\[radial-gradient|from-\w+-\d{3}\/\d+)|radial-gradient\((?:ellipse|circle)?\s*(?:\d+%\s+\d+%\s+)?at\s+(?:top|50%\s+0)/ },
  { id: "ui-31", title: "Dithering or grain", files, exclude,
    pattern: /\bdither(?:ed|ing)?\b|\bhalftone\b|<feTurbulence\b|\b(?:grain|noise)(?:-overlay|-texture|\.png|\.svg|\.webp)\b|\bNoise(?:Overlay|Texture)\b/i },
  { id: "ui-32", title: "ASCII or video background", files: markup, exclude,
    pattern: /\bAsciiEffect\b|\bascii[-_ ]?(?:art|overlay|render(?:er)?|effect|shader)\b|<video\b(?=[^>]*\bautoplay\b)(?=[^>]*\b(?:loop|muted)\b)[^>]*>/i },
  { id: "ui-33", title: "Grid or dot background", files, exclude,
    pattern: /\bbg-(?:grid|dot|dots|graph-paper)(?:-\w+)?\b|\b(?:Grid|Dot|Dots)Pattern\b|\b(?:grid|dot)-pattern\b|linear-gradient\((?:to right|90deg),\s*[^,)]+\s1px,\s*transparent 1px\)|radial-gradient\(\s*(?:circle\s*(?:at\s+[\w% ]+)?,\s*)?[^,)]+\s1px,\s*transparent/i },
  { id: "ui-34", title: "Logo marquee or holographic chrome", files, exclude,
    pattern: /\banimate-(?:marquee|infinite-scroll|scroll-x)\b|\b(?:logo-?(?:marquee|cloud|ticker|carousel)|LogoCloud|LogoMarquee|LogoTicker|InfiniteSlider|Marquee)\b|\b(?:holographic|iridescent|chrome-text|metallic|rainbow-text)\b/i },
  { id: "ui-35", title: "Painterly background", files, exclude,
    pattern: /\bmesh-?gradient\b|\bMeshGradient\b|@paper-design\/shaders|\baurora(?:-background|-bg|Background)?\b|\b(?:watercolor|impressionist|monet|painterly)\b/i },
  { id: "ui-36", title: "Pixel loader or retro type", files, exclude,
    pattern: /image-rendering:\s*pixelated|\b\[image-rendering:pixelated\]|\bpixel(?:-|_)?(?:loader|spinner|art|font|border)s?\b|\b(?:Press[_ ]Start[_ ]2P|Pixelify[_ ]Sans|VT323|Silkscreen|DotGothic16)\b/i },
  { id: "ui-37", title: "Squircle", files, exclude,
    pattern: /corner-shape:\s*(?:squircle|superellipse)|\bsuperellipse\b|\bsquircle\b|figma-squircle|react-squircle|@squircle-js/i },
  { id: "ui-38", title: "Text-layout showpiece", files: markup, exclude,
    pattern: /from\s+['"](?:@chenglou\/pretext|pretext|split-type|@splitbee\/split-text|gsap\/SplitText)['"]|\bSplitText\b|\bTextSplit\b|\b(?:staggerChildren|stagger)\b[^\n]{0,80}\bchar(?:acter)?s?\b/i },
  { id: "ui-5", title: "Glass or glow", files, exclude,
    pattern: /\bbackdrop-blur(?:-\w+)?\b|backdrop-filter:\s*blur|\bblur-(?:2xl|3xl)\b|\bblur-\[\d{2,}px\]|shadow-\[0_0_\d+px|box-shadow:\s*0 0 \d{2,}px/ },
  { id: "ui-6", title: "Stock icon as content", files, exclude,
    pattern: /\bimport\s*\{[^}]*\b(?:Sparkles?|Zap|Rocket|ShieldCheck|Wand2?|Bolt|Lightning)\b[^}]*\}\s*from\s*['"](?:lucide-react|@heroicons|react-icons|@tabler|@phosphor|phosphor-react)/ },
  { id: "ui-6", title: "Emoji in UI", files: markup, exclude,
    check: perFile(/(?![©®™])\p{Extended_Pictographic}/gu, "emoji") },
  { id: "ui-7", title: "ALL-CAPS eyebrow", files, exclude,
    pattern: /\buppercase\b[^"'`\n]*\btracking-(?:wide|wider|widest|\[)|\btracking-(?:wider|widest)\b[^"'`\n]*\buppercase\b/ },
  { id: "ui-7", title: "Template chrome", files: markup, exclude, check: middleDots },
  { id: "ui-7", title: "Template chrome", files: markup, exclude, pattern: /→\s*(?:<\/|['"`])/ },
  { id: "ui-7", title: "Section numbering", files: markup, exclude,
    check: perFile(/>\s*\(?0[1-9][.)]?\s*<|[{(]\s*["']0[1-9]["']\s*[})]/g, "zero-padded section numbers", 2) },
  { id: "ui-22", title: "Badge and tag clutter", files: markup, exclude,
    check: perFile(/<(?:Badge|Chip|Tag|Pill)\b|\brounded-full\b[^"'`\n]*\btext-(?:xs|\[1[0-2]px\])\b|\btext-(?:xs|\[1[0-2]px\])\b[^"'`\n]*\brounded-full\b/g, "badges", 3) },
  { id: "ui-23", title: "Italic word in a headline", files: markup, exclude,
    multiline: /<h[1-3]\b[^>]*>(?:(?!<\/h[1-3]>)[\s\S]){0,200}?<(?:em\b|i\b|span\b[^>]*\bitalic\b)/ },
  { id: "ui-23", title: "Italic serif accent", files, exclude,
    pattern: /\bitalic\b[^"'`\n]*\bfont-(?:serif|display)\b|\bfont-(?:serif|display)\b[^"'`\n]*\bitalic\b/ },
  { id: "ui-24", title: "Display-serif default", files, exclude,
    pattern: /\b(?:Instrument[_ ]Serif|Playfair[_ ]Display|Fraunces|DM[_ ]Serif(?:[_ ](?:Display|Text))?|Cormorant(?:[_ ]Garamond)?|Newsreader|Libre[_ ]Caslon(?:[_ ](?:Display|Text))?|Gloock|Bodoni[_ ]Moda)\b/ },
  { id: "ui-24", title: "Negative tracking", files, exclude,
    pattern: /\btracking-tighter\b|\btracking-\[-|letter-spacing:\s*-0?\.0[3-9]\d*em|letter-spacing:\s*-(?:[1-9]\d*|0?\.[5-9]\d*)px/ },
  { id: "ui-25", title: "Dividers everywhere", files: markup, exclude,
    check: perFile(/<hr\b|<(?:Separator|Divider)\b|\bdivide-[xy](?:-\d+)?\b/g, "dividers", 3) },
  { id: "ui-26", title: "Opacity stack", files, exclude, check: opacityStack },
  { id: "ui-27", title: "Bordered boxes everywhere", files, exclude, check: borderedBoxes },
  { id: "ui-28", title: "Inline diagram", files: markup, exclude, check: inlineDiagram },
  { id: "ui-29", title: "Code breadcrumb", files: markup, exclude,
    pattern: />\s*(?:~\/|\$\s|\.\/)[^<]{0,80}<|>[^<]*\b[\w-]+\/[\w-]+\/[\w.-]+\.(?:[cm]?[jt]sx?|css|md|py|rs|go|cs)\b[^<]*</,
    filter: (_m, _line, path) => !/(?:^|\/)docs?\//i.test(path) },
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
    pattern: /<(?:div|span|li|td)\b[^>]*(?:\bon[Cc]lick=|\bon:click\b|@click\b|\bv-on:click\b)/ },
  { id: "ui-17", title: "Image without alt", files: markup, exclude,
    multiline: /<img\b(?![^>]*(?:\balt=|\{alt\}|\{\s*\.\.\.))[^>]*>/, filter: (_m, _line, path) => !vendoredHtml.test(path) },
  { id: "ui-19", title: "Animation without reduced-motion path", files, exclude, check: reducedMotion },
  { id: "ui-20", title: "Copy slop", files: markup, exclude,
    pattern: /\b(?:Unlock|Supercharge|Unleash|Elevate|Revolutioni[sz]e|Seamless(?:ly)?|Effortless(?:ly)?|Next[- ]gen(?:eration)?|Game[- ]chang(?:er|ing)|Cutting[- ]edge|Oops|Something went wrong|Learn more|Get started(?: today| now| for free)?)\b/i },
  { id: "ui-21", title: "Placeholder residue", files: markup, exclude,
    pattern: /\blorem ipsum\b|\b(?:John|Jane) Doe\b|\bexample\.com\b|\bAcme(?: Inc| Corp)?\b|\bFeature (?:One|Two|Three|[123])\b|placehold\.co|via\.placeholder\.com|picsum\.photos/i,
    filter: (m, line) => !(/example\.com/i.test(m) && /placeholder=/.test(line)) },
];

export default rules.map((rule) => ({ skipFile: compiled, ...rule }));
