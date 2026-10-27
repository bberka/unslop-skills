<!-- unslop-ignore-file -->
# C# tells

Ids are stable, and reports cite them. **(L)** marks the tells `scripts/scan.mjs` can find. **(A)** marks those the .NET analyzers or `dotnet format` report, and **(D)** those `jscpd` finds. The rest need reading.

## Structure

- **cs-1 Interface per class.** `IUserService` with one implementation and no test double, created "for DI". Fix: register and inject the concrete class. Keep the interface where there are two implementations, a real test seam, or a published contract.
- **cs-2 Layer cake.** Controller → Service → Manager → Repository → `DbContext`, where the middle layers only forward. Fix: delete the forwarding layers and call the layer that does the work.
- **cs-3 DTO and mapping sprawl.** `UserDto`, `UserModel`, `UserViewModel`, and `UserResponse` with the same fields, plus hand-written or AutoMapper copies between them. Fix: one type per real boundary (persistence, API contract), and a mapping only where the shapes differ.
- **cs-4 Speculative generality.** Factories for one type, strategy registries with one strategy, options classes nothing binds, generic base repositories wrapping EF Core's own repository. Fix: the concrete thing.
- **cs-5 Junk-drawer classes (L).** `Utils`, `Helpers`, `Extensions`, `*Manager`, `*Processor` holding unrelated statics; extension methods on `string` or `object` for a single call site. Fix: move each member next to its caller or onto the type it belongs to.
- **cs-6 Duplicated logic (D).** Copy-pasted methods, validation repeated in controller, service, and entity, or a reimplementation of what the BCL or an existing helper provides. Fix: one implementation.
- **cs-7 Dead code (L, A).** Unused private members, parameters, `using` directives, and types (IDE0051, IDE0052, IDE0060, IDE0005), plus commented-out code. Fix: delete.

## Async and errors

- **cs-8 Blocking on async (L).** `.Result`, `.Wait()`, `.GetAwaiter().GetResult()`. Fix: `await` all the way up.
- **cs-9 Async ceremony (L).** `async void` outside event handlers, `Task.Run` wrapping async I/O, `async` methods with no `await`, `ConfigureAwait(false)` sprinkled through ASP.NET Core app code. Fix: return the `Task`, drop the wrapper, and follow the repo's library-vs-app convention.
- **cs-10 Exception theater (L).** `catch (Exception ex) { _logger.LogError(ex, …); throw; }` at every layer, `throw ex;` (resets the stack), `catch { }`, catch-all returning `null` or `false`, exceptions as control flow. Fix: catch where you can handle or add context. Log once at the boundary (middleware). Let the rest propagate.
- **cs-11 Null noise (L).** `!= null` checks on non-nullable references with nullable reference types enabled, `!` null-forgiving spam, `ThrowIfNull` on private methods. Fix: trust the annotations inside the boundary and validate once at it. If NRT is off, propose enabling it rather than adding checks.

## Idioms

- **cs-12 LINQ detours (L).** `.Count() > 0` (use `Any()`), `.Where(p).First()` (use `First(p)`), `.ToList()` mid-chain, `.ToList().ForEach`, enumerating an `IEnumerable` twice. Fix: the direct call. Materialize once, on purpose.
- **cs-13 Outdated idioms.** Block-scoped namespaces, `string.Format` (L) where interpolation reads better, verbose property backing fields, manual null checks where `??`, `?.`, or pattern matching fit, constructor boilerplate where primary constructors fit, and `new List<T>()` where collection expressions fit. Only within the project's `LangVersion`. Fix: follow `.editorconfig`. Consistency within the repo beats novelty.
- **cs-14 Magic strings (L).** Config keys, claim types, route names, and cache keys repeated as literals. Fix: `const` fields, `nameof`, or the options pattern.
- **cs-15 Resource misuse (L).** `new HttpClient()` per call, missing `using` on `IDisposable`, finalizers without unmanaged resources, `GC.Collect`. Fix: `IHttpClientFactory`, `using` declarations, and delete the rest.

## Residue

- **cs-16 Restating XML docs (L).** `/// <summary>Gets the user.</summary>` on `GetUser`, `<param name="id">The id.</param>`. Fix: delete it, or document what the signature can't say (units, side effects, thrown exceptions). Keep docs on public library APIs that ship documentation.
- **cs-17 Regions and banners (L).** `#region Private Methods`, `// ===== Helpers =====`. Fix: delete. A class that needs regions to be navigable needs splitting.
- **cs-18 Logging noise (L).** "Entering method" and "Exiting method" logs, and interpolated strings in log templates (`LogInformation($"User {id}")`). Fix: delete the trace logs, and use message templates (`LogInformation("User {UserId}", id)`).
- **cs-19 Debug and demo residue (L).** `Console.WriteLine` in library or web code, `Debug.WriteLine`, `throw new NotImplementedException()` in shipped paths, TODOs with no issue. Fix: finish it, delete it, or link an issue.
- **cs-20 Generic names.** `data`, `result`, `obj`, `item2`, `ProcessData`, `HandleRequest`. Fix: the domain name.
