<!-- unslop-ignore-file -->
# C# tells

Ids are stable, and reports cite them. **(L)** marks the tells `scripts/scan.mjs` can find. **(A)** marks those the .NET analyzers or `dotnet format` report, and **(D)** those `jscpd` finds. The rest need reading.

## Structure

- **cs-1 Interface per class.** `IUserService` with one implementation and no test double, created "for DI". Fix: register and inject the concrete class. Keep the interface where there are two implementations, a real test seam, or a published contract.
- **cs-2 Layer cake.** Controller → Service → Manager → Repository → `DbContext`, where the middle layers only forward. Fix: delete the forwarding layers and call the layer that does the work.
- **cs-3 DTO and mapping sprawl.** `UserDto`, `UserModel`, `UserViewModel`, and `UserResponse` with the same fields, plus hand-written or AutoMapper copies between them. Fix: one type per real boundary (persistence, API contract), and a mapping only where the shapes differ.
- **cs-4 Speculative generality.** Factories for one type, strategy registries with one strategy, options classes nothing binds, generic base repositories wrapping EF Core's own repository. Fix: the concrete thing.
- **cs-5 Junk-drawer classes (L).** `Utils`, `Helpers`, `Extensions`, `*Manager`, `*Processor` holding unrelated statics; extension methods on `string` or `object` for a single call site. Fix: move each member next to its caller or onto the type it belongs to. The scanner skips sample and benchmark folders.
- **cs-6 Duplicated logic (D).** Copy-pasted methods, validation repeated in controller, service, and entity, or a reimplementation of what the BCL or an existing helper provides. Fix: one implementation.
- **cs-7 Dead code (L, A).** Unused private members, parameters, `using` directives, and types (IDE0051, IDE0052, IDE0060, IDE0005), plus commented-out code. Fix: delete.

## Async and errors

