---
name: unslop-tests
description: "Audits a test suite and deletes, merges, or rewrites tests that can't catch bugs: tautologies, assertion-free tests, mock echoes, duplicates, stale skips, sleeps, snapshot sprawl. Use when the user asks to unslop, prune, dedupe, or clean up tests, or to find useless, redundant, or flaky tests in any language."
---

# Unslop tests

A test earns its place by going **red** when the behavior it names breaks. Slop tests fail that bar in one of three ways:

- They can't go red: tautologies, missing assertions, mock echoes.
- They go red for the wrong reason: coupled to the implementation, or dependent on timing.
- They repeat a stronger test.

Each tell has a stable id (`tests-4`) in [TELLS.md](TELLS.md). Test code in every language is this skill's scope, including the C# test projects that `unslop-csharp` hands over.

The **mutation check** settles any doubt. Break the code under test the way the test claims to guard against: flip a condition, return a constant, drop a call. Then run that one test. If it stays green, it can't go red. Revert the mutation every time.

## Workflow

1. **Scope and baseline.** The scope is the paths the user named or the invoking skill passed; otherwise, the whole suite. Reuse the baseline the invoking skill passed. Otherwise, from a clean worktree, find the test command (`package.json` scripts, `dotnet test`, `pytest`, `go test ./...`), run the full suite, and record the passed, failed, and skipped counts and the runtime. Record coverage only if the project already has it configured. Done when the numbers are written down. Tests that already fail are reported, not fixed.
2. **Load the tells.** Read [TELLS.md](TELLS.md) in full.
3. **Scan.** Run `node scripts/scan.mjs <test-paths>`. It parses each test body (`it`/`test` calls, `[Fact]`/`[Theory]`/`[Test]`/`[TestMethod]` methods, pytest functions, Go `Test*` functions) and counts a call to a same-file helper that asserts as an assertion, so a `tests-2` or `tests-3` hit on a test that only calls a helper from another file or package is a keep once you have read that helper. Then read every test file in scope, including files with no hits, and give each test a verdict (keep, rewrite, merge, or delete) with the tell id behind it. Look for duplicates (`tests-10`) by comparing the tests that target the same unit. Done when every test in scope has a verdict.
4. **Confirm with mutations.** Run the mutation check on every delete or rewrite candidate whose uselessness isn't self-evident from the code. A test that goes red keeps its place; fix only its other tells. Done when every candidate has a verdict backed by a tell that is evident in the code or by a mutation result, and `git diff` shows no source changes left over.
5. **Apply.**
   - Delete what can't go red.
   - Merge copy-pasted variants into a table-driven test.
   - Rewrite sleeps with fake timers or by waiting on the condition.
   - Rewrite implementation-coupled tests through the public interface.
   - Skipped tests: unskip the ones that pass and delete the ones whose subject is gone. Ask the user about the rest, since a skip can mark a known bug.
6. **Verify.** The suite is green. Every deletion is in the ledger. The skipped count went down, or each remaining skip has a linked issue. Report the coverage delta when coverage is configured; a drop from deleting padding (`tests-6`) is expected, so say so.

## Rules

- Test code is the scope. When a fix seems to need a production-code change (a seam for a clock, an injectable client), list it as a proposal.
- Repo conventions override tells. A style guide that mandates AAA comments keeps them.

## Report

A ledger, one row per changed test:

```
| Test                                  | Verdict | Tell     | Evidence                                |
| cart.test.ts › "works"                | delete  | tests-2  | no assertion                            |
| UserServiceTests.GetsUser             | delete  | tests-4  | mutation: return null, still green      |
| parse.test.ts › 6 date cases          | merge   | tests-10 | now one it.each with 6 rows             |
```

Then give counts before and after (tests, skipped, runtime, coverage), the proposals, and the questions about skipped tests.
