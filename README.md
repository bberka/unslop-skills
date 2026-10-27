# unslop-skills

Agent skills that find and remove AI slop: patterns that mark text, interfaces, commits, tests, and code as generated without judgment. Each skill pairs a catalog of **tells** (stable ids such as `text-10` or `cs-2`) with scripts that find the lexical ones, so the agent spends its reading on the tells a regex can't see.

| Skill | Covers | Scripts |
| --- | --- | --- |
| `unslop-text` | Docs, READMEs, posts, emails, code comments | `scan.mjs` |
| `unslop-ui` | Interfaces, landing pages, mockups, screenshots | `scan.mjs`, `tokens.mjs` (design-token inventory) |
| `unslop-git` | Writing new commit messages, auditing and rewording history | `lint-msg.mjs`, `reword.mjs` |
| `unslop-typescript` | TypeScript and JavaScript code | `scan.mjs` (plus `knip` and `jscpd` via `npx`) |
| `unslop-react` | React components, hooks, near-duplicate components | `scan.mjs`, `inventory.mjs` |
| `unslop-csharp` | C# and .NET code | `scan.mjs`, `dead-code.mjs` |
| `unslop-tests` | Test suites in JS/TS, C#, Python, and Go | `scan.mjs` |
| `unslop-all` | Runs the applicable skills in order, one pass per skill, on a review branch when the user wants one | `detect.mjs` |

## How the skills call each other

```
unslop-all
├── unslop-tests
├── unslop-typescript ── unslop-react ── unslop-ui ── unslop-text (UI copy)
├── unslop-csharp
├── unslop-ui            (only when the UI isn't React: Vue, Svelte, Razor, plain HTML/CSS)
├── unslop-text          (docs)
└── unslop-git           (last, so it can also describe the passes)
```

`unslop-all` plans its passes from the files inside the chosen scope (a folder, a file, the branch's changes, or the whole repo), so a docs folder gets only `unslop-text` and a backend folder never reaches `unslop-react`. Every skill also checks its own scope and stops with "nothing in scope" when it has no files to work on.

Skills reach each other by name, falling back to the sibling folder (`../unslop-ui/`), so install them together.

## Install

```bash
npx skills add bberka/unslop-skills
```

To install by hand, copy each folder under `skills/` into your agent's skills directory (`~/.agents/skills/`, `~/.claude/skills/`, or the project's `.claude/skills/`).

Scripts need Node 20 or later, and `reword.mjs` needs git 2.38 or later. The language skills also use tools the project may already have: `npx knip` and `npx jscpd` for TypeScript, and the .NET SDK for C#.

## Using them

Ask in plain words: "unslop this README", "unslop the tests", "unslop the whole repo". Or name the skill: `/unslop-react src/components`.

Every code skill follows the same contract:

1. Record a baseline (build, typecheck, lint, tests).
2. Scan with the scripts, then read every file in scope for the tells no script can see.
3. Fix in batches as behavior-preserving refactors, rechecking after each batch.
4. List anything that changes public API, runtime behavior, or architecture as a proposal instead of applying it.
5. Report fixed, proposed, and kept findings by tell id.

Documented repo standards (lint config, `.editorconfig`, `CONTRIBUTING.md`) override any tell, with one exception: `unslop-git` removes AI tool attribution (`Co-authored-by` trailers and "Generated with" footers) whatever the history does, and never adds it.

### Change ledger and HTML report

Every skill records what it changed, kept, or proposed in `.unslop/ledger.jsonl`, one entry per change, with the tell id, the reason, and the evidence that made the change safe (`rg getUser: 0 callers`, `knip: unused file`, `mutation: test stayed green`). `ledger.mjs` rejects a removal without evidence. At the end of a run the skill renders `.unslop/report.html`, a single file that needs nothing else to open, with:

- every change grouped by file, with its tell, reason, evidence, and git diff
- deleted files, kept findings, and proposals waiting for a decision
- the files that changed with no ledger entry, so an unexplained change stands out
- filters by skill, action, tell, and text

`ledger.mjs start` records the commit a run begins from, and the report diffs against it. Starting a new run moves the previous ledger and report into `.unslop/history/`. The folder is added to `.git/info/exclude`, so it stays out of commits without touching the project's `.gitignore`.

### Silencing a hit

The scanners skip a line containing `unslop-ignore` and a file containing `unslop-ignore-file`. To leave out a whole area (a folder the project's `AGENTS.md` reserves for its owner, generated code), pass `--exclude <path>` to any scanner or to `detect.mjs`. Agent tooling folders (`.claude/`, `.agents/`, `.cursor/`) are never scanned as project code. The text scanner also skips changelogs (`CHANGELOG`, `HISTORY`, `RELEASE_NOTES`) on a directory walk, since release tooling writes those; naming one explicitly scans it.

### Commit-message hook

`lint-msg.mjs` works as a `commit-msg` hook:

```bash
#!/bin/sh
node ~/.agents/skills/unslop-git/scripts/lint-msg.mjs --check "$1"
```

## Development

```bash
npm test        # fixture tests for every script, plus a check that scanner copies are in sync
npm run sync    # copy shared/scan.mjs into every skill
```

Each skill installs on its own, so shared scripts are vendored. `shared/scan.mjs` is copied into every skill that has a `scripts/rules.mjs`, and `shared/ledger.mjs` and `shared/report.mjs` into every skill, by `tools/sync.mjs`. Edit the shared copies only.

To add a tell:

1. Add it to the skill's `TELLS.md` with the next free id. Ids are never reused or renumbered.
2. If a regex can find it, add a rule to `scripts/rules.mjs` (the rule shape is documented at the top of `shared/scan.mjs`) and mark the tell **(L)**.
3. Add a line that triggers it to the slop fixture in `fixtures/<skill>/`, then run `npm test`. The clean fixture must stay silent.
