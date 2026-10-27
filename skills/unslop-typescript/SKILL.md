---
name: unslop-typescript
description: "Finds and removes AI slop in TypeScript and JavaScript code: any-casts, impossible-state guards, catch-and-log, forwarding layers, speculative abstractions, duplication, dead code, narrating comments. Hands React code on to unslop-react. Use when the user asks to unslop, de-slop, or clean up a TS/JS codebase, or to audit one for slop."
---

# Unslop TypeScript

Slop is code that exists because generating it was cheap, not because the program needs it. Examples are guards for states the types rule out, layers that only forward calls, copies of logic that already exists, and comments that repeat the code. Apply the **deletion test** to anything flagged: if deleting or inlining it changes no behavior and costs a reader no information, it is slop.

Each tell has a stable id (`ts-12`) in [TELLS.md](TELLS.md). Every fix is a **refactor**: behavior and public API stay identical, and the checks stay green. Documented repo standards (lint config, `CONTRIBUTING.md`, ADRs) override any tell.

## Workflow

1. **Scope.** Use the paths the user named, or the scope passed by the skill that invoked this one. Otherwise ask whether to cover this branch's changes (`git diff --name-only <default-branch>...HEAD`) or the whole repo. If the scope holds no TS or JS source files outside tests, report "nothing in scope" and stop.
2. **Baseline.** Run the project's typecheck (`tsc --noEmit` or its script), lint, and tests, and record the results. Start from a clean worktree so every change shows in one `git diff`. Done when all three results are written down, including failures that already existed. Those failures are reported, not fixed.
3. **Load the tells.** Read [TELLS.md](TELLS.md) in full.
4. **Scan.**
   - Run `node scripts/scan.mjs <paths>` for lexical tells, with `--exclude <path>` for each excluded area. It reads the `<script>` blocks of `.svelte`, `.vue`, and `.astro` files, and skips tests, e2e suites, and declaration files.
   - Run `npx knip` for dead files, exports, and dependencies (`ts-15`), from the repo root so imports between workspaces count. Without a `knip` config in the repo, its unused-export list is a candidate list, not a verdict: each removal needs a whole-repo `rg -w <name>` with no consumer left, and that search is its ledger evidence.
   - Run `npx jscpd --min-tokens 50 --format "typescript,tsx,javascript,jsx" <paths>` for clones (`ts-14`). It respects `.gitignore` by default.
   - Then read every file in scope for the tells no tool sees: `ts-5`, `-6`, `-8`, `-12`, `-13`, `-16`, `-21`. Start with the files that have the most hits.

   Done when every file is read and every hit is judged.
5. **Fix in batches,** with the smallest blast radius first:
   1. Residue: `ts-18`, `ts-19`, `ts-20`.
   2. Local idioms: `ts-1` to `ts-4`, `ts-7`, `ts-9` to `ts-11`.
   3. Structure: `ts-5`, `ts-6`, `ts-12` to `ts-17`.

   After each batch, run typecheck and tests. If a batch goes red, fix it or revert it and record why. When you delete dead code, delete the tests that only exercised it.
6. **Propose instead of fixing** anything that changes exported API used outside the package, runtime behavior at a trust boundary (input, network, storage), dependencies, or architecture. List these with the reason.
7. **React.** If the scope holds `.tsx` or `.jsx` files, or modules that import `react`, run the `unslop-react` skill (sibling folder `../unslop-react/`) on the same scope. That skill runs `unslop-ui` in turn.
8. **Verify.** Typecheck, lint, and tests match the baseline. Rerun the scanners; every remaining hit is a keep you can justify. `node scripts/report.mjs` lists no file under "Changed with no ledger entry".

## Ledger

Unless another skill invoked this one, run `node scripts/ledger.mjs start` before the first change. It records the starting commit, which the report diffs against, and archives any earlier run. Then record every change, keep, and proposal as you make it, with `node scripts/ledger.mjs add` (`--help` lists the fields):

```
node scripts/ledger.mjs add --skill unslop-typescript --tell ts-12 --action remove \
  --file src/api/users.ts --line 40 --what "getUser wrapper around api.getUser" \
  --why "Forwards to api.getUser unchanged" --evidence "rg getUser: 3 callers migrated; tsc and tests green"
```

Actions are `remove`, `delete-file`, `rewrite`, `merge`, `move`, `keep`, and `propose`. The first five need `--evidence`: the command or check that showed the change was safe. One mechanical fix repeated in one file shares an entry with `--count`. Unless another skill invoked this one, finish with `node scripts/report.mjs` and give the user the path to `.unslop/report.html`. It shows every change with its reason, evidence, and diff, and lists any changed file that has no entry.

## Report

```
## unslop-typescript
Fixed:    ts-18 x41, ts-1 x12, ts-12 x5 ...   (one line per notable fix: path:line  id  what)
Proposed: path:line  ts-13  what  ->  suggested change  (why it needs a decision)
Kept:     path:line  ts-3   reason
Checks:   typecheck ok, lint ok, tests 212/212 (baseline 212/212)
```
