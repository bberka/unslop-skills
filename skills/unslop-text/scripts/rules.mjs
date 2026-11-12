// unslop-ignore-file
// Lexical text tells for scan.mjs. Ids match ../TELLS.md.
// Changelogs (CHANGELOG, CHANGES, HISTORY, RELEASE_NOTES) are release-tool output, so a
// directory walk skips them. Naming one on the command line still scans it.
const files = /^(?!(?:.*\/)?(?:CHANGELOG|CHANGES|HISTORY|RELEASE[-_]?NOTES)[^/]*$)(?!(?:.*\/)?(?:changelogs?|release[-_]?notes|\.changeset)\/).*\.(?:md|mdx|markdown|txt|rst|adoc)$/i;
const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "by", "for", "from", "in", "into", "of", "on", "onto", "or", "over", "than", "that", "the", "this", "to", "upon", "vs", "when", "with", "your"]);
const LIST_ITEM = /^\s*(?:[-*+]|\d+\.)\s/;

// A capitalized word in mid-sentence is a name: a difficulty level ("Extremely difficult"), a
// setting ("Robust mode"), a product. Sentence-initial capitals are still words to judge.
const asName = (match, line) => !/^[A-Z][a-z]+$/.test(match) || !new RegExp(`[a-z0-9,;(]\\s+${match.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(line);

// A heading is Title Case when its later words are capitalized and either a small word
// ("With", "The") is capitalized too, or most of its words appear lowercased in the body
// (so they are common words, not a product name like "Visual Studio Code").
function titleCaseHeadings(text) {
  const hits = [];
  const lines = text.split("\n");
  const bodyWords = new Set();
  for (const line of lines) {
    if (/^#{1,6}\s/.test(line)) continue;
    for (const w of line.match(/\b[a-z]{4,}\b/g) ?? []) bodyWords.add(w);
  }
  const body = lines.filter((l) => !/^#{1,6}\s/.test(l)).join("\n");
  lines.forEach((line, i) => {
    const m = /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
    if (!m) return;
    // "Horse Race" written the same way in the body is a name, not a styling choice.
    const core = m[1].replace(/^[\d.\s]+/, "").replace(/\s*\([^)]*\)\s*$/, "").replace(/[:.]$/, "").trim();
    if (core && body.includes(core)) return;
    const words = m[1].split(/\s+/).map((w) => w.replace(/[^A-Za-z]/g, "")).filter(Boolean);
    const isCandidate = (w) => w.length >= 4 && !SMALL_WORDS.has(w.toLowerCase()) && w !== w.toUpperCase();
    const later = words.slice(1).filter(isCandidate);
    if (!later.length || !later.every((w) => /^[A-Z]/.test(w))) return;
    const capitalizedSmall = words.slice(1).some((w) => SMALL_WORDS.has(w.toLowerCase()) && /^[A-Z]/.test(w));
    const all = words.filter(isCandidate);
    const common = all.filter((w) => bodyWords.has(w.toLowerCase())).length;
    if (capitalizedSmall || (all.length >= 2 && common > all.length / 2)) hits.push({ line: i + 1, match: m[1] });
  });
  // A file where most headings are Title Case follows a convention: one hit, so the
  // reader decides once instead of judging the same thing twenty times.
  if (hits.length > 5) return [{ line: hits[0].line, match: `${hits.length} Title Case headings in this file` }];
  return hits;
}

// "- **Performance:** Performance is fast." The label comes back in the first three words of
// the detail. A label followed by new detail ("- **Discord**: join the server") is fine, and so
// is a name the detail repeats with its capital ("**Tetris Chat:** the streamer plays Tetris")
// or quotes ("**Leave prompt:** "Leave site?" only shows...").
function restatedLabels(text) {
  const hits = [];
  text.split("\n").forEach((line, i) => {
    const m = /^\s*(?:[-*+]|\d+\.)\s+\*\*([^*]+?)(?::\*\*|\*\*:)\s*(.*)$/.exec(line);
    if (!m) return;
    const label = m[1].toLowerCase().match(/[a-z][a-z-]{3,}/g) ?? [];
    const detail = m[2].replace(/"[^"]*"|'[^']*'|`[^`]*`/g, " ");
    const words = detail.split(/\s+/).filter(Boolean);
    const lead = words.slice(0, 3).map((w) => w.toLowerCase().replace(/[^a-z-]/g, ""));
    const isName = (w) => words.slice(1).some((d) => d.replace(/[^A-Za-z-]/g, "").toLowerCase() === w && /^[A-Z]/.test(d.replace(/^[^A-Za-z]+/, "")));
    if (label.some((w) => lead.includes(w) && !isName(w))) hits.push({ line: i + 1, match: m[0].trim().slice(0, 60) });
  });
  return hits;
}

