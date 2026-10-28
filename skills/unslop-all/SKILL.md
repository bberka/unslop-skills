---
name: unslop-all
description: "Surveys a project, asks the user for scope, exclusions, passes, and how changes should land, then runs every applicable unslop skill (tests, code, UI, docs, commits) one pass at a time and reports one combined ledger. Use when the user asks to unslop a whole repo or project, or to run all the unslop skills."
---

# Unslop all

For a PR, a branch, or uncommitted work alone, `unslop-diff` is the lighter path: it asks nothing and keeps to the changed lines. This skill orchestrates the others: it surveys the repo, asks the user what to cover and how changes should land, runs the skills that have files in that scope one at a time with a shared scope and baseline, and keeps each pass separate so any pass can be reviewed or reverted on its own. It writes no fixes itself.

The skills it can run are `unslop-tests`, `unslop-typescript` (which continues into `unslop-react`, then `unslop-ui`), `unslop-csharp`, `unslop-ui`, `unslop-text`, and `unslop-git`. They live in sibling folders (`../unslop-<name>/`).

## Workflow

1. **Survey.** Run `node scripts/detect.mjs --questions`, adding the user's paths or `--changed` when the request already names the scope. It prints JSON:
   - `survey`: what the scope holds, the protected folders, release records, and generated code it found, and the default plan.
   - `rules`: the lines in `AGENTS.md`, `CLAUDE.md`, and `CONTRIBUTING.md` that restrict edits, with the folders each one names.
   - `questions`: ready-made questions in the shape `AskUserQuestion` takes. A question with only one sensible answer is already left out.
   - `answers`: the `detect.mjs` flags or the mode each option stands for.
2. **Ask.** Drop each question the request already answers ("just a report" settles Changes, "skip the tests" settles Passes). When a `rules` line protects an area in words and names no path ("touch another game only when the owner names it"), find the folder and add it to the Exclude question: fold it into Protected areas, or add it as its own option while the question has fewer than four. Then ask every remaining question in one call to the harness's question tool (`AskUserQuestion` in Claude Code takes the `questions` array as printed). Without such a tool, ask the same questions in one message, with lettered options and the recommended one first. "Other" answers are folders or files. Done when every question has an answer or was dropped for a reason you can name.
3. **Plan.** Run `node scripts/detect.mjs` with the flags the answers map to: the scope flags or typed paths, every `--exclude`, and `--passes` with the picked passes (`tests,code,docs,commits`). It prints the run order, the skipped skills with the reason (not picked, nothing in scope), and the commit range for the git pass. Show the user the plan in two lines and start; their answers already approved it. Done when every skill is planned or skipped with its reason.
4. **Prepare.** Branch and current-branch modes need a clean worktree: if `git status` shows changes, ask the user to commit or stash them. In branch mode, create `unslop/<yyyy-mm-dd>` from `HEAD`. In every mode, run `node scripts/ledger.mjs start`, which records the commit the run starts from; every pass writes to that one ledger. Unless the mode is report only, run build, typecheck, lint, and tests once and record the results as the baseline every pass reuses.
5. **Passes.** Run each planned skill in order, one at a time, because passes edit overlapping files. When the harness supports subagents, give each pass its own subagent with a fresh context. Hand it the skill name, the scope with its exclusions (every scanner takes `--exclude <path>`; with a branch-changes scope, also `--diff=<base>`, so findings stay on the lines the branch changed), the baseline, the mode, and the instruction to record every finding in the shared ledger, one `ledger.mjs import` call per batch, and return the skill's report. After each pass:
   - Report only: nothing changed, so move on.
   - Checks green, branch mode: commit the pass. Write the message the way `unslop-git` prescribes, in the repo's commit convention, and run `node ../unslop-git/scripts/lint-msg.mjs <file>` on it before `git commit -F <file>`. The subject names what the pass removed ("Remove assertion-free and duplicate tests"); "unslop pass" is not enough.
   - Checks green, current-branch mode: record which files the pass touched and move on.
   - Checks red: fix the breakage. If it resists, in branch mode commit the pass and then `git revert` it, so the work stays in history and the branch stays green; in current-branch mode, stop and ask the user. Record what went red either way.
   - Proposals: collect them for the final report.
6. **Git pass last.** `unslop-git` audits the range `detect.mjs` printed. It reports and proposes rewordings. Rewriting needs the user's approval, and history on the default branch is never rewritten.
7. **Report.** Run `node scripts/report.mjs` once, after the last pass. It diffs against the start commit, so the page covers every pass of the run. Any file it lists under "Changed with no ledger entry" gets explained in the final report or reverted.

Done when every planned skill ran, every skipped skill is listed with the reason `detect.mjs` gave, each pass is one commit, a reverted commit, a recorded set of files, or (report only) a set of ledger proposals, and the final checks match the baseline.

## Report

```
## unslop-all on unslop/2026-10-27 (scope: whole repo, mode: review branch)
| Pass              | Commit  | Fixed | Proposed | Kept | Checks |
| unslop-tests      | a1b2c3d | 34    | 2        | 5    | green  |
| unslop-typescript | d4e5f6a | 118   | 6        | 12   | green  |
| ...
Baseline to final: tests 412 to 371 (41 slop tests removed), lint warnings 88 to 9
```

List the skipped skills with their reasons under the table. Then list each pass's proposals and open questions, grouped by skill, verbatim from that skill's report. Give the path to `.unslop/report.html`, where every change has its reason, evidence, and diff. Finish with the next decision the user has to make: merge the branch, review specific passes, answer the proposals, or (report only) pick which proposals to apply in a new run.
