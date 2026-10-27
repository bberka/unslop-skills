<!-- unslop-ignore-file -->
# React tells

Ids are stable, and reports cite them. **(L)** marks the tells `scripts/scan.mjs` can find. **(I)** marks those `scripts/inventory.mjs` surfaces, and **(D)** those `jscpd` finds.

## State and effects

- **react-1 Effect for derived state (L).** `useEffect(() => setFullName(first + " " + last), [first, last])`. Fix: compute it during render. Use `useMemo` only when profiling shows the computation is expensive.
- **react-2 Props mirrored into state (L).** `useState(props.value)`, or an effect that copies a prop into state. Fix: read the prop. To reset state when an identity changes, pass a `key`.
- **react-3 Effects as event handlers.** An effect watches a flag and then posts, navigates, or toasts. Fix: do the work in the handler that set the flag.
- **react-4 Hand-rolled fetching (L).** `fetch` in `useEffect` with loading and error booleans, in a project that already has a data layer (TanStack Query, SWR, server components, route loaders). Fix: the project's pattern. With no data layer, handle abort and races.
- **react-5 Boolean soup (L).** `isLoading`, `isError`, `isSuccess`, `isEmpty` as separate states that can contradict each other. Fix: one status union, or `useReducer`.
- **react-6 Duplicated state.** The same data held twice (a list plus the selected object instead of the selected id), or state that could be derived. Fix: store the minimum and derive the rest.
- **react-7 Silenced dependency lint (L).** `eslint-disable-next-line react-hooks/exhaustive-deps`. Fix: restructure. Move the function inside the effect, use an effect-event pattern, or find that the effect isn't needed (react-1, react-3).

## Performance theater

- **react-8 Memo theater (L).** `useMemo` around a property read or a literal, `useCallback` passed to plain DOM elements, `memo` on components whose props change every render, and manual memoization in a project running React Compiler. Fix: remove it. Keep it where a profile shows a cost or a stable identity is required (an effect dependency, a memoized child).

## Components

- **react-9 Near-duplicate components (I, D).** `PrimaryButton`, `SubmitButton`, and `BlueButton` differing by one class; copy-pasted cards, modals, or list rows; a hand-built version of a component the design system (`components/ui`, shadcn, an internal kit) already ships. Fix: one component with variants, or the existing one.
- **react-10 God components (I).** Over 300 lines, six or more `useState`, and fetching, state logic, and layout in one function. Fix: extract the data hook and the presentational pieces along real seams.
- **react-11 Components defined inside components (L).** They remount on every render and lose their state. Fix: move them to module scope and pass props.
- **react-12 Wrapper and div soup (L).** Components that only pass props through, nested `div`s with no styling or semantics, a Fragment around a single child. Fix: delete the layer.
- **react-13 Prop drilling or context for everything.** A prop threaded through three or more components that don't read it, or a context created for state one subtree uses. Fix: composition (`children`, slots) first. Use context for state that is truly cross-cutting.
- **react-14 Hooks that aren't hooks.** A `useX` that calls no hooks, or a custom hook that wraps one `useState`. Fix: a plain function, or inline it.
- **react-15 Re-declared DOM props.** A props interface that redeclares `onClick`, `disabled`, and `className` by hand. Fix: extend `ComponentProps<"button">` and spread the rest.
- **react-16 Client boundary sprawl.** `"use client"` on files with no state, effects, or handlers, or high in the tree so the whole page ships as client code. Fix: push the boundary down to the interactive leaf.

## JSX

- **react-17 Index keys (L).** `key={index}` on lists that reorder, insert, or delete. Fix: a stable id.
- **react-18 Redundant handler arrows (L).** `onClick={() => handleClick()}`. Fix: `onClick={handleClick}`.
- **react-19 Hand-assembled class strings (L).** Template-literal ternaries in `className` when the project has `cn`, `clsx`, or `cva`. Fix: the project's helper.
- **react-20 Leaky conditionals (L).** `{items.length && <List />}` renders `0`. Fix: `{items.length > 0 && <List />}`.
