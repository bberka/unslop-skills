#!/usr/bin/env node
// Design-token inventory: how many distinct colors, neutrals, radii, shadows,
// font families, font sizes, weights, z-indexes, opacity levels, and arbitrary values a UI uses,
// CSS custom properties that are defined but never read, and which files animate
// versus which handle prefers-reduced-motion.
// Usage: node tokens.mjs [--json] [--top N] [paths...]
import { readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { listFiles } from "./files.mjs";

const FILES = /\.(?:css|scss|sass|less|html?|jsx|tsx|vue|svelte|astro|razor|cshtml)$|tailwind\.config\.[cm]?[jt]s$/i;
const SKIP = /(?:^|[\\/])(?:node_modules|\.git|dist|build|out|coverage|\.next|\.nuxt|\.svelte-kit|vendor|storybook-static|__tests__|__mocks__|__fixtures__|tests?|e2e|playwright|cypress)(?:[\\/]|$)|\.min\.css$|\.(?:test|spec|e2e|stories)\.[jt]sx$/;
// Compiled Tailwind output restates every utility the project uses.
const GENERATED = /^\/\*! tailwindcss v/;
const args = process.argv.slice(2);
const json = args.includes("--json");
const topAt = args.indexOf("--top");
const TOP = topAt === -1 ? 12 : Number(args[topAt + 1]);
const targets = args.filter((a, i) => !a.startsWith("--") && (topAt === -1 || i !== topAt + 1));
if (!targets.length) targets.push(".");

const files = targets.flatMap((t) => {
  const abs = resolve(t);
  if (!existsSync(abs)) { console.error(`tokens: no such path: ${t}`); process.exit(2); }
  return statSync(abs).isDirectory() ? listFiles(abs, SKIP) : [abs];
}).filter((f) => FILES.test(f) && !SKIP.test(relative(process.cwd(), f)) && existsSync(f));

const TW_COLORS = "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const NEUTRAL_FAMILIES = new Set(["slate", "gray", "zinc", "neutral", "stone"]);
const categories = {
  colors: new Map(), neutrals: new Map(), radii: new Map(), shadows: new Map(), fontFamilies: new Map(),
  fontSizes: new Map(), fontWeights: new Map(), zIndex: new Map(), opacities: new Map(), arbitrary: new Map(),
};
const varsDefined = new Map();
const varsUsed = new Set();
let rawColorsOutsideVars = 0;
const animatedFiles = new Set();
const reducedMotionFiles = new Set();
const GENERIC_FAMILIES = new Set(["inherit", "initial", "unset", "revert"]);
// Bracket contents that are values (sizes, colors, var() refs), as opposed to
// variant selectors such as data-[state=open] or has-[>svg].
const ARBITRARY_VALUE = /^(?:-?\d|#|var\(|calc\(|--|url\(|rgb|hsl|oklch|['"])/;

function bump(cat, value, file) {
  const key = value.trim().replace(/\s+/g, " ");
  const entry = categories[cat].get(key) ?? { count: 0, files: new Set() };
  entry.count++;
  entry.files.add(relative(process.cwd(), file));
  categories[cat].set(key, entry);
}

function normHex(h) {
  let x = h.slice(1).toLowerCase();
  if (x.length === 3 || x.length === 4) x = [...x].map((c) => c + c).join("");
  return "#" + x;
}

function isNeutralHex(h) {
  const x = normHex(h).slice(1, 7);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16));
  return Math.max(r, g, b) - Math.min(r, g, b) <= 10;
}

