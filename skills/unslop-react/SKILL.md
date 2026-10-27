---
name: unslop-react
description: "Finds and removes AI slop in React code: near-duplicate components, effects for derived state, props copied into state, boolean soup, memo theater, god components. Then runs unslop-ui. Use when the user asks to unslop, dedupe, or clean up React components, hooks, or a React or Next.js codebase."
---

# Unslop React

React slop comes in two kinds. The first is code that fights the framework: effects that recompute what render could compute, state that copies props, memoization nobody measured. The second is components generated one at a time, so the codebase ends up with five buttons and three modals that each almost match. Apply the **deletion test**: if removing or merging it changes no behavior, it is slop.

Each tell has a stable id (`react-9`) in [TELLS.md](TELLS.md). Fixes are **refactors**: behavior and public props stay identical, and checks stay green. Documented repo standards override any tell.

## Workflow

1. **Scope and baseline.** Use the scope the user named or the invoking skill passed. If `unslop-typescript` invoked this skill, reuse its baseline. Otherwise ask for scope (this branch's changes or the whole repo), then record typecheck, lint, and test results from a clean worktree.
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
8. **UI layer.** Run the `unslop-ui` skill (sibling folder `../unslop-ui/`) on the same scope.
9. **Verify.** Checks match the baseline. Rerun the inventory and the scanner; the duplicate groups and hits that remain are justified keeps.

## Report

Under `## unslop-react`, list:

- Fixed: counts by id, plus one `path:line  id  what` line per notable fix.
- Merged: the old component names, the survivor they merged into, and the number of call sites migrated.
- Proposed: `path:line  id  what  ->  suggested change`, with why it needs a decision.
- Kept: `path:line  id  reason`.
- Checks: before and after.