// Curly quotes, ellipses, and arrows, once per line. A chain of arrows ("parse → validate →
// store") is flow notation and stays; a single arrow standing in for "to" is residue.
function typographicResidue(text) {
  const hits = [];
  text.split("\n").forEach((line, i) => {
    const found = [...new Set(line.match(/[“”‘’…→]/g) ?? [])];
    const arrows = (line.match(/→/g) ?? []).length;
    const residue = found.filter((c) => c !== "→" || arrows < 2);
    if (residue.length) hits.push({ line: i + 1, match: residue.join(" ") });
  });
  return hits;
}

// Thematic breaks: `---`, `***`, `___`, their spaced forms, a run of box-drawing dashes, and
// `<hr>`. Front matter fences, setext underlines (text on the line above), table rows, and
// RST overlines are not rules. One or two rules in a file can be real breaks, so they are
// reported only when a heading follows (the heading already separates). From three up the
// file comes back as one hit with the count.
const RULE_LINE = /^\s{0,3}(?:(?:-[ \t]*){3,}|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,}|[─━═]{3,}|={4,}|<hr\b[^>]*>)\s*$/i;
function horizontalRules(text, path) {
  if (/\.adoc$/i.test(path)) return [];
  const lines = text.split("\n");
  let start = 0;
  if (/^---\s*$/.test(lines[0] ?? "")) {
    const end = lines.findIndex((l, i) => i > 0 && /^(?:---|\.\.\.)\s*$/.test(l));
    if (end > 0) {
      // Slide decks (Marp, Slidev, reveal) use `---` between slides.
      if (lines.slice(1, end).some((l) => /^(?:marp|theme|paginate|layout|revealOptions)\s*:/.test(l))) return [];
      start = end + 1;
    }
  }
  const blank = (l) => l === undefined || !l.trim();
  const rules = [];
  for (let i = start; i < lines.length; i++) {
    if (!RULE_LINE.test(lines[i])) continue;
    const html = /<hr\b/i.test(lines[i]);
    if (!html && i > start && !blank(lines[i - 1])) continue;
    if (!html && !blank(lines[i + 1]) && RULE_LINE.test(lines[i + 2] ?? "")) continue;
    const next = lines.slice(i + 1).find((l) => !blank(l));
    rules.push({ line: i + 1, match: lines[i].trim(), beforeHeading: next !== undefined && /^\s{0,3}#{1,6}\s/.test(next) });
  }
  if (rules.length >= 3) return [{ line: rules[0].line, match: `${rules.length} horizontal rules in this file` }];
  return rules.filter((r) => r.beforeHeading).map(({ line, match }) => ({ line, match }));
}

// Sentences that end in "!", once per file from three up. One is a voice; a page of them
// is enthusiasm standing in for content.
function exclamations(text) {
  const hits = [];
  text.split("\n").forEach((line, i) => {
    for (const m of line.matchAll(/[A-Za-z)]!+(?=\s|$|["')*_])/g)) hits.push({ line: i + 1, match: m[0] });
  });
  return hits.length >= 3 ? [{ line: hits[0].line, match: `${hits.length} exclamation marks in this file` }] : [];
}

export default [
  { id: "text-1", title: "Inflated significance", files, prose: true,
    pattern: /\b(?:plays? an? (?:crucial|pivotal|key|vital|significant|central|important) role|marks? an? (?:significant|major|important|key) (?:milestone|step|shift)|in today's (?:fast-paced|digital|modern|ever-changing|rapidly evolving)|stands? as an? (?:testament|reminder)|a testament to|cannot be overstated|at the forefront of|paves? the way|watershed moment|(?:lasting|enduring|indelible) (?:impact|legacy|mark)|rich (?:cultural )?heritage|garnered (?:significant|considerable|widespread) attention)\b/i },
  { id: "text-2", title: "Trailing -ing commentary", files, prose: true,
    pattern: /[,—]\s*(?:ensuring|highlighting|underscoring|showcasing|reflecting|emphasi[sz]ing|fostering|demonstrating|illustrating|cementing|solidifying|reinforcing|making it (?:easier|possible|ideal))\b/i },
  { id: "text-3", title: "Vague attribution", files, prose: true,
    pattern: /\b(?:(?:experts|researchers|studies|critics|observers|many (?:developers|users|people|experts)|industry (?:reports|experts)|some)\s+(?:say|said|suggest|believe|argue|agree|have shown|show|note|find)|it is widely (?:believed|accepted|known|regarded))\b/i },
  { id: "text-5", title: "Promotional register", files, prose: true, filter: asName,
    pattern: /\b(?:seamless(?:ly)?|robust|powerful|cutting[- ]edge|state[- ]of[- ]the[- ]art|game[- ]chang(?:er|ing)|revolutionary|revolutioni[sz]e[sd]?|world[- ]class|best[- ]in[- ]class|next[- ]gen(?:eration)?|blazing(?:ly)?[- ]fast|lightning[- ]fast|effortless(?:ly)?|supercharge[sd]?|unlock(?:s|ing)? (?:the (?:power|potential|full)|your|new (?:possibilities|levels|opportunities)|(?:true|full) potential)|unleash(?:es|ing)?|elevate[sd]?|empower(?:s|ing)?|turbocharge[sd]?)\b/i },
  { id: "text-7", title: "Preview or recap", files, prose: true,
    pattern: /\b(?:in conclusion|in summary|to sum up|to summari[sz]e|all in all|in this (?:guide|article|post|tutorial|section|document|readme),? (?:we|you)(?:'ll| will)|this (?:guide|article|post|tutorial) (?:will|aims to)|here are (?:the )?(?:\d+|three|four|five|six|seven|ten) (?:key |main |top |simple |quick )?(?:reasons|ways|tips|things|takeaways|lessons|steps)|(?:\d+|three|four|five|seven) key (?:takeaways|insights|points|lessons))\b|(?:^|\.\s+)Overall,/i },
  { id: "text-8", title: "Signposting or setup", files, prose: true,
    pattern: /\b(?:let's (?:dive|delve|explore|take a (?:closer )?look|break (?:it|this) down|get started)|let's (?:unpack|examine|be clear about)|here's the (?:thing|kicker|catch|deal|best part|problem)|here's (?:what (?:I mean|stood out|caught my eye|(?:is|'s) interesting|I find interesting)|why (?:that|this|it) matters)|this is where (?:it|things) gets? interesting|without further ado|buckle up|plot twist|spoiler(?: alert)?:|hot take|unpopular opinion|think about it(?: this way)?[:.]|the (?:short|long) answer is|(?:the )?(?:bottom line|key takeaway|answer)(?: is)?:|what does this mean for|why should you care\?|so,? what's next\?)\b|\b(?:The (?:result|catch|kicker|best part|answer|twist|secret)|Why does this matter)\?/i },
  { id: "text-9", title: "Generic closer", files, prose: true,
    pattern: /\b(?:the future (?:looks|is) bright|the possibilities are endless|only time will tell|happy (?:coding|hacking|building)|stay tuned|the sky's the limit)\b/i },
  { id: "text-10", title: "AI vocabulary", files, prose: true, filter: asName,
    pattern: /\b(?:delv(?:e|es|ed|ing)|leverag(?:e|es|ed|ing)|utili[sz](?:e|es|ed|ing|ation)|facilitat(?:e|es|ed|ing)|pivotal|paramount|crucial|holistic|intricate|intricacies|nuanced|multifaceted|tapestry|embark(?:s|ed|ing)?|foster(?:s|ed|ing)?|bolster(?:s|ed|ing)?|cultivat(?:e|es|ed|ing)|testament|underscor(?:e|es|ed|ing)|showcas(?:e|es|ed|ing)|streamlin(?:e|es|ed|ing)|meticulous(?:ly)?|vibrant|bustling|ever[- ]evolving|paradigm|synerg(?:y|ies)|north star|elucidat(?:e|es|ed|ing)|delineat(?:e|es|ed|ing)|underpin(?:s|ned|ning)?|unveil(?:s|ed|ing)?|invaluable|noteworthy|garner(?:s|ed|ing)?|spearhead(?:s|ed|ing)?|treasure trove|shed(?:s|ding)? (?:new )?light on|holds? (?:great |immense |significant )?promise|double-edged sword|at the intersection of|deep dive|comprehensive|navigat(?:e|es|ing) the|enhanc(?:e|es|ed|ing))\b/i },
  { id: "text-10", title: "AI vocabulary", files, prose: true, filter: asName,
    pattern: /\b(?:today's|current|competitive|digital|tech(?:nology)?|business|evolving|ever-changing|modern|software|AI|security|regulatory|market|media|political|cultural|economic|developer|frontend|JavaScript)\s+landscape\b|\blandscape of\b|\brealm of\b/i },
  { id: "text-11", title: "Copula dodging", files, prose: true,
    pattern: /(?<!\bto )\b(?:serves?|serving|stands?) as\b|\bboast(?:s|ing)?\b/i },
  { id: "text-12", title: "Negative parallelism", files, prose: true,
    pattern: /\bnot (?:just|only|merely|simply) [^.,;:!?]{1,60}?,?\s+but(?: also)?\b|\b(?:it|this)(?:'s| is) not (?:just )?(?:about )?[^.;!?]{1,50}?[.,;—–-]+\s*(?:it|this)(?:'s| is)\b|\bisn't (?:just )?about\b|\bNot because [^.!?]{1,70}[.!?]\s+Because\b|\b(?:isn't|is not|aren't) the (?:problem|point|issue|goal|hard part)\.\s+[A-Z]/i },
  { id: "text-15", title: "False range", files, prose: true,
    pattern: /\b(?:whether you(?:'re| are) an? [^,.]{1,40}? or an? |from (?:startups|beginners|small businesses|hobbyists|individuals|solo developers) to (?:enterprises|experts|large (?:enterprises|organi[sz]ations|teams))|for everyone from)/i },
  { id: "text-16", title: "Hedge stack", files, prose: true,
    pattern: /\b(?:(?:could|might|may) (?:potentially|possibly|perhaps)|it (?:could|can|might) be argued|arguably|to some extent)\b/i },
  { id: "text-17", title: "Filler phrase", files, prose: true,
    pattern: /\b(?:in order to|due to the fact that|it is (?:important|worth|crucial|essential) to (?:note|mention|remember|understand)|it's (?:important|worth) (?:noting|mentioning|remembering)|it should be noted|when it comes to|a (?:wide|broad|diverse) (?:range|variety|array) of|at the end of the day|at its core|in essence|generally speaking|the reality is|it goes without saying|all things considered|in a world where|in an era of|(?:is|are|was|were) able to|ha(?:s|ve) the ability to|at this point in time|in the event that|the vast majority of|in terms of|for all intents and purposes|needless to say|first and foremost)\b/i },
  { id: "text-18", title: "Intensifier", files, prose: true, filter: asName,
    pattern: /\b(?:truly|incredibly|extremely|remarkably|undeniably|absolutely|exceptionally|tremendously|profoundly|fundamentally|genuinely|highly (?:scalable|performant|efficient)|super (?:easy|simple|fast))\b/i },
  { id: "text-19", title: "Em dash", files, prose: true, pattern: /(?<!\|[ \t]*)—|—(?![ \t]*\|)|\s–\s|\s--\s/ },
  { id: "text-20", title: "Staccato fragments", files, prose: true,
    pattern: /\b(?:No|Zero) [\w-]+(?: [\w-]+)?\. (?:No|Zero|Just) [\w-]+|(?:^|\s)(?:[A-Z][a-z]+\.\s+){2}[A-Z][a-z]+\.(?:\s|$)|\bAnd that's (?:okay|ok|fine)\.|\bThat's it\. That's\b/ },
  { id: "text-25", title: "Inline-header list item", files, prose: true, check: restatedLabels },
  { id: "text-26", title: "Title Case heading", files, prose: true, check: titleCaseHeadings },
  { id: "text-27", title: "Decorative emoji", files, prose: true,
    pattern: /^\s*(?:#{1,6}|[-*+]|\d+\.)\s.*?\p{Extended_Pictographic}/u,
    filter: (m, line) => !/[©®™]$/.test(m) && (LIST_ITEM.test(line) || /^#{1,6}\s/.test(line)) },
  { id: "text-28", title: "Typographic residue", files, prose: true, check: typographicResidue },
  { id: "text-30", title: "Chatbot residue", files, prose: true,
    pattern: /\b(?:Certainly|Of course|Absolutely|Sure)!|\b(?:great question|good question|i hope this helps|hope this helps|let me know if|feel free to|happy to help|i'd be happy to|you're absolutely right|let me think step by step|here's my thought process|to answer your question|you're asking about)\b/i },
  { id: "text-31", title: "Model disclaimer", files, prose: true,
    pattern: /\b(?:as an ai\b|as an? (?:ai )?language model|as of my (?:last|latest) (?:update|training)|my knowledge cutoff|based on my training data|i (?:don't|do not) have (?:access to|the ability to) (?:real-time|browse))/i },
  { id: "text-32", title: "Placeholder", files, prose: true,
    pattern: /\[(?:your|insert|company|product|name|date|link|author)\b[^\]]*\]|\blorem ipsum\b|\bexample\.com\b/i },
  { id: "text-32", title: "Placeholder", files, prose: true, pattern: /\b(?:TBD|TODO|FIXME|XXX)\b/ },
  { id: "text-34", title: "Diagram for a list", files,
    pattern: /^\s*(?:```|~~~)\s*mermaid\b|^\s*[┌╔][─═]{3,}|^\s*\+[-=]{3,}\+(?:[-=]{3,}\+)*\s*$/ },
  { id: "text-36", title: "Manufactured emphasis", files, prose: true,
    pattern: /(?:^|[.!?]\s+)(?:Full stop|Period)\.(?=\s|$)|\b(?:let that sink in|read that again|make no mistake|this matters because|the (?:honest|uncomfortable|hard|simple|brutal|sad) truth|the truth is,|let me be clear|let's be (?:real|honest|clear)|to be (?:honest|frank|fair),|i'm going to be honest|trust me|believe me|what (?:nobody|no one) tells you|(?:nobody|no one)(?: is|'s)? talk(?:s|ing) about|(?:everyone|everybody)(?: is|'s) missing|it's no secret that)\b/i },
  { id: "text-37", title: "False agency", files, prose: true,
    pattern: /\b(?:numbers|data|results|figures|facts|metrics|stats|statistics) (?:speaks?|tells?|paints?) (?:for (?:itself|themselves)|a (?:\w+ )?(?:story|picture|tale))|\bpaints? a (?:clear|vivid|stark|bleak|grim|rosy|compelling|different) picture\b|\btells? a (?:clear|compelling|different|similar|powerful) story\b/i },
  { id: "text-38", title: "False balance", files, prose: true,
    pattern: /\b(?:While|Although) [^.!?]{3,90}?, [^.!?]{0,70}?\b(?:remains? (?:a challenge|an open question|to be seen|unclear)|(?:is|are) still (?:a challenge|an open question|early))|\bon (?:the )?one hand\b|\bit remains to be seen\b|\bboth (?:sides|approaches|options) have (?:their )?(?:merits?|pros and cons|strengths)\b|\bthere(?:'s| is) no (?:one-size-fits-all|single right|right or wrong|silver bullet)\b|\b(?:it|the (?:right )?(?:choice|answer|decision)) (?:ultimately |really )?depends on your (?:specific )?(?:needs|use case|requirements|goals)\b/i },
  { id: "text-39", title: "Exclamation marks", files, prose: true, check: exclamations },
  { id: "text-41", title: "Stock outline", files, prose: true,
    pattern: /^#{1,6}\s+(?:\d+[.)]\s+)?(?:Conclusions?|Final Thoughts|Closing Thoughts|Key Takeaways|Wrapping (?:It )?Up|Looking Ahead|The Road Ahead|The Bottom Line|The Future of\b.*|Challenges and (?:Future|Opportunities|Considerations)\b.*)\s*$/i },
  { id: "text-35", title: "Horizontal rule", files, prose: true, check: horizontalRules },
  { id: "text-33", title: "Stacked connective", files, prose: true,
    pattern: /(?:^(?:\s*[-*+]\s+)?|[.!?]\s+)(?:Additionally|Furthermore|Moreover|Importantly|Ultimately|That being said|With that said),/ },
];
