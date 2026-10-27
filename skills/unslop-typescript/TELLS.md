<!-- unslop-ignore-file -->
# TypeScript tells

Ids are stable, and reports cite them. **(L)** marks the tells `scripts/scan.mjs` can find. **(K)** marks those `knip` finds and **(D)** those `jscpd` finds. The rest need reading.

## Types

- **ts-1 Type escape hatches (L).** `any`, `as any`, `as unknown as T`, `Record<string, any>`. Fix: the real type, `unknown` plus narrowing at the boundary, or a generic.
- **ts-2 Silenced checks (L).** `@ts-ignore`, `@ts-nocheck`, and `@ts-expect-error` or `eslint-disable` without a reason. Fix: fix the error. If the suppression must stay, add the reason (`// @ts-expect-error -- upstream types omit X`).
- **ts-3 Non-null assertion spam (L).** `user!.profile!.name`. Fix: narrow once (early return, guard) or fix the type that claims nullability.
- **ts-4 Redundant annotations (L).** `const count: number = 0`, or annotating a callback parameter that is already contextually typed. Fix: let inference work. Explicit return types on exported functions are fine.
- **ts-5 Duplicated types.** The same shape declared in several files, or a hand-written type next to the schema or API it mirrors. Fix: one source, derived with `z.infer`, `typeof`, `ReturnType`, `Pick`, or `Omit`.
- **ts-6 Stringly typed.** `status: string` where a union fits, or magic strings repeated across files. Fix: a union or `as const` object in one place.
- **ts-7 Optional everything.** Every property marked `?` "to be safe", `| null | undefined` on values that always exist, and `?.` chains on non-nullable values (L when three or more deep). Fix: make required what is required, and make absence explicit where it is real.

## Control flow

- **ts-8 Impossible-state guards.** `if (!items) return []` where the type says array, `typeof x === "string"` on a typed string, or validation repeated at every layer. Fix: validate once at the boundary (input, network, storage) and trust the types inside.
- **ts-9 Catch-and-log, catch-and-swallow (L).** `catch (e) { console.error(e); throw e; }`, or `catch { return null }` hiding failures. Fix: catch where you can handle or add context (`new Error("…", { cause })`). Otherwise let it propagate.
- **ts-10 Async ceremony (L).** An `async` executor in `new Promise`, `new Promise` wrapping a promise, `async` functions with no `await`, `.then` chains mixed with `await`, and sequential `await` in a loop over independent work. Fix: plain `async`/`await`, with `Promise.all` where the work is independent.
- **ts-11 Verbose idioms (L).** `if (x) return true; else return false`, `=== true`, `cond ? true : false`, `.filter(f).length > 0`, and manual loops that rebuild `map`, `filter`, or `some`. Fix: the direct expression.

## Structure

- **ts-12 Middle men.** Functions, classes, or modules that only forward to another call; one-line wrappers around a library call; util files that re-export. Fix: call the real target and delete the layer.
- **ts-13 Speculative generality.** Factories, managers, abstract base classes, strategy registries, generics, options, and flags with one implementation or one caller. "For testability" interfaces with one implementation and no test double. Fix: inline back to the concrete thing until a second real case appears.
- **ts-14 Duplicated logic (D).** Copy-pasted functions with small differences, and reimplementations of a helper that already exists in the repo or of a standard library function. Fix: extract the shared shape or call the existing helper. Search the repo for it before keeping a new one.
- **ts-15 Dead code (K).** Unused exports, files, dependencies, parameters, and branches; feature flags that are always on. Fix: delete them. `git` remembers.
- **ts-16 Static-only classes and stateless singletons.** `class StringUtils { static … }`. Fix: exported functions in a module named for its domain.
- **ts-17 Junk-drawer modules (L).** `utils.ts`, `helpers.ts`, `common.ts`, and `*Manager`, `*Helper`, `*Processor` classes collecting unrelated code. Fix: move each function next to its only caller, or into a module named for its domain.

## Residue

- **ts-18 Narrating comments (L).** `// Import dependencies`, `// Loop through users`, `// Return the result`, section banners, and JSDoc that restates the signature (`@param id - The id`). Fix: delete. Keep comments that explain *why*: a constraint, a workaround with a link, a non-obvious invariant.
- **ts-19 Commented-out code (L).** Fix: delete it.
- **ts-20 Debug and demo residue (L).** `console.log`, `debugger`, "In a real app you would…", "simplified for demonstration", `throw new Error("Not implemented")` in shipped paths, TODOs with no owner or issue. Fix: finish the work, delete it, or link the TODO to an issue.
- **ts-21 Generic names.** `data2`, `handleData`, `processItem`, `doStuff`, `temp`, and `result` living longer than three lines. Fix: name what the value is in the domain.
