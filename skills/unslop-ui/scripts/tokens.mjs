#!/usr/bin/env node
// Design-token inventory: how many distinct colors, neutrals, radii, shadows,
// font families, font sizes, weights, z-indexes, and arbitrary values a UI uses,
// plus CSS custom properties that are defined but never read.
// Usage: node tokens.mjs [--json] [--top N] [paths...]
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, relative, resolve } from "node:path";

const FILES = /\.(?:css|scss|sass|less|html?|jsx|tsx|vue|svelte|astro|razor|cshtml)$|tailwind\.config\.[cm]?[jt]s$/i;
const SKIP = /(?:^|[\\/])(?:node_modules|\.git|dist|build|out|coverage|\.next|\.nuxt|\.svelte-kit|vendor|storybook-static)(?:[\\/]|$)|\.min\.css$/;
const args = process.argv.slice(2);
const json = args.includes("--json");
const topAt = args.indexOf("--top");
const TOP = topAt === -1 ? 12 : Number(args[topAt + 1]);
const targets = args.filter((a, i) => !a.startsWith("--") && (topAt === -1 || i !== topAt + 1));
if (!targets.length) targets.push(".");

function list(dir) {
  try {
    return execFileSync("git", ["ls-files", "-z", "-co", "--exclude-standard"], { cwd: dir, maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] })
      .toString().split("\0").filter(Boolean).map((f) => join(dir, f));
  } catch {
    const acc = [];
    const walk = (d) => readdirSync(d, { withFileTypes: true }).forEach((e) => {
      const p = join(d, e.name);
      if (e.isDirectory() && !SKIP.test(p)) walk(p); else if (e.isFile()) acc.push(p);
    });
    walk(dir);
    return acc;
  }
}

const files = targets.flatMap((t) => {
  const abs = resolve(t);
  if (!existsSync(abs)) { console.error(`tokens: no such path: ${t}`); process.exit(2); }
  return statSync(abs).isDirectory() ? list(abs) : [abs];
}).filter((f) => FILES.test(f) && !SKIP.test(relative(process.cwd(), f)) && existsSync(f));

const TW_COLORS = "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const NEUTRAL_FAMILIES = new Set(["slate", "gray", "zinc", "neutral", "stone"]);
const categories = {
  colors: new Map(), neutrals: new Map(), radii: new Map(), shadows: new Map(), fontFamilies: new Map(),
  fontSizes: new Map(), fontWeights: new Map(), zIndex: new Map(), arbitrary: new Map(),
};
const varsDefined = new Map();
const varsUsed = new Set();
let rawColorsOutsideVars = 0;

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
  if (text.length > 2_000_000) continue;

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
    for (const m of line.matchAll(/(?<![\w-])rounded(?:-[trblse]{1,2})?(?:-(none|sm|md|lg|xl|2xl|3xl|full|\[[^\]]+\]))?(?![\w-])/g)) bump("radii", m[0].replace(/^rounded-[trblse]{1,2}/, "rounded"), file);

    for (const m of line.matchAll(/box-shadow\s*:\s*([^;}"']+)/g)) bump("shadows", m[1], file);
    for (const m of line.matchAll(/(?<![\w-])shadow(?:-(xs|sm|md|lg|xl|2xl|inner|none|\[[^\]]+\]))?(?![\w-])/g)) bump("shadows", m[0], file);

    for (const m of line.matchAll(/font-family\s*:\s*([^;}]+)/g)) bump("fontFamilies", m[1].split(",")[0].replace(/['"]/g, ""), file);
    for (const m of line.matchAll(/(?<![\w-])font-(sans|serif|mono|\[[^\]]+\])(?![\w-])/g)) bump("fontFamilies", m[0], file);
    for (const m of line.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]next\/font\/google['"]/g)) m[1].split(",").forEach((f) => f.trim() && bump("fontFamilies", f.trim(), file));
    for (const m of line.matchAll(/fonts\.googleapis\.com\/css2?\?family=([^&:"')]+)/g)) bump("fontFamilies", decodeURIComponent(m[1]).replace(/\+/g, " "), file);

    for (const m of line.matchAll(/font-size\s*:\s*([^;}"']+)/g)) bump("fontSizes", m[1], file);
    for (const m of line.matchAll(/(?<![\w-])text-(xs|sm|base|lg|xl|[2-9]xl|\[[\d.]+(?:px|rem|em)\])(?![\w-])/g)) bump("fontSizes", m[0], file);

    for (const m of line.matchAll(/font-weight\s*:\s*([^;}"']+)/g)) bump("fontWeights", m[1], file);
    for (const m of line.matchAll(/(?<![\w-])font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)\b/g)) bump("fontWeights", m[0], file);

    for (const m of line.matchAll(/z-index\s*:\s*(-?\d+)/g)) bump("zIndex", m[1], file);
    for (const m of line.matchAll(/(?<![\w-])-?z-(\d+|\[-?\d+\])(?![\w-])/g)) bump("zIndex", m[0], file);

    for (const m of line.matchAll(/\b[a-z][\w-]*-\[[^\]\s]+\]/g)) bump("arbitrary", m[0], file);
  }
}

const unusedVars = [...varsDefined.keys()].filter((v) => !varsUsed.has(v));
const summarize = (map) => [...map.entries()].sort((a, b) => b[1].count - a[1].count)
  .map(([value, e]) => ({ value, count: e.count, files: [...e.files] }));

const report = Object.fromEntries(Object.entries(categories).map(([k, v]) => [k, summarize(v)]));
report.cssVariables = { defined: varsDefined.size, used: varsUsed.size, unused: unusedVars };
report.rawColorsOutsideVariableDefinitions = rawColorsOutsideVars;
report.filesScanned = files.length;

if (json) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

const LABELS = {
  colors: "Colors", neutrals: "Neutrals (grays)", radii: "Radii", shadows: "Shadows", fontFamilies: "Font families",
  fontSizes: "Font sizes", fontWeights: "Font weights", zIndex: "z-index values", arbitrary: "Arbitrary values",
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
console.log("\nCompare each count with the project's defined scale. More distinct values than the scale defines is ui-13 sprawl.");
