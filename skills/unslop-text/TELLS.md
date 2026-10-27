<!-- unslop-ignore-file -->
# Text tells

Ids are stable: other skills and reports cite them, and a retired tell leaves a gap. Each entry gives the tell, an example, and the fix. **(L)** marks the tells `scripts/scan.mjs` can find; the rest need reading.

## Content

- **text-1 Inflated significance (L).** "plays a pivotal role", "marks a significant milestone", "in today's fast-paced world", "stands as a testament to". Fix: state what happened and to whom, or cut.
- **text-2 Trailing -ing commentary (L).** A clause tacked on after a comma or dash to interpret the sentence: ", ensuring a smooth experience", ", highlighting its importance". Fix: delete it, or make it a sentence with a real subject and evidence.
- **text-3 Vague attribution (L).** "Experts say", "studies show", "many developers find". Fix: name the source and link it, or cut the claim.
- **text-4 Feeling instead of fact.** "SQL you can read", "the API stays out of your way". Fix: name the mechanism or the number ("`.toSQL()` returns the exact query sent"). If a sentence could appear unchanged in another project's docs, it says nothing about this one. Cut it.
- **text-5 Promotional register (L).** seamless, robust, powerful, cutting-edge, game-changing, blazing fast, effortless, supercharge, "unlock the power of", unleash, elevate, empower. Fix: the plain claim with its evidence, or nothing. A capitalized word mid-sentence is a name ("Robust mode"), so the scanner skips it; "unlock" as a game or feature mechanic ("gifts unlock a skin") is plain speech.
- **text-6 Unbacked claims.** "production-ready", "10x faster", "secure by default" with no benchmark, test, or source. Fix: attach the evidence. If you lack it, flag it to the user; never invent a number.
- **text-7 Previews and recaps (L).** "In this guide, we'll explore…", "In conclusion", "In summary", "Overall,". Fix: start with the first useful sentence and stop after the last one.
- **text-8 Signposting and setups (L).** "Let's dive in", "Here's the thing:", "The result?", "The best part?", "without further ado". Fix: state the point.
- **text-9 Generic closers (L).** "The future looks bright", "the possibilities are endless", "Happy coding!". Fix: end on a specific next step or fact, or end earlier.

## Language

- **text-10 AI vocabulary (L).** "Landscape" and "realm" count only in the abstract sense ("the AI landscape", "the realm of"); screen orientation and scenery are plain words. Replace each tell with the plain word:

  | Tell | Plain |
  | --- | --- |
  | delve into, dive into | look at, cover |
  | leverage, utilize | use |
  | facilitate, empower, enable (vaguely) | help, let |
  | crucial, vital, pivotal, paramount | important, or say why it matters |
  | comprehensive, holistic | complete, or list what it covers |
  | intricate, nuanced, multifaceted | complex, or name the parts |
  | landscape, realm, ecosystem, tapestry, journey (abstract) | field, area, the concrete thing |
  | foster, cultivate, bolster, enhance | build, grow, improve, or the specific change |
  | navigate (abstract), embark on | handle, start |
  | testament, underscore, showcase, highlight (verb) | shows |
  | streamline, optimize (vaguely) | the specific change |
  | meticulous, vibrant, bustling, ever-evolving | the specific trait, or cut |
  | paradigm, synergy, north star, game changer | the concrete idea |

