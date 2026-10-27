<!-- unslop-ignore-file -->
# Test tells

Ids are stable, and reports cite them. **(L)** marks the tells `scripts/scan.mjs` can find. The rest need reading, and some need a mutation check (see SKILL.md).

## Can't go red

- **tests-1 Tautology (L).** The expected value comes from the same place as the actual one: `expect(true).toBe(true)`, `Assert.Equal(x, x)`, `assert True`, an expected value computed with the code's own formula, or a constant asserted equal to itself. Fix: expected values from an independent source, such as a literal, a worked example, or the spec.
- **tests-2 No assertion (L).** The test runs code and checks nothing. It passes as long as nothing throws: `schema.parse(valid)`, `mapper.Map(source, destination)`. Fix: assert the behavior the name claims, or delete the test. The scanner knows the assertion vocabulary of Jest, Vitest, Playwright, node:test, ava, xUnit, NUnit, MSTest, FluentAssertions, Shouldly, Moq, NSubstitute, pytest, unittest, Go `testing`, testify, and `is`, plus same-file helpers that assert and Go helpers that take `t`.
- **tests-3 Weak assertion only (L).** The test's only checks pass for almost any value: `toBeDefined()`, `toBeTruthy()`, `not.toThrow()`, `Assert.NotNull`, `ShouldNotBeNull()`, `Should.NotThrow`, `assert x`, `is not None`. Fix: assert the actual value or effect. A test with a stronger check beside the weak one is fine.
- **tests-4 Mock echo (L).** The test asserts the value it told a mock to return, or that mocks were called with the arguments the code obviously passes. Fix: assert an outcome the unit computes. If the unit only forwards, it needs no unit test.
- **tests-5 Testing the language or framework.** Getters and setters, constructors that assign fields, DTO round-trips, enum values, a "renders without crashing" test when other tests render the same component, and checks of library behavior. Fix: delete.
- **tests-6 Coverage padding.** Calls every function once with token assertions to raise line coverage. Fix: replace with tests of real behavior at a seam, or delete.

## Goes red for the wrong reason

- **tests-7 Implementation-coupled (L).** Mocks internal collaborators, asserts call order or internal state, or reaches private members through casts or reflection (`(svc as any).cache`, `BindingFlags.NonPublic`, `obj._helper()`). It breaks on a refactor that keeps behavior. Fix: test through the public interface. Mock only at system boundaries (network, clock, filesystem, third-party APIs).
- **tests-8 Timing and environment (L).** Sleeps and fixed timeouts, the real clock, real network, order dependence, shared mutable state between tests. Fix: fake timers and an injected clock, waiting on the condition instead of on time, a fresh state per test. `sleep(0)` and `setTimeout(fn, 0)` yield to the event loop and are not waits.
- **tests-9 Snapshot sprawl (L).** Snapshot files over 200 lines, whole-page snapshots, a test file with more than 5 file snapshots or more than 25 inline ones. Fix: assert the few properties that matter. Keep small snapshots of stable output.

## Duplicate and dead

- **tests-10 Duplicates.** Several tests assert the same behavior under different names, or copy-pasted tests differ by one literal. Fix: delete the weaker one, or merge into a table: `it.each`, `[Theory]` with `[InlineData]`, `@pytest.mark.parametrize`, or Go table tests.
- **tests-11 Skipped or focused (L).** `.skip`, `xit`, `test.fixme`, `[Fact(Skip = …)]`, `[Ignore]`, `[Explicit]`, `@pytest.mark.skip`, or `t.Skip` without a linked issue; `.only` or `fit` left in. Fix: unskip it if it passes, delete it if its subject is gone, otherwise link an issue. Remove every `.only`.
- **tests-12 Commented-out and orphaned tests (L).** Commented-out tests, and tests for code that no longer exists or is never called in production. Fix: delete.

## Noise

- **tests-13 Names that don't state behavior (L).** "works", "test1", "should work", "handles edge cases", "renders correctly". Fix: name the behavior and condition ("rejects expired tokens", "returns empty list when the cart is empty").
- **tests-14 Setup bloat.** Copy-pasted 40-line arrange blocks, `beforeEach` setup only one test uses, giant shared fixtures. Fix: a builder or factory with defaults, and setup local to the test that needs it.
- **tests-15 try/catch hiding failures (L).** Assertions inside a `catch` that never runs when nothing throws, or a `catch` that swallows the failure. Fix: `await expect(…).rejects`, `Assert.Throws`, `pytest.raises`. A `throw` or `fail()` at the end of the `try`, or `expect.assertions(n)` in the test, closes the gap.
- **tests-16 Narration (L).** `// Arrange`, `// Act`, `// Assert` on a five-line test, comments restating the assertion, `console.log` left in tests. Fix: delete them, unless the repo's style guide mandates AAA comments. The scanner reports the AAA comments once per file, as a count.