for (const file of files) {
  let text;
  try { text = readFileSync(file, "utf8"); } catch { continue; }
  if (text.length > 2_000_000 || GENERATED.test(text)) continue;
  const rel = relative(process.cwd(), file);
  if (/@keyframes|\banimation\s*:|\banimate-\w+|from ['"](?:framer-motion|motion\/react)['"]/.test(text)) animatedFiles.add(rel);
  if (/prefers-reduced-motion|motion-reduce:|motion-safe:|useReducedMotion|reducedMotion/.test(text)) reducedMotionFiles.add(rel);

  for (const line of text.split("\n")) {
    const definesVar = /^\s*--[\w-]+\s*:/.test(line);
    for (const m of line.matchAll(/--([\w-]+)\s*:/g)) varsDefined.set(m[1], relative(process.cwd(), file));
    for (const m of line.matchAll(/var\(\s*--([\w-]+)/g)) varsUsed.add(m[1]);

    for (const m of line.matchAll(/(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g)) {
      const hex = normHex(m[0]);
      bump("colors", hex, file);
      if (isNeutralHex(hex)) bump("neutrals", hex, file);
      if (!definesVar) rawColorsOutsideVars++;
    }
    for (const m of line.matchAll(/\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\([^)]*\)/g)) {
      bump("colors", m[0].replace(/\s+/g, " "), file);
      if (!definesVar && !/var\(/.test(m[0])) rawColorsOutsideVars++;
    }
    for (const m of line.matchAll(new RegExp(`\\b(?:bg|text|border|from|via|to|ring|fill|stroke|outline|decoration|divide|placeholder|accent|caret)-(${TW_COLORS})-(\\d{2,3})\\b`, "g"))) {
      bump("colors", `${m[1]}-${m[2]}`, file);
      if (NEUTRAL_FAMILIES.has(m[1])) bump("neutrals", `${m[1]}-${m[2]}`, file);
    }

    for (const m of line.matchAll(/border(?:-[a-z-]+)?-radius\s*:\s*([^;}"']+)/g)) bump("radii", m[1], file);
    for (const m of line.matchAll(/(?<![\w-])rounded(?:-[trblse]{1,2}(?=-|$|[^\w-]))?(?:-(none|xs|sm|md|lg|xl|[2-4]xl|full|\[[^\]]+\]))?(?![\w-])/g)) bump("radii", m[0].replace(/^rounded-[trblse]{1,2}(?=-|$)/, "rounded"), file);

    for (const m of line.matchAll(/box-shadow\s*:\s*([^;}"']+)/g)) bump("shadows", m[1], file);
    for (const m of line.matchAll(/(?<![\w-])shadow(?:-(xs|sm|md|lg|xl|2xl|inner|none|\[[^\]]+\]))?(?![\w-])/g)) bump("shadows", m[0], file);

    for (const m of line.matchAll(/font-family\s*:\s*([^;}]+)/g)) {
      const family = m[1].split(",")[0].replace(/['"]/g, "").trim();
      if (!GENERIC_FAMILIES.has(family)) bump("fontFamilies", family, file);
    }
    for (const m of line.matchAll(/(?<![\w-])font-(sans|serif|mono|\[[^\]]+\])(?![\w-])/g)) bump("fontFamilies", m[0], file);
    for (const m of line.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]next\/font\/google['"]/g)) m[1].split(",").forEach((f) => f.trim() && bump("fontFamilies", f.trim(), file));
    for (const m of line.matchAll(/fonts\.googleapis\.com\/css2?\?family=([^&:"')]+)/g)) bump("fontFamilies", decodeURIComponent(m[1]).replace(/\+/g, " "), file);

    for (const m of line.matchAll(/font-size\s*:\s*([^;}"']+)/g)) bump("fontSizes", m[1], file);
    for (const m of line.matchAll(/(?<![\w-])text-(xs|sm|base|lg|xl|[2-9]xl|\[[\d.]+(?:px|rem|em)\])(?![\w-])/g)) bump("fontSizes", m[0], file);

    for (const m of line.matchAll(/font-weight\s*:\s*([^;}"']+)/g)) bump("fontWeights", m[1], file);
    for (const m of line.matchAll(/(?<![\w-])font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)\b/g)) bump("fontWeights", m[0], file);

    for (const m of line.matchAll(/z-index\s*:\s*(-?\d+)/g)) bump("zIndex", m[1], file);
    for (const m of line.matchAll(/(?<![\w-])-?z-(\d+|\[-?\d+\])(?![\w-])/g)) bump("zIndex", m[0], file);

    for (const m of line.matchAll(/\b(?:bg|text|border|ring|from|via|to|fill|stroke|divide|outline|shadow|placeholder|decoration)-[a-z]+(?:-\d{2,3})?\/(\d{1,3})\b/g)) bump("opacities", `/${m[1]}`, file);
    for (const m of line.matchAll(/(?<![\w-])opacity-(\d{1,3})\b/g)) bump("opacities", `/${m[1]}`, file);
    for (const m of line.matchAll(/\b(?:rgba|hsla)\([^)]*,\s*(0?\.\d+)\s*\)/g)) bump("opacities", `alpha ${m[1]}`, file);
    for (const m of line.matchAll(/\bopacity:\s*(0?\.\d+)/g)) bump("opacities", `alpha ${m[1]}`, file);

    for (const m of line.matchAll(/\b[a-z][\w-]*-\[([^\]\s]+)\]/g)) if (ARBITRARY_VALUE.test(m[1])) bump("arbitrary", m[0], file);
  }
}

const unusedVars = [...varsDefined.keys()].filter((v) => !varsUsed.has(v));
const summarize = (map) => [...map.entries()].sort((a, b) => b[1].count - a[1].count)
  .map(([value, e]) => ({ value, count: e.count, files: [...e.files] }));

const report = Object.fromEntries(Object.entries(categories).map(([k, v]) => [k, summarize(v)]));
report.cssVariables = { defined: varsDefined.size, used: varsUsed.size, unused: unusedVars };
report.rawColorsOutsideVariableDefinitions = rawColorsOutsideVars;
report.motion = { animatedFiles: [...animatedFiles], reducedMotionFiles: [...reducedMotionFiles] };
report.filesScanned = files.length;

// One branch per format: exit() after printing can drop the end of a large --json output on a pipe.
if (json) {
  console.log(JSON.stringify(report, null, 2));
} else {

  const LABELS = {
    colors: "Colors", neutrals: "Neutrals (grays)", radii: "Radii", shadows: "Shadows", fontFamilies: "Font families",
    fontSizes: "Font sizes", fontWeights: "Font weights", zIndex: "z-index values", opacities: "Opacity levels (ui-26)", arbitrary: "Arbitrary values",
  };
  console.log(`Scanned ${files.length} UI files.\n`);
  for (const [key, label] of Object.entries(LABELS)) {
    const rows = report[key];
    console.log(`${label}: ${rows.length} distinct`);
    for (const r of rows.slice(0, TOP)) {
      const where = r.files.slice(0, 3).join(", ") + (r.files.length > 3 ? `, +${r.files.length - 3} more` : "");
      console.log(`  ${r.value}  x${r.count}  (${where})`);
    }
    if (rows.length > TOP) console.log(`  ... ${rows.length - TOP} more (use --top N or --json)`);
    console.log("");
  }
  console.log(`CSS variables: ${varsDefined.size} defined, ${unusedVars.length} never read${unusedVars.length ? ": " + unusedVars.slice(0, 15).map((v) => "--" + v).join(", ") : ""}`);
  console.log(`Raw color literals outside variable definitions: ${rawColorsOutsideVars}`);
  const rm = [...reducedMotionFiles];
  console.log(`Motion: ${animatedFiles.size} files animate; prefers-reduced-motion handled in ${rm.length}${rm.length ? ": " + rm.slice(0, 5).join(", ") + (rm.length > 5 ? `, +${rm.length - 5} more` : "") : " (ui-19 applies to every animated file)"}`);
  console.log("\nCompare each count with the project's defined scale. More distinct values than the scale defines is ui-13 sprawl.");
}
