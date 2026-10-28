---
name: unslop-text
description: "Rewrites prose to strip AI tells: inflated vocabulary, filler, em dashes, previews and recaps, chatbot residue, over-formatting. Use when the user asks to unslop, de-AI, or humanize text, docs, READMEs, posts, emails, or code comments."
---

# Unslop text

A **tell** is a pattern that marks text as machine-written. Each tell has a stable id (`text-10`) defined in [TELLS.md](TELLS.md). Findings and reports cite the ids.

The rewrite changes how the text says things and keeps what it says: every fact, number, name, link, code span, quotation, and the author's register survive.

## Workflow

1. **Scope.** Use the pasted text or the files the user named. If another skill invoked this one, use the scope it passed. For "the docs" or "the repo", scan the directory: the scanner limits itself to `.md`, `.mdx`, `.txt`, `.rst`, and `.adoc` files, skips dependency and build folders, and skips changelogs (release tooling writes those; name one explicitly to scan it). Done when you have a file list or the pasted text. If the scope holds no prose (no files the scanner covers, and no comments or strings the user pointed at), report "nothing in scope" and stop.
2. **Load the tells.** Read [TELLS.md](TELLS.md) in full. Every tell applies on every run.
3. **Scan.** Run `node scripts/scan.mjs <paths>`. For pasted text, write it to a temp `.md` file first. The scanner only finds lexical tells (marked **(L)**). Next, read every paragraph for the tells it can't see: `text-4`, `-6`, `-13`, `-14`, `-21`, `-22`, `-23`, `-24`, `-29`. Done when every paragraph has been read and every hit has a verdict: a tell to fix, or a deliberate keep you can name (a quotation, a term of art like `robust` in statistics, a product name).
4. **Rewrite.** Work one paragraph at a time.
   - Apply each tell's fix. When a fix needs a fact you don't have (a benchmark for `text-6`, a source for `text-3`), list it as an open question. Keep the original claim out of the rewrite until it is answered.
   - Leave code blocks, inline code, front matter, link targets, and quoted material byte-for-byte.
   - In Markdown, changing a heading's case keeps its anchor, but rewording it breaks inbound links. Search the repo for `#anchor` links before you reword a heading.
5. **Verify.** Run the scanner again. Done when every remaining hit is one of the keeps named in step 3, and every fact, number, and link from the original still appears in the rewrite. `node scripts/report.mjs` lists no file under "Changed with no ledger entry".

## Ledger

Unless another skill invoked this one, run `node scripts/ledger.mjs start` before the first change. It records the starting commit, which the report diffs against, and archives any earlier run. Record every change, keep, and proposal in batches: after each fix batch (and once for the keeps and proposals), write all its entries in one call, one JSON line per entry (`--help` lists the fields):

```
node scripts/ledger.mjs import - --skill unslop-text <<'EOF'
{"tell":"text-6","action":"remove","file":"docs/intro.md","line":12,"what":"\"10x faster\" claim","why":"No benchmark backs it","evidence":"no benchmark in the repo; asked the user for a source"}
{"tell":"text-19","action":"rewrite","file":"docs/intro.md","count":7,"why":"Em dashes","evidence":"scan.mjs: 0 text-19 hits after"}
EOF
```

Actions are `remove`, `delete-file`, `rewrite`, `merge`, `move`, `keep`, and `propose`. The first five need `evidence`: the command or check that showed the change was safe. One mechanical fix repeated in one file shares an entry with `count`. An invalid entry rejects the whole batch with its number, so fix it and resend the batch. Unless another skill invoked this one, finish with `node scripts/report.mjs` and give the user the path to `.unslop/report.html`. It shows every change with its reason, evidence, and diff, and lists any changed file that has no entry. When the user or the invoking skill asks for a report only, record each finding as `propose` with its fix in `what`, change no file, skip the fix and verify steps, and pass the same instruction to any skill this one invokes.

## Report

- Pasted text: reply with the rewritten text, followed by one line per open question.
- Files: edit them in place. For each file, list the tell ids you fixed with counts, then the open questions.

## Scope notes

- Commit messages belong to the `unslop-git` skill and code identifiers to the language skills. In code files, this skill rewrites comment and docstring text only.
- UI copy (buttons, empty states, errors) also follows the copy rules in `unslop-ui`'s `ui-20`. When `unslop-ui` invokes this skill, apply both.
