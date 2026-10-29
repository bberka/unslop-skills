<!-- unslop-ignore-file -->
# TypeScript tells

Ids are stable, and reports cite them. **(L)** marks the tells `scripts/scan.mjs` can find. **(K)** marks those `knip` finds and **(D)** those `jscpd` finds. The rest need reading.

## Types

- **ts-1 Type escape hatches (L).** `any`, `as any`, `as unknown as T`, `Record<string, any>`, `catch (e: any)`. Fix: the real type, `unknown` plus narrowing at the boundary, or a generic.
- **ts-2 Silenced checks (L).** `@ts-ignore`, `@ts-nocheck`, and `@ts-expect-error` or `eslint-disable` without a reason. The scanner finds the bare forms; a rule-scoped disable (`eslint-disable-next-line no-explicit-any`) is judged on reading. Fix: fix the error. If the suppression must stay, add the reason (`// @ts-expect-error -- upstream types omit X`).
- **ts-3 Non-null assertion spam (L).** `user!.profile!.name`, or a file peppered with `!`. The scanner reports two on one line, or eight in one file. Fix: narrow once (early return, guard) or fix the type that claims nullability.
- **ts-4 Redundant annotations (L).** `const count: number = 0`, or annotating a callback parameter that is already contextually typed. Fix: let inference work. Explicit return types on exported functions are fine.
- **ts-5 Duplicated types.** The same shape declared in several files, or a hand-written type next to the schema or API it mirrors. Fix: one source, derived with `z.infer`, `typeof`, `ReturnType`, `Pick`, or `Omit`.
- **ts-6 Stringly typed.** `status: string` where a union fits, or magic strings repeated across files. Fix: a union or `as const` object in one place.
- **ts-7 Optional everything.** Every property marked `?` "to be safe", `| null | undefined` on values that always exist, and `?.` chains on non-nullable values (L when four or more deep). Fix: make required what is required, and make absence explicit where it is real.

## Control flow

- **ts-8 Validation in the wrong place (L).** Two failures of the same rule. Inside: `if (!items) return []` where the type says array, `typeof x === "string"` on a typed string, or validation repeated at every layer. At the edge: `req.body as CreateUser`, `(await res.json()) as Order`, `JSON.parse(raw) as Config`, where a cast stands in for a check and the type lies from then on. The scanner finds the casts, and leaves build scripts (`scripts/`, `tools/`) alone, since the files they read are the repo's own. Fix: validate once at the boundary (input, network, storage), with a schema or a type guard, and trust the types inside.
- **ts-9 Catch-and-log, catch-and-swallow (L).** `catch (e) { console.error(e); throw e; }`, or `catch { return null }` around several statements, hiding which one failed. Fix: catch where you can handle or add context (`new Error("…", { cause })`). Otherwise let it propagate. Three shapes are handling, not slop, and the scanner leaves them alone: a probe (one call, plus an optional `return true` as its answer), a read of stored or external data (`JSON.parse`, web storage, `new URL`) that falls back to a default, and a boundary that logs and continues.
- **ts-10 Async ceremony (L).** An `async` executor in `new Promise`, `new Promise` wrapping a promise, `async` functions with no `await`, `.then` chains mixed with `await`, and sequential `await` in a loop over independent work. Fix: plain `async`/`await`, with `Promise.all` where the work is independent.
- **ts-11 Verbose idioms (L).** `if (x) return true; else return false`, `cond ? true : false`, `.filter(f).length > 0`, `=== true` on a plain `boolean`, and manual loops that rebuild `map`, `filter`, or `some`. Fix: the direct expression. `opts.animate !== false` on an optional boolean means "on by default" and stays.

## Structure

