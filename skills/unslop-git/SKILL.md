---
name: unslop-git
description: "Writes commit messages without AI tells, and audits or rewords existing ones. Use when committing, writing or reviewing a commit message, or when the user asks to unslop or reword commit history."
---

# Unslop git

The diff already shows *what* changed. The message adds what the diff can't show: **why** the change was made, plus a subject someone can scan in `git log --oneline`. Slop messages do the reverse and narrate the diff in report formatting.

## Tells

Each tell has a stable id, and findings cite it. **(L)** marks the tells `scripts/lint-msg.mjs` finds.

- **git-1 Vague subject (L).** "Update files", "Fix bug", "Refactor code", "WIP". Fix: name the behavior that changed ("Reject expired tokens in auth middleware"). A bare version or `package@version` is a release subject and passes.
- **git-2 Subject form (L).** Longer than 72 characters (aim for 50, and the `(#123)` a squash merge appends does not count), a trailing period, past tense ("Added"), Title Case, emoji. Fix: imperative mood, sentence case, no period.
- **git-3 Body restates the diff (L).** "- Updated `auth.ts` to add check". Fix: delete it. Say why, or what a reviewer can't see.
- **git-4 Report formatting (L).** `**Summary:**`, `## Changes`, `Key changes:`, bold labels. Fix: plain sentences.
- **git-5 AI vocabulary and empty benefits (L).** `enhance`, `robust`, `streamline`, "improves code quality", "for better maintainability". Fix: the concrete effect, or nothing.
- **git-6 Self-description (L).** "This commit adds...", "This PR...". Fix: start with the verb.
- **git-7 AI tool attribution (L).** "Generated with..." footers and `Co-authored-by` trailers naming an AI tool. Fix: delete them, every time. History that already carries them is not a convention to follow. Trailers name people and issues.
- **git-8 Mixed concerns (L).** "Add login page and fix header". Fix: split the commit (see Write, step 2).
- **git-9 Chatbot voice (L).** "I've updated...", "Let me know", emoji in the body. Fix: delete.
- **git-10 Body shape (L).** Lines over 72 characters (trailers, URLs, and code excepted), or 25+ lines for a small change. Fix: wrap at 72 and cut to the reason.
- **git-11 Missing blank line (L)** between subject and body.
- **git-12 Unbacked claims.** "Improves performance" with no measurement, or "add tests" when the diff has none. Fix: the number, or drop the claim.
- **git-13 Missing why.** No body on a change whose reason isn't obvious from the diff (a workaround, a revert, a magic number). Fix: one or two sentences of reason.
- **git-14 Convention drift.** The message ignores the repo's prefix (`feat:`), casing, scope, or ticket format. Fix: match `git log`.

The repo's convention overrides every tell except `git-7`. If the history uses Conventional Commits, past tense, or gitmoji consistently, follow the history.

## Write a message

1. **Learn the convention.** Run `git log -20 --format=%s` and `git log -5 --format=%B`. Note the prefix style, casing, ticket references, and trailers.
2. **Read the change.** Run `git diff --staged`. If it holds unrelated changes (`git-8`), propose splitting them with `git add -p` or path-based staging before you write anything.
3. **Draft** to a temp file. Subject line, blank line, then a body only when `git-13` applies. Trailers (`Closes #123`, a human `Co-authored-by`) go last if the repo uses them.
4. **Lint** with `node scripts/lint-msg.mjs <file>`. Fix every hit or name the convention that justifies it. Then run `git commit -F <file>`.

## Audit or reword history

1. **Range.** Use the user's range. Otherwise use this branch's own commits, `<default-branch>..HEAD`. On the default branch itself, use `HEAD~20..HEAD`.
2. **Lint** with `node scripts/lint-msg.mjs --range <range>`. For each flagged commit, read `git show --stat <sha>` (and the full diff when the stat doesn't explain it). A good message depends on the change, not on the old message.
3. **Draft** replacements into a JSON file that maps each sha to its full new message. Show the user a table of old and new messages.
4. **Apply** after the user approves: `node scripts/reword.mjs <map.json>`. It needs git 2.38 or later and a worktree with no uncommitted changes (untracked files are fine), refuses merge commits, refuses commits already on a remote unless given `--allow-pushed`, and prints a backup ref to undo with. Pass `--allow-pushed` only when the user has explicitly accepted a force-push. The force-push itself is theirs to run or to ask for.

Done when every commit in range is either reworded or listed with the reason it stays as is.
