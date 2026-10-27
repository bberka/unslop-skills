---
name: unslop-all
description: "Runs every applicable unslop skill over a project (tests, code, UI, docs, commits) with a shared scope and baseline, one pass per skill, and reports one combined ledger. Use when the user asks to unslop a whole repo or project, or to run all the unslop skills."
---

# Unslop all

This skill orchestrates the others: it picks the skills that apply, runs them one at a time with a shared scope and baseline, and keeps each pass separate so any pass can be reviewed or reverted on its own. It writes no fixes itself.

The skills it can run are `unslop-tests`, `unslop-typescript` (which continues into `unslop-react`, then `unslop-ui`), `unslop-csharp`, `unslop-ui`, `unslop-text`, and `unslop-git`. They live in sibling folders (`../unslop-<name>/`).

## Workflow

1. **Preflight.** Run `git status`. Uncommitted changes would blend into the passes, so ask the user to commit or stash them before continuing. Outside a git repo, say that passes can't be reverted one at a time, and continue only if they agree.
2. **Detect.** Run `node scripts/detect.mjs`. It prints what the project contains, the entry skills in run order, and the commit range for the git pass. Done when you have the plan.
3. **Settle the two choices in one question.** Show the plan and ask the user, once:
   - Scope: the whole repo, or only this branch's changes against the default branch. Every pass gets the same scope.
   - Separation: a branch `unslop/<yyyy-mm-dd>` from `HEAD` with one commit per pass (the default, and the only mode where a pass can be reverted alone), or the current branch with every pass left uncommitted for the user to commit.

   Done when both answers are recorded. With the branch mode, create the branch now.
4. **Baseline.** Run build, typecheck, lint, and tests once and record the results. Pass them to every skill so none of them re-measures.
5. **Passes.** Run each entry skill in the printed order, one at a time, because passes edit overlapping files. When the harness supports subagents, give each pass its own subagent with a fresh context. Hand it the skill name, the scope, the baseline, and the instruction to return the skill's report. After each pass:
   - Checks green, branch mode: commit the pass. Write the message the way `unslop-git` prescribes. The subject names what the pass removed ("Remove assertion-free and duplicate tests"); "unslop pass" is not enough.
   - Checks green, uncommitted mode: record which files the pass touched and move on.
   - Checks red: fix the breakage. If it resists, in branch mode commit the pass and then `git revert` it, so the work stays in history and the branch stays green; in uncommitted mode, stop and ask the user. Record what went red either way.
   - Proposals: collect them for the final report.
6. **Git pass last.** `unslop-git` audits the range `detect.mjs` printed. It reports and proposes rewordings. Rewriting needs the user's approval, and history on the default branch is never rewritten.
7. **Report.**

Done when every entry skill either ran or has a recorded reason for being skipped, each pass is one commit, a reverted commit, or a recorded set of files, and the final checks match the baseline.

## Report

```
## unslop-all on unslop/2026-10-27 (scope: whole repo)
| Pass              | Commit  | Fixed | Proposed | Kept | Checks |
| unslop-tests      | a1b2c3d | 34    | 2        | 5    | green  |
| unslop-typescript | d4e5f6a | 118   | 6        | 12   | green  |
| ...
Baseline to final: tests 412 to 371 (41 slop tests removed), lint warnings 88 to 9
```

Then list each pass's proposals and open questions, grouped by skill, verbatim from that skill's report. Finish with the next decision the user has to make: merge the branch, review specific passes, or answer the proposals.
