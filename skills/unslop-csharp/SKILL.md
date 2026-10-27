---
name: unslop-csharp
description: "Finds and removes AI slop in C# and .NET code: interface-per-class, forwarding service layers, DTO sprawl, blocking on async, log-and-rethrow, null-check noise, restating XML docs, dead code. Use when the user asks to unslop, de-slop, or clean up a C#, .NET, or ASP.NET Core codebase, or to audit one for slop."
---

# Unslop C#

Slop is code that exists because generating it was cheap, not because the program needs it. Examples are an interface for every class, a service that forwards to a manager that forwards to a repository, a `try/catch` that logs and rethrows at every layer, and XML docs that repeat the method name. Apply the **deletion test** to anything flagged: if deleting or inlining it changes no behavior and costs a reader no information, it is slop.

Each tell has a stable id (`cs-2`) in [TELLS.md](TELLS.md). Every fix is a **refactor**: behavior and public API stay identical, and the build and tests stay green. `.editorconfig`, `Directory.Build.props` analyzer settings, and documented repo standards override any tell. Test projects belong to the `unslop-tests` skill.

## Workflow

1. **Scope.** Use the paths the user named, or the scope the invoking skill passed. Otherwise ask whether to cover this branch's changes or the whole solution.
2. **Baseline.** Reuse the baseline the invoking skill passed. Otherwise, from a clean worktree, run `dotnet build` and `dotnet test` on the solution and record warnings, errors, and test counts. Note the `LangVersion` and target framework, whether nullable reference types are on, and whether each project is a library (public API is a contract) or an app. Done when all of that is written down.
3. **Load the tells.** Read [TELLS.md](TELLS.md) in full.
4. **Scan.**
   - Run `node scripts/scan.mjs <paths>` for lexical tells. It reads the nearest `.csproj`, so it tells apps from libraries (`cs-9`) and documented public APIs from the rest (`cs-16`), and it skips generated files and test projects.
   - Run `node scripts/dead-code.mjs <solution-or-project>` for unused usings, members, parameters, and locals (`cs-7`). It builds once with the dead-code analyzers injected and writes nothing into the repo.
   - Run `dotnet format <solution-or-project> --verify-no-changes --severity info --no-restore` for style drift against `.editorconfig` and the outdated idioms the analyzers know (`cs-13`: IDE0290 primary constructors, IDE0028 and IDE0300 collection expressions, IDE0161 file-scoped namespaces).
   - Run `npx jscpd --min-tokens 60 --format csharp --similarity <paths>` for clones (`cs-6`). `--similarity` also finds copies that differ only in names and literals.
   - Then read every file in scope for the tells no tool sees: `cs-1` to `cs-4`, the reimplemented-BCL half of `cs-6`, the `!= null` half of `cs-11`, `cs-13`, `cs-20`.

   For `cs-1`, list every `interface I...` and count its implementations and test doubles across the solution. Done when every file is read and every hit is judged.
5. **Fix in batches,** with the smallest blast radius first:
   1. Residue and dead code: `cs-7`, `cs-16` to `cs-19`.
   2. Local idioms: `cs-8` to `cs-15`.
   3. Structure: `cs-1` to `cs-6`.

   Removing an interface or a layer means updating the DI registrations in `Program.cs` or the `ServiceCollection` extensions. After each batch, run `dotnet build` and `dotnet test`. If a batch goes red, fix it or revert it and record why.
6. **Propose instead of fixing** anything that changes a public API in a library, alters the exception or logging behavior that operators depend on, enables nullable reference types project-wide, or reshapes the architecture. List these with the reason.
7. **Verify.** The build has no new warnings, tests match the baseline, and the scanners show only justified keeps.

## Report

```
## unslop-csharp
Fixed:    cs-16 x58, cs-7 x31, cs-2 x4 ...   (one line per notable fix: path:line  id  what)
Proposed: path:line  cs-1  what  ->  suggested change  (why it needs a decision)
Kept:     path:line  cs-9  reason
Checks:   build 0 errors, 12 warnings (baseline 19), tests 340/340 (baseline 340/340)
```