- **ts-12 Middle men.** Functions, classes, or modules that only forward to another call; one-line wrappers around a library call; util files that re-export. Fix: call the real target and delete the layer.
- **ts-13 Speculative generality.** Factories, managers, abstract base classes, strategy registries, generics, options, and flags with one implementation or one caller. "For testability" interfaces with one implementation and no test double. Fix: inline back to the concrete thing until a second real case appears.
- **ts-14 Duplicated logic (D).** Copy-pasted functions with small differences, and reimplementations of a helper that already exists in the repo or of a standard library function. Fix: extract the shared shape or call the existing helper. Search the repo for it before keeping a new one.
- **ts-15 Dead code (K).** Unused exports, files, dependencies, parameters, and branches; feature flags that are always on. Fix: delete them. `git` remembers. Before removing an export, search the whole repo for the name (`rg -w <name>`): other workspaces, scripts, and modules loaded by a computed path (`import(join(root, "src", "x.ts"))`) are consumers `knip` can miss.
- **ts-16 Static-only classes and stateless singletons.** `class StringUtils { static … }`. Fix: exported functions in a module named for its domain.
- **ts-17 Junk-drawer modules (L).** `utils.ts`, `helpers.ts`, `common.ts`, and `*Manager`, `*Helper`, `*Processor` classes collecting unrelated code. Fix: move each function next to its only caller, or into a module named for its domain.

## Architecture

These tells cross files. Each fix moves code around, so it is a proposal unless the user asked for the restructuring, and the proposal names the files it would touch.

- **ts-22 Representable illegal states (L).** `{ loading: boolean; error?: Error; data?: T }` lets `loading` and `data` both be set. Parallel optional fields, a `status: string` next to the fields each status needs, and flag pairs that must agree. The scanner finds the loading-error-data shape. Fix: a discriminated union (`{ status: "loading" } | { status: "error"; error } | { status: "ready"; data }`), so the compiler rules the bad states out.
- **ts-23 God files (L).** One module that holds the types, the fetch, the cache, the validation, and the formatting for a feature, so every change lands there. The scanner reports a file from 600 lines of code up. Fix: split along the seams the imports already show. `react-10` covers the component version.
- **ts-24 Shotgun surgery.** Adding one field means editing the type, the DTO, the mapper, the validator, the mock, the fixture, and the test, each in its own file. Check with `git log --stat -20`: commits that touch six or more files for one small change show it. Fix: collapse the layers that only mirror each other (`ts-5`, `ts-12`), and derive what can be derived.
- **ts-25 Layering violations (L).** A component or hook importing the ORM, the filesystem, or a database driver; a domain or core module importing the web framework or React. Dependencies point inward: UI depends on domain, domain depends on nothing with a port number. The scanner checks `components/`, `ui/`, `views/`, `hooks/`, and `stores/` for infrastructure imports, skipping server files (`route.ts`, `actions.ts`, `*.server.ts`), and `domain/`, `core/`, and `entities/` for framework imports. Fix: move the call behind the layer that owns it.
- **ts-26 Implicit coupling.** Modules that agree through something other than an import: a shared mutable global, a string key both sides spell out, an event name, a file that must load first, a field another module sets and this one reads. Fix: an explicit import, a typed function parameter, or one constant both sides import.
- **ts-27 Layer-first folders.** `components/`, `hooks/`, `utils/`, `types/`, `services/`, `constants/` at the top level, so one feature is spread across six folders and `utils/` grows without bound (`ts-17`). Fix: fold by feature (`checkout/`, `auth/`), each folder holding the components, hooks, and types only it uses. Shared code earns a shared folder after the second consumer appears. Check with `ls src`.

## Residue

- **ts-18 Narrating comments (L).** `// Import dependencies`, `// Loop through users`, `// Return the result`, section banners, and JSDoc that restates the signature (`@param id - The id`). Fix: delete. Keep comments that explain *why*: a constraint, a workaround with a link, a non-obvious invariant.
- **ts-19 Commented-out code (L).** Fix: delete it.
- **ts-20 Debug and demo residue (L).** `console.log`, `debugger`, "In a real app you would…", "simplified for demonstration", `throw new Error("Not implemented")` in shipped paths, TODOs with no owner or issue. The scanner treats console output in `scripts/`, `bin/`, `cli/`, and `tools/` as intended, and accepts `TODO(name)`, `#123`, a ticket key, or a URL as an owner. Fix: finish the work, delete it, or link the TODO to an issue.
- **ts-21 Generic names.** `data2`, `handleData`, `processItem`, `doStuff`, `temp`, and `result` living longer than three lines. Fix: name what the value is in the domain.