- **cs-8 Blocking on async (L).** `.Result` on a task, `.Wait()`, `Task.WaitAll`, `.GetAwaiter().GetResult()`. Fix: `await` all the way up. A sync `Dispose` that drains an async one is a keep when the type can't be `IAsyncDisposable`.
- **cs-9 Async ceremony (L).** `async void` outside event handlers, `Task.Run` wrapping async I/O, `async` methods with no `await`, and `ConfigureAwait(false)` in app code: ASP.NET Core, worker, and console projects have no `SynchronizationContext`, so it only adds noise there. Libraries and UI apps (MAUI, WPF, WinForms) keep it. Fix: return the `Task`, drop the wrapper, and follow the repo's library-vs-app convention. The scanner reads the `.csproj` to tell the two apart.
- **cs-10 Exception theater (L).** `catch (Exception ex) { _logger.LogError(ex, …); throw; }` at every layer, `throw ex;` (resets the stack), `catch { }`, catch-all returning `null` or `false`, exceptions as control flow. Fix: catch where you can handle or add context. Log once at the boundary (middleware). Let the rest propagate. A catch for `OperationCanceledException`, or one with a `when` filter, is deliberate.
- **cs-11 Null noise (L).** `!= null` checks on non-nullable references with nullable reference types enabled, `!` null-forgiving spam, `ThrowIfNull` on private methods, `= null!` on properties that `required` (C# 11) would cover. The mirror image is a boundary with no check at all: a `[FromBody]` model used before validation, or a config value read and trusted. Fix: validate once at the boundary (model validation, options validation, a guard in the public method) and trust the annotations inside it. If NRT is off, propose enabling it rather than adding checks. The scanner reports a file once it holds three or more `!`.

## Architecture

These tells cross files. Each fix moves code around, so it is a proposal unless the user asked for the restructuring, and the proposal names the files it would touch.

- **cs-21 Representable illegal states.** `bool IsLoading` next to `Exception? Error` and `T? Data`; a `Status` enum beside the fields only one status uses; `string Kind` with a `switch` that has a `default: throw`. Fix: one record per state behind a shared base or interface, matched with `switch` expressions, so a state that can't happen can't be built.
- **cs-22 God files (L).** One file that holds the entity, its validation, its EF configuration, its mapping, and its handlers, so every change lands there. The scanner reports a file from 600 lines of code up. Fix: split along the seams the `using` list already shows.
- **cs-23 Shotgun surgery.** Adding one column means editing the entity, the migration, the DTO, the mapper, the validator, the controller, the client model, and the fixture. Check with `git log --stat -20`: commits that touch six or more files for one small change show it. Fix: collapse the layers that mirror each other (`cs-2`, `cs-3`).
- **cs-24 Layering violations (L).** A `Domain` or `Core` project with `using Microsoft.EntityFrameworkCore` or `Microsoft.AspNetCore`; an entity with `[JsonPropertyName]` and `[Column]` attributes both; a controller that opens a `SqlConnection`. Dependencies point inward. The scanner checks files under `Domain/`, `Core/`, `Entities/`, and `Abstractions/` for infrastructure and web namespaces. Fix: move the call behind the project that owns it, and keep the project references pointing one way.
- **cs-25 Implicit coupling (L).** Classes that agree through something other than a constructor parameter: a public static mutable property (`public static string CurrentTenant { get; set; }`), `IServiceProvider.GetRequiredService<T>()` inside a class instead of in its constructor, a string event name or cache key both sides spell out, an `Order` that a filter must have set before the handler runs. Fix: inject the dependency, pass the value, or share one constant (`cs-14`). The scanner skips `Program.cs`, `Startup.cs`, and `*Extensions.cs`, where resolving from the container is composition.
- **cs-26 Layer-first folders.** `Controllers/`, `Services/`, `Repositories/`, `Models/`, `Dtos/`, `Interfaces/`, `Helpers/` at the top, so one feature is spread across seven folders and the `I` interfaces live apart from the classes they describe (`cs-1`). Fix: fold by feature (`Orders/`, `Billing/`), each folder holding its endpoint, handler, and types. Check with `ls src/*/`.

## Idioms

- **cs-12 LINQ detours (L).** `.Count() > 0` (use `Any()`), `.Where(p).First()` (use `First(p)`), `.ToList()` mid-chain, `.ToList().ForEach`, enumerating an `IEnumerable` twice. Fix: the direct call. Materialize once, on purpose.
- **cs-13 Outdated idioms (L, A).** Block-scoped namespaces (IDE0161), `string.Format` where interpolation reads better, verbose property backing fields where the `field` keyword (C# 14) fits, manual null checks where `??`, `?.`, or pattern matching fit, constructor boilerplate where primary constructors fit (IDE0290), and `new List<T>()` where collection expressions fit (IDE0028, IDE0300). Only within the project's `LangVersion`. Fix: follow `.editorconfig`. Consistency within the repo beats novelty.
- **cs-14 Magic strings (L).** Config keys, claim types, route names, and cache keys repeated as literals. Fix: `const` fields, `nameof`, or the options pattern. `GetSection("Smtp")` at the single binding site is the options pattern itself, so it stays.
- **cs-15 Resource misuse (L).** `new HttpClient()` per call, missing `using` on `IDisposable`, finalizers without unmanaged resources, `GC.Collect`. Fix: `IHttpClientFactory`, `using` declarations, and delete the rest.

## Residue

- **cs-16 Restating XML docs (L).** A summary whose words all come from the member's name: `/// <summary>Gets the user.</summary>` on `GetUser`, `Initializes a new instance of the Foo class` on `Foo()`, `<param name="id">The id.</param>`. Fix: delete it, or document what the signature can't say (units, side effects, thrown exceptions). A project with `GenerateDocumentationFile` keeps docs on its visible members, because CS1591 demands them, so the scanner checks only private and internal members there.
- **cs-17 Regions and banners (L).** `#region Private Methods`, `// ===== Helpers =====`. Fix: delete. A class that needs regions to be navigable needs splitting. A region whose name holds a hyphen (`#region retry-usage`) is a docs snippet anchor and stays.
- **cs-18 Logging noise (L).** Method entry and exit logs ("Entering GetUser"), and interpolated strings in log templates (`LogInformation($"User {id}")`). Fix: delete the trace logs, and use message templates (`LogInformation("User {UserId}", id)`), or `[LoggerMessage]` on hot paths. Lifecycle logs ("Starting consumer") stay.
- **cs-19 Debug and demo residue (L).** `Console.WriteLine` in library or web code, `Debug.WriteLine`, `throw new NotImplementedException()` in shipped paths, TODOs with no issue. Fix: finish it, delete it, or link an issue. `Program.cs`, samples, and templates are exempt.
- **cs-20 Generic names.** `data`, `result`, `obj`, `item2`, `ProcessData`, `HandleRequest`. Fix: the domain name.
