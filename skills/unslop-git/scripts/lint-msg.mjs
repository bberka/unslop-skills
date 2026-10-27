#!/usr/bin/env node
// unslop-ignore-file
// Lints commit messages for the tells in ../SKILL.md.
// Usage:
//   node lint-msg.mjs <file>            one message (e.g. .git/COMMIT_EDITMSG)
//   node lint-msg.mjs -                 one message from stdin
//   node lint-msg.mjs --range <range>   every commit in a git range (e.g. main..HEAD)
//   --check   exit 1 when anything is found (for a commit-msg hook)
//   --json    machine-readable output
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const check = args.includes("--check");
const json = args.includes("--json");
const rangeAt = args.indexOf("--range");
const positional = args.filter((a, i) => (!a.startsWith("--") || a === "-") && (rangeAt === -1 || i !== rangeAt + 1));

const VAGUE = /^(?:update[sd]?|fix(?:e[sd])?|change[sd]?|refactor(?:ed|ing)?|improve(?:s|d|ments?)?|clean ?up|tweaks?|misc|minor(?: (?:changes|fixes|updates))?|various(?: (?:changes|fixes|updates))?|wip|stuff|code|changes|work|done)(?:\s+(?:the\s+)?(?:code|files?|stuff|things|it|this|bugs?|issues?|logic|component|tests?|docs?|readme))?\s*$/i;
const PAST = /^(?:added|fixed|updated|removed|changed|implemented|created|refactored|improved|deleted|renamed|moved|introduced|enhanced|adds|fixes|updates|removes|changes|implements|creates|refactors|improves)\b/i;
const VOCAB = /\b(?:enhanc(?:e|es|ed|ing|ement)|robust|seamless(?:ly)?|comprehensive|streamlin(?:e|es|ed|ing)|leverag(?:e|es|ed|ing)|utili[sz](?:e|es|ed|ing)|ensur(?:e|es|ing) (?:that|proper|better)|improv(?:e|es|ed|ing) (?:the )?(?:overall )?(?:code )?(?:quality|readability|maintainability|robustness)|for better (?:readability|maintainability|performance|code quality)|various (?:improvements|changes|fixes)|several improvements|best practices)\b/i;
const HEADER = /^\s*(?:#{1,3}\s+\S|\*{0,2}(?:summary|changes(?: made)?|key changes|benefits|overview|motivation|details|testing|impact|what changed|why)\*{0,2}:)/i;
const SELF = /\b(?:this (?:commit|pr|pull request|mr|patch)|in this (?:commit|pr|change))\b/i;
const RESIDUE = /(?:generated (?:with|by) |🤖|co-authored-by:.*(?:claude|copilot|chatgpt|openai|cursor|gemini|devin|codex|noreply@anthropic))/i;
const CHATBOT = /\b(?:i've|i have (?:added|updated|fixed|made)|let me know|i hope|here's (?:a|the) (?:summary|breakdown))\b/i;
const DIFF_BULLET = /^\s*[-*]\s+(?:add(?:ed|s)?|update[sd]?|modif(?:y|ied|ies)|change[sd]?|remove[sd]?|create[sd]?|delete[sd]?)\s+`?[\w./-]+\.(?:[cm]?[jt]sx?|cs|py|go|rs|java|kt|rb|php|md|json|ya?ml|css|scss|html|vue|svelte|sql|csproj|toml)`?/i;
const EMOJI = /\p{Extended_Pictographic}/u;
const CONVENTIONAL = /^(\w+)(\([^)]*\))?!?:\s*/;

