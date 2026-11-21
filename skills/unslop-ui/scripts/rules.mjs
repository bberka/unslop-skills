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

// Lines drawn between blocks. Explicit dividers are rule elements, `divide-*`, one-pixel
// hairline elements, and a literal `|` or bullet between items. Side borders (`border-t`,
// `border-bottom: 1px solid`) do the same job, but a header and a footer each own one, so
// they only count toward a higher total. Removals (`border-b-0`, `border-top: none`), side
// colors (`border-t-stone-200`), and breadcrumb separators are not counted.
const DIVIDER = /<hr\b|<(?!Breadcrumb)[\w.:-]*(?:Separator|Divider|-separator|-divider)\b|\brole=["']separator["']|\bdivide-[xy](?:-(?!reverse\b)[\w[\]]+)?\b|\b[hw]-(?:px|\[1px\]|0\.5)(?![\w-])|>\s*[|•]\s*</g;
const SIDE_BORDER = /(?<![\w-])border-[tby](?:-(?:[1-9]\d*|\[\d[^\]]*\]))?(?![\w-])|\bborder-(?:top|bottom|block(?:-start|-end)?)(?:-width)?\s*:\s*(?!\s|0\b|none\b)|\bborder(?:Top|Bottom|Block)(?:Width)?\s*:\s*(?!\s|0\b|["'`]?none\b)/g;
function dividers(text, path) {
  const lines = text.split("\n");
  const count = (re, on) => {
    let n = 0;
    let first = null;
    lines.forEach((l, i) => { for (const m of l.matchAll(re)) { n++; first ??= { line: i + 1, match: m[0].trim() }; } });
    return on ? { n, first } : { n: 0, first: null };
  };
  const explicit = count(DIVIDER, markup.test(path));
  const sides = count(SIDE_BORDER, true);
  if (explicit.n >= 3 && sides.n === 0) return [{ line: explicit.first.line, match: `${explicit.n} dividers in this file, e.g. ${explicit.first.match}` }];
  if (explicit.n < 3 && explicit.n + sides.n < 5) return [];
  const first = [explicit.first, sides.first].filter(Boolean).sort((a, b) => a.line - b.line)[0];
  return [{ line: first.line, match: `${explicit.n + sides.n} dividers in this file (${explicit.n} rule elements, ${sides.n} side borders), e.g. ${first.match}` }];
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

// A small round element beside text, in any color, or a ping. Both sizes must be small, so a
// progress bar (`h-2 w-full rounded-full`) and an avatar (`h-10 w-10 rounded-full`) pass, and
// so does a loading skeleton.
const SMALL = String.raw`(?:1|1\.5|2|2\.5|3|px)(?![\w.])`;
const smallSize = new RegExp(String.raw`(?<![\w:-])size-${SMALL}`);
const smallH = new RegExp(String.raw`(?<![\w:-])h-${SMALL}`);
const smallW = new RegExp(String.raw`(?<![\w:-])w-${SMALL}`);
function statusDot(line) {
  if (/\banimate-ping\b/.test(line)) return true;
  if (/skeleton/i.test(line)) return false;
  return /\brounded-full\b/.test(line) && (smallSize.test(line) || (smallH.test(line) && smallW.test(line)));
}

// An icon in a tinted tile: a small fixed-size box with a tinted fill and rounded corners
// whose first child is an icon. An icon button, an avatar, and a tile that holds text pass.
const CLASS_ATTR = /class(?:Name)?\s*=\s*(?:"([^"]*)"|\{?\s*[`']([^`']*)[`']\s*\}?)/g;
const tileFill = /(?<![\w:-])bg-(?!(?:white|transparent|black)\b)[a-z]+(?:-(?:50|100|200)\b|-\d{3}\/\d{1,2}\b|\/\d{1,2}\b)/;
const tileBox = /(?<![\w:-])(?:size-(?:7|8|9|10|11|12)|[hw]-(?:7|8|9|10|11|12))(?![\w.])/;
const tileRound = /(?<![\w:-])rounded(?:-(?:md|lg|xl|2xl|full))?(?![\w-])/;
const tileChild = /^\s*>\s*<(?:svg\b|i\b|[A-Z]\w*\b[^<>]*\/>)/;
function iconTiles(text) {
  const hits = [];
  for (const m of text.matchAll(CLASS_ATTR)) {
    const classes = m[1] ?? m[2] ?? "";
    if (!(tileFill.test(classes) && tileBox.test(classes) && tileRound.test(classes))) continue;
    if (/^\s*<button\b/.test(text.slice(text.lastIndexOf("<", m.index), m.index))) continue;
    if (!tileChild.test(text.slice(m.index + m[0].length, m.index + m[0].length + 200))) continue;
    hits.push({ line: text.slice(0, m.index).split("\n").length, match: m[0] });
  }
  return hits;
}

// Day, month, and year dropdowns standing in for a date picker. The part is read from the
// tag's name, id, label, or placeholder, or from a placeholder option, split into words so
// `dueDay` counts and `today`, `birthday`, and `monthly` don't. A card expiry has two parts
// and passes; a file that asks for a date of birth is skipped, since three fields suit a
// date years away.
const SELECT_TAG = /<(?:select|Select(?:Trigger|Value)?|NativeSelect)\b(?:=>|[^>])*>(?:\s*<option\b[^>]*>\s*(?:Day|Month|Year)\s*<)?/g;
const NAMING_ATTR = /\b(?:name|id|aria-label|placeholder|label)\s*=\s*\{?\s*["'`]([^"'`]*)["'`]/g;
const DATE_PART = /^(?:day|month|year)$/i;
function dateSelects(text) {
  if (/\bdate of birth\b|\bbirth ?(?:date|day)\b|\bbirth(?:Date|Day|Month|Year)|\b(?:dob|DOB)\b|\bbday\b/i.test(text)) return [];
  const parts = new Set();
  let first = null;
  for (const m of text.matchAll(SELECT_TAG)) {
    const words = [...m[0].matchAll(NAMING_ATTR)].flatMap((a) => a[1].split(/[^A-Za-z]+|(?<=[a-z])(?=[A-Z])/));
    const option = />\s*(Day|Month|Year)\s*<$/.exec(m[0]);
    if (option) words.push(option[1]);
    const part = words.find((w) => DATE_PART.test(w));
    if (!part) continue;
    parts.add(part.toLowerCase());
    first ??= text.slice(0, m.index).split("\n").length;
  }
  return parts.size === 3 ? [{ line: first, match: "day, month, and year selects" }] : [];
}

// Chart configs live in plain scripts as often as in components.
const charts = /\.(?:[cm]?[jt]sx?|html?|vue|svelte|astro|py)$/i;
const python = /\.py$/i;
// A tour is usually wired up in a plain module (lib/tour.ts), not in the component.
const scripts = /\.(?:[cm]?[jt]sx?|html?|vue|svelte|astro)$/i;

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
  { id: "ui-6", title: "Icon in a tinted tile", files: markup, exclude, check: iconTiles },
  { id: "ui-49", title: "Status dot", files: markup, exclude,
    check: (text) => text.split("\n").flatMap((l, i) => (statusDot(l) ? [{ line: i + 1, match: l.trim() }] : [])) },
  { id: "ui-50", title: "Chart title names the chart type", files: charts, exclude,
    pattern: /\b(?:bar|line|pie|area|scatter|donut|column) (?:chart|graph|plot) (?:of|showing|for)\b/i },
  { id: "ui-51", title: "Chart reading instructions", files: charts, exclude,
    pattern: /\beach (?:bar|point|dot|line|slice|column|row) (?:represents|shows|is)\b|\bhover (?:over|for|to see)\b/i },
  { id: "ui-53", title: "Chart scaffolding", files: charts, exclude,
    multiline: /\bfeDropShadow\b|\bshadow(?:Blur|Color)\b|\bminor\s*:\s*\{|\bborder\s*:\s*\{[^}]*\bwidth\s*:\s*(?:[2-9]|1\.[5-9])|\bgrid\s*:\s*\{[^}]*\blineWidth\s*:\s*(?:[2-9]|1\.[5-9])/,
    filter: (_m, _line, path) => !python.test(path) },
  { id: "ui-53", title: "Chart scaffolding", files: python, exclude,
    pattern: /\.grid\([^)]*\b(?:linewidth|lw)\s*=\s*(?:[2-9]|1\.[5-9])|\bshadow\s*=\s*True\b/,
    filter: (_m, _line, path) => python.test(path) },
  { id: "ui-54", title: "Chart legend", files: charts, exclude,
    multiline: /\blegend\s*:\s*\{[^}]*\b(?:display|show)\s*:\s*true|\bshowlegend\s*:\s*true|<(?:Chart)?Legend\b/,
    filter: (_m, _line, path) => !python.test(path) },
  { id: "ui-54", title: "Chart legend", files: python, exclude,
    pattern: /\.legend\(|\bshowlegend\s*=\s*True\b/,
    filter: (_m, _line, path) => python.test(path) },
  { id: "ui-7", title: "ALL-CAPS eyebrow", files, exclude,
    pattern: /\buppercase\b[^"'`\n]*\btracking-(?:wide|wider|widest|\[)|\btracking-(?:wider|widest)\b[^"'`\n]*\buppercase\b/,
    // Table headers and key caps use the same styling and are not eyebrows.
    filter: (_m, line) => !/<(?:th|TableHead(?:er)?|kbd|abbr)\b/.test(line) },
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
  { id: "ui-25", title: "Dividers everywhere", files, exclude, check: dividers },
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
    filter: (m, line, path) => !(m === "animate-pulse" && /skeleton|loading|loader/i.test(line + " " + path)) && !(/^animate-(?:pulse|ping)$/.test(m) && statusDot(line)) },
  { id: "ui-11", title: "Layout or bounce animation", files, exclude,
    pattern: /\btransition-\[[^\]]*\b(?:width|height|top|left|margin|padding)\b|\btransition(?:-property)?:\s*[^;{}]*\b(?:width|height|top|left|margin|padding)\b|\banimate-(?:float|floating|shimmer|wiggle|levitate)\b|\bbounce:\s*0?\.[3-9]|data-(?:parallax|speed)\b|\bParallax\b/,
    filter: (m, line, path) => !(/shimmer/.test(m) && /skeleton|loading|loader/i.test(line + " " + path)) },
  { id: "ui-39", title: "Heavy heading weight", files, exclude,
    pattern: /\bfont-(?:extrabold|black)\b|font-weight:\s*[89]00\b|\bfontWeight:\s*["']?[89]00\b/ },
  { id: "ui-40", title: "Stock pricing or testimonial", files: markup, exclude,
    pattern: /\bMost Popular\b|\bBest Value\b|★{5}|(?:⭐\s*){5}|\bArray(?:\.from)?\(\s*(?:\{\s*length:\s*)?5\b[^\n]*<Star\b|\[\.\.\.Array\(5\)\][^\n]*<Star\b|\[1,\s*2,\s*3,\s*4,\s*5\][^\n]*<Star\b/ },
  { id: "ui-40", title: "Full-height sections", files, exclude,
    check: perFile(/\b(?:min-)?h-(?:screen|dvh|svh|\[100[sd]?vh\])(?![\w-])|\b(?:min-)?height:\s*100[sd]?vh\b/g, "full-height sections", 3) },
  { id: "ui-41", title: "Greeting headline", files: markup, exclude,
    pattern: /\bWelcome back\b|>\s*(?:Good (?:morning|afternoon|evening)|Hello|Hi|Hey),?\s*(?:\{|[A-Z][a-z]+\s*[!👋<])/,
    filter: (_m, _line, path) => !/log-?in|sign-?in|auth/i.test(path) },
  { id: "ui-56", title: "Day, month, and year selects", files: markup, exclude, check: dateSelects },
  { id: "ui-57", title: "Tour library", files: scripts, exclude,
    pattern: /(?:\bfrom\s+|\bimport\s*\(\s*|\brequire\s*\(\s*)['"](?:react-joyride|shepherd\.js|react-shepherd|intro\.js(?:-react)?|driver\.js|@reactour\/tour|reactour|onborda|nextstepjs)['"]/ },
  { id: "ui-57", title: "Product tour", files: markup, exclude,
    pattern: /<(?:Onboarding(?:Modal|Dialog|Carousel|Slides|Tour)|Welcome(?:Modal|Dialog|Carousel|Tour)|(?:Product|Feature|App|Guided)Tour)\b|\bSkip (?:the )?(?:tour|intro|walkthrough|onboarding)\b/ },
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
    pattern: /\b(?:Unlock|Supercharge|Unleash|Elevate|Revolutioni[sz]e|Seamless(?:ly)?|Effortless(?:ly)?|Next[- ]gen(?:eration)?|Game[- ]chang(?:er|ing)|Cutting[- ]edge|Oops|Something went wrong|Learn more|Get started(?: today| now| for free)?|AI[- ]powered|Powered by AI|Search (?:anything|everything)|Magic(?:al(?:ly)?)?)\b/i },
  { id: "ui-20", title: "Exclamation mark in UI text", files: markup, exclude,
    pattern: />[^<>{}=;]*[A-Za-z]!+\s*<|\b(?:placeholder|title|label|aria-label)=["'][^"']*[A-Za-z]!+["']/ },
  { id: "ui-21", title: "Placeholder residue", files: markup, exclude,
    pattern: /\blorem ipsum\b|\b(?:John|Jane) Doe\b|\bexample\.com\b|\bAcme(?: Inc| Corp)?\b|\bFeature (?:One|Two|Three|[123])\b|placehold\.co|via\.placeholder\.com|picsum\.photos/i,
    filter: (m, line) => !(/example\.com/i.test(m) && /placeholder=/.test(line)) },
];

export default rules.map((rule) => ({ skipFile: compiled, ...rule }));