- **text-11 Copula dodging (L).** "serves as", "stands as", "acts as", "boasts", "features". Fix: "is", "has". The scanner skips "to serve as", which is usually a real purpose clause.
- **text-12 Negative parallelism (L).** "not just X, but Y", "It's not X. It's Y.", "isn't about X, it's about Y". Fix: state Y.
- **text-13 Forced triads.** Lists of three where the content has two or four, or three near-synonyms ("fast, efficient, and performant"). Fix: the natural count.
- **text-14 Synonym cycling.** The same thing renamed each sentence: "the tool… the utility… the solution". Fix: pick one name and repeat it.
- **text-15 False ranges (L).** "from startups to enterprises", "whether you're a beginner or an expert". Fix: name who it is for, or cut.
- **text-16 Hedge stacks (L).** "could potentially", "may possibly", "it could be argued that". Fix: one hedge where doubt is real, none where it is not.
- **text-17 Filler phrases (L).** "in order to" (to), "due to the fact that" (because), "it is important to note that" (cut), "when it comes to" (for), "a wide range of" (many, or the list).
- **text-18 Intensifiers (L).** truly, incredibly, extremely, seamlessly, remarkably, absolutely. Fix: cut the adverb or use the stronger verb or the number. A capitalized intensifier mid-sentence is part of a name ("Extremely difficult" as a difficulty level) and stays.
- **text-33 Stacked connectives (L).** Sentences opened with "Additionally,", "Furthermore,", "Moreover,", "Ultimately,", "That being said,". One is fine in a long argument; a run of them is padding between points that already follow each other. Fix: delete the connective, or merge the two sentences.

## Rhythm

- **text-19 Em dashes (L).** The scanner reports every em dash, and every spaced en dash or double hyphen used as one. Fix: a period or a comma. Parentheses for a true aside. The keeps are a dash inside quoted material, which the rewrite leaves byte-for-byte anyway, and a dash alone in a table cell as an empty-value placeholder, which the scanner skips.
- **text-20 Staccato fragments (L).** "No config. No boilerplate. Just code." Fix: one sentence with a verb.
- **text-21 Passive voice hiding the actor.** "queries are validated" when the actor matters. Fix: name the actor ("the compiler validates queries").
- **text-22 Dense sentences.** The reader has to backtrack to parse it. Fix: one idea per sentence; split or drop clauses.
- **text-23 Over-compression.** Arrows, dropped articles, verbless fragments: "bad date → exit 2, no write". Fix: whole sentences ("A bad date exits with code 2 and writes nothing").

## Formatting

- **text-24 Bold sprinkling.** Bold on every term, product name, or "key" phrase. Fix: bold at most the one thing a skimmer must not miss.
- **text-25 Inline-header lists (L).** "- **Performance:** Performance improved by 20%": a bold label that the line then restates. The scanner reports a label only when one of its words reappears in the first three words of the detail, outside quotes and not as a capitalized name, so "- **Discord**: join the server" and "- **Tetris Chat:** the streamer plays Tetris" stay silent. Fix: plain bullets or prose. A bold lead-in that names the item and is followed by new detail is fine.
- **text-26 Title Case headings (L).** "Getting Started With The API". Fix: sentence case ("Getting started with the API"). The scanner reports a heading when a small word ("With", "The") is capitalized, or when most of its words appear lowercased in the body (so "Using Visual Studio Code" stays silent). A heading written the same way in the body ("Horse Race" as a game name) is a name and stays silent. More than five such headings in one file come back as one hit, because that is a convention to decide on once, and a repo style guide that mandates Title Case wins.
- **text-27 Decorative emoji (L).** Emoji in headings and bullets (🚀 ✨ 💡 ✅). Fix: remove them.
- **text-28 Typographic residue (L).** Curly quotes, `…`, `→` in plain-text sources (Markdown, comments, commit messages), reported once per line. Fix: straight quotes, `...`, "to". A chain of two or more arrows ("parse → validate → store") is flow notation and stays.
- **text-29 Over-structure.** Headings over a three-paragraph doc, bullets for what is one sentence, nested bullets three deep, a table with one column. Fix: prose until structure helps the reader find something.

## Residue

- **text-30 Chatbot residue (L).** "Certainly!", "Great question!", "I hope this helps", "Let me know if you have questions", "Feel free to". Fix: delete.
- **text-31 Model disclaimers (L).** "As an AI", "as of my last update", "I don't have access to". Fix: delete, or replace with the verified fact.
- **text-32 Placeholders (L).** "[Your Name]", "lorem ipsum", "TBD", "example.com" where a real link belongs. Fix: fill it from the project, or ask the user.
