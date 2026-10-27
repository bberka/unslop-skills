// unslop-ignore-file
// Lexical text tells for scan.mjs. Ids match ../TELLS.md.
const files = /\.(md|mdx|markdown|txt|rst|adoc)$/i;
const SMALL_WORDS = new Set(["with", "from", "into", "onto", "over", "than", "that", "this", "your", "upon", "when"]);

function titleCaseHeadings(text) {
  const hits = [];
  text.split("\n").forEach((line, i) => {
    const m = /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
    if (!m) return;
    const words = m[1].split(/\s+/).slice(1)
      .map((w) => w.replace(/[^A-Za-z]/g, ""))
      .filter((w) => w.length >= 4 && !SMALL_WORDS.has(w.toLowerCase()) && w !== w.toUpperCase());
    if (words.length >= 2 && words.every((w) => /^[A-Z]/.test(w))) hits.push({ line: i + 1, match: m[1] });
  });
  return hits;
}

export default [
  { id: "text-1", title: "Inflated significance", files, prose: true,
    pattern: /\b(?:plays? an? (?:crucial|pivotal|key|vital|significant|central|important) role|marks? an? (?:significant|major|important|key) (?:milestone|step|shift)|in today's (?:fast-paced|digital|modern|ever-changing|rapidly evolving)|stands? as an? (?:testament|reminder)|a testament to|cannot be overstated|at the forefront of|paves? the way)\b/i },
  { id: "text-2", title: "Trailing -ing commentary", files, prose: true,
    pattern: /,\s+(?:ensuring|highlighting|underscoring|showcasing|reflecting|emphasi[sz]ing|fostering|demonstrating|illustrating|cementing|solidifying|reinforcing|making it (?:easier|possible|ideal))\b/i },
  { id: "text-3", title: "Vague attribution", files, prose: true,
    pattern: /\b(?:(?:experts|researchers|studies|critics|observers|many (?:developers|users|people|experts)|industry (?:reports|experts)|some)\s+(?:say|said|suggest|believe|argue|agree|have shown|show|note|find)|it is widely (?:believed|accepted|known|regarded))\b/i },
  { id: "text-5", title: "Promotional register", files, prose: true,
    pattern: /\b(?:seamless(?:ly)?|robust|powerful|cutting[- ]edge|state[- ]of[- ]the[- ]art|game[- ]chang(?:er|ing)|revolutionary|revolutioni[sz]e[sd]?|world[- ]class|best[- ]in[- ]class|next[- ]gen(?:eration)?|blazing(?:ly)?[- ]fast|lightning[- ]fast|effortless(?:ly)?|supercharge[sd]?|unlock(?:s|ing)?|unleash(?:es|ing)?|elevate[sd]?|empower(?:s|ing)?|turbocharge[sd]?)\b/i },
  { id: "text-7", title: "Preview or recap", files, prose: true,
    pattern: /\b(?:in conclusion|in summary|to sum up|to summari[sz]e|all in all|in this (?:guide|article|post|tutorial|section|document|readme),? (?:we|you)(?:'ll| will)|this (?:guide|article|post|tutorial) (?:will|aims to))\b|(?:^|\.\s+)Overall,/i },
  { id: "text-8", title: "Signposting or setup", files, prose: true,
    pattern: /\b(?:let's (?:dive|delve|explore|take a (?:closer )?look|break (?:it|this) down|get started)|here's the (?:thing|kicker|catch|deal|best part)|without further ado|buckle up)\b|\b(?:The (?:result|catch|kicker|best part|answer|twist|secret)|Why does this matter)\?/i },
  { id: "text-9", title: "Generic closer", files, prose: true,
    pattern: /\b(?:the future (?:looks|is) bright|the possibilities are endless|only time will tell|happy (?:coding|hacking|building)|stay tuned|the sky's the limit)\b/i },
  { id: "text-10", title: "AI vocabulary", files, prose: true,
    pattern: /\b(?:delv(?:e|es|ed|ing)|leverag(?:e|es|ed|ing)|utili[sz](?:e|es|ed|ing|ation)|facilitat(?:e|es|ed|ing)|pivotal|paramount|crucial|holistic|intricate|intricacies|nuanced|multifaceted|tapestry|realm|landscape|embark(?:s|ed|ing)?|foster(?:s|ed|ing)?|bolster(?:s|ed|ing)?|cultivat(?:e|es|ed|ing)|testament|underscor(?:e|es|ed|ing)|showcas(?:e|es|ed|ing)|streamlin(?:e|es|ed|ing)|meticulous(?:ly)?|vibrant|bustling|ever[- ]evolving|paradigm|synerg(?:y|ies)|north star|comprehensive|navigat(?:e|es|ing) the|enhanc(?:e|es|ed|ing))\b/i },
  { id: "text-11", title: "Copula dodging", files, prose: true,
    pattern: /\b(?:serves? as|serving as|stands? as|boasts?|boasting)\b/i },
  { id: "text-12", title: "Negative parallelism", files, prose: true,
    pattern: /\bnot (?:just|only|merely|simply) [^.,;:!?]{1,60}?,?\s+but(?: also)?\b|\b(?:it|this)(?:'s| is) not (?:just )?(?:about )?[^.;!?]{1,50}?[.,;—–-]+\s*(?:it|this)(?:'s| is)\b|\bisn't (?:just )?about\b/i },
  { id: "text-15", title: "False range", files, prose: true,
    pattern: /\b(?:whether you(?:'re| are) an? [^,.]{1,40}? or an? |from (?:startups|beginners|small businesses|hobbyists|individuals|solo developers) to (?:enterprises|experts|large (?:enterprises|organi[sz]ations|teams))|for everyone from)/i },
  { id: "text-16", title: "Hedge stack", files, prose: true,
    pattern: /\b(?:(?:could|might|may) (?:potentially|possibly|perhaps)|it (?:could|can|might) be argued|arguably|to some extent)\b/i },
  { id: "text-17", title: "Filler phrase", files, prose: true,
    pattern: /\b(?:in order to|due to the fact that|it is (?:important|worth|crucial|essential) to (?:note|mention|remember|understand)|it's (?:important|worth) (?:noting|mentioning|remembering)|it should be noted|when it comes to|a (?:wide|broad|diverse) (?:range|variety|array) of|at the end of the day|in terms of|for all intents and purposes|needless to say|first and foremost)\b/i },
  { id: "text-18", title: "Intensifier", files, prose: true,
    pattern: /\b(?:truly|incredibly|extremely|remarkably|undeniably|absolutely|exceptionally|tremendously|profoundly|highly (?:scalable|performant|efficient)|super (?:easy|simple|fast))\b/i },
  { id: "text-19", title: "Em dash", files, prose: true, pattern: /—|\s–\s|\s--\s/ },
  { id: "text-20", title: "Staccato fragments", files, prose: true,
    pattern: /\b(?:No|Zero) [\w-]+(?: [\w-]+)?\. (?:No|Zero|Just) [\w-]+|(?:^|\s)(?:[A-Z][a-z]+\.\s+){2}[A-Z][a-z]+\.(?:\s|$)/ },
  { id: "text-25", title: "Inline-header list item", files, prose: true,
    pattern: /^\s*(?:[-*+]|\d+\.)\s+\*\*[^*]+?(?::\*\*|\*\*:)/ },
  { id: "text-26", title: "Title Case heading", files, prose: true, check: titleCaseHeadings },
  { id: "text-27", title: "Decorative emoji", files, prose: true,
    pattern: /^\s*(?:#{1,6}|[-*+]|\d+\.)\s.*?\p{Extended_Pictographic}/u,
    filter: (m) => !/[©®™]$/.test(m) },
  { id: "text-28", title: "Typographic residue", files, prose: true, pattern: /[“”‘’…→]/ },
  { id: "text-30", title: "Chatbot residue", files, prose: true,
    pattern: /\b(?:Certainly|Of course|Absolutely|Sure)!|\b(?:great question|good question|i hope this helps|hope this helps|let me know if|feel free to|happy to help|i'd be happy to|you're absolutely right)\b/i },
  { id: "text-31", title: "Model disclaimer", files, prose: true,
    pattern: /\b(?:as an ai\b|as an? (?:ai )?language model|as of my (?:last|latest) (?:update|training)|my knowledge cutoff|i (?:don't|do not) have (?:access to|the ability to) (?:real-time|browse))/i },
  { id: "text-32", title: "Placeholder", files, prose: true,
    pattern: /\[(?:your|insert|company|product|name|date|link|author)\b[^\]]*\]|\blorem ipsum\b|\bexample\.com\b/i },
  { id: "text-32", title: "Placeholder", files, prose: true, pattern: /\b(?:TBD|TODO|FIXME|XXX)\b/ },
];
