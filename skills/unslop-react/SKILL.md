---
name: unslop-react
description: "Finds and removes AI slop in React code: near-duplicate components, effects for derived state, props copied into state, boolean soup, memo theater, god components. Then runs unslop-ui. Use when the user asks to unslop, dedupe, or clean up React components, hooks, or a React or Next.js codebase."
---

# Unslop React

React slop comes in two kinds. The first is code that fights the framework: effects that recompute what render could compute, state that copies props, memoization nobody measured. The second is components generated one at a time, so the codebase ends up with five buttons and three modals that each almost match. Apply the **deletion test**: if removing or merging it changes no behavior, it is slop.

Each tell has a stable id (`react-9`) in [TELLS.md](TELLS.md). Fixes are **refactors**: behavior and public props stay identical, and checks stay green. Documented repo standards override any tell.

## Workflow

1. **Scope and baseline.** Use the scope the user named or the invoking skill passed. If `unslop-typescript` invoked this skill, reuse its baseline. Otherwise ask for scope (this branch's changes or the whole repo), then record typecheck, lint, and test results from a clean worktree. If the scope holds no React code (no `.jsx` or `.tsx` files and no modules importing `react`), report "nothing in scope" and stop.
2. **Load the tells.** Read [TELLS.md](TELLS.md) in full.
3. **Learn the project's patterns.** The right fix depends on them. Find out:
   - The React version. React 19 passes `ref` as a prop, so `forwardRef` is not needed.
   - The data layer (TanStack Query, SWR, server components, loaders).
   - The class helper (`cn`, `clsx`, `cva`, `tv`).
   - Whether React Compiler is on (`babel-plugin-react-compiler`, `reactCompiler` in the Next config).
   - The design-system folder.

   Done when you can name each one, or state that it is absent.
4. **Inventory and scan.**
   - Run `node scripts/inventory.mjs <paths>`. It lists components by size, groups the ones sharing a role suffix (`PrimaryButton`, `SubmitButton`), and shows names defined twice and the design-system folders. `--json` lists every member of a group.
   - Run `node scripts/scan.mjs <paths>` for lexical tells.
   - Run `npx jscpd --min-tokens 40 --format "tsx,jsx" --similarity <paths>`. The token clones are copy-pasted JSX; the `similar` clones are components that differ only in names and literals. It respects `.gitignore` by default.
5. **Judge duplicates.** For every inventory group and clone pair, open the members side by side and decide: merge into one component with variants, replace with the design-system component, or keep (with the behavioral difference that justifies it). Then read every component in scope for the tells no tool sees: `react-3`, `-6`, `-9`, `-13` to `-16`. Done when every group and every hit has a verdict.
6. **Fix in batches,** with the smallest blast radius first:
   1. JSX: `react-17` to `react-20`.
   2. State and effects: `react-1` to `react-7`.
   3. Memoization: `react-8`.
   4. Components: `react-9` to `react-16`.

   To merge duplicates, keep the API of the most-used member, migrate every call site, and delete the rest. After each batch, run typecheck and tests. State and effect changes can shift render timing, so click through the affected screens when a browser is available.
7. **Propose instead of fixing** anything that changes a shared component's public props across packages, swaps the data layer, or moves the client/server boundary. List these with the reason.
8. **UI layer.** If the scope holds markup or styles, run the `unslop-ui` skill (sibling folder `../unslop-ui/`) on the same scope. A scope of hooks and logic alone has no UI layer.
9. **Verify.** Checks match the baseline. Rerun the inventory and the scanner; the duplicate groups and hits that remain are justified keeps. `node scripts/report.mjs` lists no file under "Changed with no ledger entry".

## Ledger

Unless another skill invoked this one, run `node scripts/ledger.mjs start` before the first change. It records the starting commit, which the report diffs against, and archives any earlier run. Then record every change, keep, and proposal as you make it, with `node scripts/ledger.mjs add` (`--help` lists the fields):

```
node scripts/ledger.mjs add --skill unslop-react --tell react-9 --action merge \
  --file src/components/SubmitButton.tsx --what "SubmitButton into Button variant=\"primary\"" \
  --why "Differs from PrimaryButton only by type=submit" --evidence "4 call sites migrated; tsc and tests green"
```

Actions are `remove`, `delete-file`, `rewrite`, `merge`, `move`, `keep`, and `propose`. The first five need `--evidence`: the command or check that showed the change was safe. One mechanical fix repeated in one file shares an entry with `--count`. Unless another skill invoked this one, finish with `node scripts/report.mjs` and give the user the path to `.unslop/report.html`. It shows every change with its reason, evidence, and diff, and lists any changed file that has no entry. When the user or the invoking skill asks for a report only, record each finding as `propose` with its fix in `--what`, change no file, skip the fix and verify steps, and pass the same instruction to any skill this one invokes.

## Report

Under `## unslop-react`, list:

- Fixed: counts by id, plus one `path:line  id  what` line per notable fix.
- Merged: the old component names, the survivor they merged into, and the number of call sites migrated.
- Proposed: `path:line  id  what  ->  suggested change`, with why it needs a decision.
- Kept: `path:line  id  reason`.
- Checks: before and after.