function lint(message) {
  const lines = message.replace(/\r/g, "").split("\n").filter((l) => !l.startsWith("#"));
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
  const hits = [];
  const add = (id, title, match) => hits.push({ id, title, match: String(match).trim().slice(0, 80) });
  const subject = lines[0] ?? "";
  const bare = subject.replace(CONVENTIONAL, "").trim();
  const body = lines.slice(2);

  if (!bare) add("git-1", "Empty subject", subject);
  else if (VAGUE.test(bare) || bare.split(/\s+/).length < 2) add("git-1", "Vague subject", subject);
  if (subject.length > 72) add("git-2", `Subject over 72 chars (${subject.length})`, subject);
  if (/[.!…]$/.test(subject)) add("git-2", "Subject ends with punctuation", subject);
  if (PAST.test(bare)) add("git-2", "Subject not in imperative mood", bare.split(/\s+/)[0]);
  const capitalized = bare.split(/\s+/).slice(1).filter((w) => /^[A-Za-z]{4,}$/.test(w));
  if (capitalized.length >= 3 && capitalized.every((w) => /^[A-Z][a-z]/.test(w))) add("git-2", "Title Case subject", subject);
  if (EMOJI.test(subject)) add("git-2", "Emoji in subject", subject);
  if (/\b(?:and|also|plus)\b.*\b(?:add|fix|remov|updat|refactor|renam|mov|bump|delet)\w*/i.test(bare)) add("git-8", "Subject joins separate changes", subject);
  if (lines.length > 1 && lines[1].trim() !== "") add("git-11", "No blank line after subject", lines[1]);

  const diffBullets = body.filter((l) => DIFF_BULLET.test(l));
  if (diffBullets.length >= 2) add("git-3", "Body lists files the diff already shows", diffBullets[0]);
  for (const l of body) if (HEADER.test(l)) add("git-4", "Section header in body", l);
  if (body.filter((l) => /\*\*[^*]+\*\*/.test(l)).length > 0) add("git-4", "Markdown bold in body", body.find((l) => /\*\*[^*]+\*\*/.test(l)));
  for (const l of lines) if (VOCAB.test(l)) add("git-5", "AI vocabulary or empty benefit claim", l.match(VOCAB)[0]);
  const self = lines.find((l) => SELF.test(l));
  if (self) add("git-6", "Message describes itself", self.match(SELF)[0]);
  for (const l of lines) if (RESIDUE.test(l)) add("git-7", "Tool attribution", l);
  for (const l of lines) if (CHATBOT.test(l)) add("git-9", "Chatbot voice", l.match(CHATBOT)[0]);
  if (body.some((l) => EMOJI.test(l))) add("git-9", "Emoji in body", body.find((l) => EMOJI.test(l)));
  const wide = body.filter((l) => l.length > 72 && !/https?:\/\/|`/.test(l) && !/^\s{4}/.test(l));
  if (wide.length) add("git-10", "Body line over 72 chars", wide[0]);
  if (body.filter((l) => l.trim()).length > 25) add("git-10", "Body over 25 lines", `${body.length} lines`);
  return hits;
}

function fromRange(range) {
  const sep = "\x1e";
  const out = execFileSync("git", ["log", "--no-merges", `--format=%h%x00%B${sep}`, range], { encoding: "utf8" });
  return out.split(sep).map((s) => s.replace(/^\n/, "")).filter((s) => s.includes("\0"))
    .map((s) => { const [sha, msg] = s.split("\0"); return { sha, message: msg }; });
}

let items;
if (rangeAt !== -1) {
  const range = args[rangeAt + 1];
  if (!range) { console.error("lint-msg: --range needs a value, e.g. main..HEAD"); process.exit(2); }
  items = fromRange(range);
} else if (positional[0]) {
  items = [{ sha: null, message: readFileSync(positional[0] === "-" ? 0 : positional[0], "utf8") }];
} else {
  console.error("Usage: lint-msg.mjs <file> | - | --range <range> [--check] [--json]");
  process.exit(2);
}

const results = items.map((it) => ({ ...it, subject: it.message.split("\n")[0], hits: lint(it.message) }));
const flagged = results.filter((r) => r.hits.length);

if (json) {
  console.log(JSON.stringify(results.map(({ message, ...r }) => r), null, 2));
} else {
  for (const r of flagged) {
    console.log(r.sha ? `${r.sha}  ${r.subject}` : r.subject);
    for (const h of r.hits) console.log(`  ${h.id}  ${h.title}: "${h.match}"`);
  }
  console.log(`${flagged.length} of ${results.length} message(s) flagged.`);
}
process.exit(check && flagged.length ? 1 : 0);
