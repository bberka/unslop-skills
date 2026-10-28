---
name: unslop-diff
description: "Unslops only what a diff changed: a pull request, a branch, or uncommitted work. Picks the unslop skills that apply to the changed files and limits every finding and fix to the changed lines. Use when the user asks to unslop, clean up, or check a PR, a branch, a diff, or the current work before committing, including an agent's own changes."
---

# Unslop diff

A diff run judges the lines a change added, not the files it touched. Slop that was already in a touched file stays out of scope, so the cleanup never grows a PR past its own change. This skill plans and hands off; the fixes come from the language skills in sibling folders (`../unslop-<name>/`).

## Workflow

1. **Base.** Pick the commit the diff starts from:
   - Uncommitted work, including the edits an agent just made: `HEAD`.
   - A branch: the default branch. Omit the base; the scripts find it.
   - A pull request: read its base with `gh pr view <number> --json baseRefName,headRefName`, run `git fetch origin <baseRefName>`, and use `origin/<baseRefName>`. The PR's branch must be checked out: if it isn't and the worktree is clean, run `gh pr checkout <number>`; otherwise ask the user.

   Done when `git merge-base <base> HEAD` resolves. Diffs count committed, staged, unstaged, and untracked work alike.
2. **Plan.** Run `node scripts/detect.mjs --changed=<base>` (bare `--changed` for the default branch). It lists the changed files, the skills that apply in run order, and the skipped skills with the reason. Add `--exclude <path>` for each folder `AGENTS.md`, `CLAUDE.md`, or `CONTRIBUTING.md` puts off limits; `node scripts/detect.mjs --questions --changed=<base>` lists those rules under `rules`. When nothing changed, report that and stop. Done when every skill is planned or skipped with its reason.
3. **Mode.** Fix in place and leave the changes uncommitted, so the user or the agent's own commit flow takes them. Use report only when the user asks for a review or the PR is someone else's: then every finding is a `propose` entry and no file changes. Ask nothing else; the diff already settles scope and passes.
4. **Prepare.** Run `node scripts/ledger.mjs start`. It snapshots the working tree, so earlier uncommitted work is not counted as this run's change. Unless the mode is report only, run typecheck, lint, and tests once as the baseline.
5. **Passes.** Run each planned skill in order, one at a time, with the changed files as its scope, the baseline, the mode, the shared ledger, and these diff rules:
   - Every scanner takes `--diff=<base>`, as in `node scripts/scan.mjs --diff=<base>`. It scans only the changed files and keeps findings on added or changed lines; a new file counts in full.
   - Tools with no `--diff` (`knip`, `jscpd`, `tokens.mjs`, `inventory.mjs`, `dead-code.mjs`): keep a finding only when it lands on a changed line or names something the diff added, such as a new export, component, or dependency.
   - Fix only changed lines. An edit outside them is allowed when a fix needs it, such as migrating the callers of a wrapper the diff added. Record each such edit with the fix that needed it.
   - `unslop-git` runs only when `<base>..HEAD` has commits, and audits just those.
6. **Verify.** Checks match the baseline. Each scanner run with `--diff=<base> --check` exits 0, or every hit left is a recorded keep. `node scripts/report.mjs` lists no file under "Changed with no ledger entry".

## Report

Lead with the base and the number of changed files, then one line per pass: the skill, fixed, proposed, and kept counts. Then the proposals, the checks against the baseline, and the path to `.unslop/report.html`. Say that the fixes are uncommitted, unless the mode was report only.
