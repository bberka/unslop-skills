---
name: unslop-ui
description: "Audits and fixes the generic AI-generated look in interfaces and graphic design: template gradients and card grids, display-serif and italic-accent defaults, badge, divider, and border clutter, opacity stacks, trend effects (grain, grid backgrounds, marquees, mesh gradients, squircles), token sprawl, missing states, broken focus and contrast, marketing copy, eyebrows, subtitles and captions that narrate the screen, status dots with no state, chart clutter and legends, and product decisions nobody made (borrowed menu items, day/month/year date selects, onboarding tours, pages only the sidebar links). Use when the user asks to unslop, de-template, or critique a UI, landing page, dashboard, chart, frontend, mockup, or screenshot."
---

# Unslop UI

UI slop is what a generated interface looks like when nothing about the subject shaped it: the same hero, palette, cards, and motion on every project. Each tell has a stable id (`ui-13`) in [TELLS.md](TELLS.md), split into three families:

- **Template tells** are taste. A default stands in for a choice. **Propose** a direction before restyling.
- **Craft tells** are bugs: sprawl, missing states, broken focus, failing contrast. **Fix** them. The copy, state, and chart tells (`ui-44` to `ui-54`) are fixed the same way.
- **Product tells** are decisions nobody made: a part borrowed from another app, work left to the user, pages only the sidebar connects. The fix adds or removes behavior, so **record** each as a proposal.

The project's design system and the user's brief override every list. If the brief asks for a gradient hero, the gradient hero stays.

## Workflow

1. **Subject.** From the README, the brief, or the user, write down what the product is, who uses it, and the screen's one job. For an app screen, add where its user goes next from it. Every template and product judgment is made relative to these. Done when each fits in one sentence.
2. **Load the tells.** Read [TELLS.md](TELLS.md) in full. When unsure how far to cut copy or a chart, or what a product proposal says, read the before and after pairs in [EXAMPLES.md](EXAMPLES.md).
3. **Look.** Take screenshots at 1440px and 375px when the environment allows it (start the dev server and drive a browser or Playwright). If the user gave images or mockups, work from those. Otherwise read the markup and styles for every page or route in scope (the paths the user named, or the scope the invoking skill passed). If the scope holds no markup, styles, or components and the user gave no images, report "nothing in scope" and stop. When the scope is a diff (a PR, a branch, or uncommitted work), run the scanners with `--diff=<base>` and fix only the lines the diff changed, as `unslop-diff` describes. Done when every screen in scope has a screenshot or has been read.
4. **Measure.** Run `node scripts/tokens.mjs <ui-src>` for distinct colors, neutrals, radii, shadows, fonts, sizes, opacity levels, unused CSS variables, and which files animate without a `prefers-reduced-motion` path. Run `node scripts/scan.mjs <ui-src>` for lexical tells. Find the project's scale (Tailwind config, CSS variables, theme file) so the counts have something to compare against. Done when you can say how many values the scale defines per category.
5. **Findings.** List each finding as `screen or path:line  ui-N  what  ->  fix`, tagged craft, template, or product. Every scanner hit is judged, and every screenshot is checked against the template tells the scanner can't see (`ui-2`, `-3`, `-9`, `-10`, `-12`, `-14`, `-18`, `-28`, `-30`, `-42`, `-43`). Read every visible string and chart for the tells only reading finds: `ui-44` subtitles, `-45` botsplaining, `-46` design notes, `-47` repeated labels, `-48` slogans, and `-52` values encoded twice. On each app screen, check every menu item, field, first-run screen, and entity name against the product tells (`ui-55` to `ui-58`). Then size the job from the findings. Many template tells across color, type, and layout call for the direction in step 7. A screen that is mostly designed, with a few tells left, gets those tells fixed inside its existing palette, type, and layout; larger ideas go in the report as suggestions. A screen with none gets a report that says so, and no restyle.
6. **Fix craft tells.**
   - Map raw values onto the existing scale, and collapse opacity mixes (`ui-26`) into named tokens.
   - Add the missing states.
   - Restore visible focus, and use native elements with accessible names.
   - Fix contrast to WCAG AA.
   - Respect `prefers-reduced-motion`. One rule in the base stylesheet covers CSS animations; animation libraries need their own switch (`useReducedMotion` in Motion, for example).
   - Cut the copy and state tells (`ui-44` to `ui-49`) and the chart tells (`ui-50` to `ui-54`). A chart keeps its type, data, and series colors.
   - For copy, run the `unslop-text` skill (sibling folder `../unslop-text/`) on every user-facing string. Apply `ui-20` alongside it.
7. **Template tells.** Write a short direction grounded in step 1: 4 to 6 named hex colors, the type family and scale, the layout idea, and the one element meant to be memorable. Show it to the user. Restyle only after they agree, or right away if they already asked for a redesign. A removed decoration is not replaced by another: taking out the gradient and adding grain, glass, or a bento grid swaps one season's template for the next.
8. **Product tells.** Record each as a `propose` entry whose `what` is the smallest change that settles it, and change no file for it. Apply one only after the user agrees, as its own batch with its own check that the screen still works.
9. **Verify.** Re-take the screenshots and compare them with the originals. Build, lint, and tests stay green. Run `tokens.mjs` again; the distinct counts should drop toward the scale. Then the swap test: put another product's name on the screen. If it still fits, the result is a cleaner template, so push the subject from step 1 harder into the copy and the one memorable element, using only facts the source holds. Then read the diff once more: every remaining subtitle, caption, and label passes `ui-44` to `ui-47`, every string you wrote is inside the length limit of `ui-20`, no deletion left an empty wrapper or an unused import, and every input and icon button still has its name. `node scripts/report.mjs` lists no file under "Changed with no ledger entry".

## Cut first, write little

Deleting is the default fix for copy. Where a tell says rewrite (`ui-20`, `ui-48`, `ui-50`), the new text states only what the source already shows: the product's own copy, the names of its features, the data bound to the screen. Never add a number, a speed, an integration, or a benefit you can't point to in the code. With nothing true to say, delete the string, or leave it and record a `propose` entry.

- When you delete an element, delete what existed only for it: its empty wrapper, a wrapper left holding one child it only grouped, the margin or gap, an import or variable nothing else uses.
- Never delete `aria-label`, `alt`, `title` on icon buttons, or screen-reader-only text. If cut visible text was the only accessible name, move it into `aria-label`.
- A form field keeps a visible label tied to its input (`for` and `id`, or a wrapping `<label>`). Never swap it for a placeholder or an `aria-label`.
- Text from data, props, i18n files, or a CMS is edited at its source (the translation file, the fixture) or recorded as a proposal, never hard-coded in the component.
- A flagged element that earns its place (real state, real order, legal text) is a `keep` entry with the reason.
- A screen with nothing to cut gets no edit. Say so, and name at most two optional refinements.

## Image or mockup only

With no code, run steps 1 to 5 and deliver the findings as a critique. Give each template tell a concrete alternative tied to the subject.

## Ledger

Unless another skill invoked this one, run `node scripts/ledger.mjs start` before the first change. It records the starting commit, which the report diffs against, and archives any earlier run. Record every change, keep, and proposal in batches: after each fix batch (and once for the keeps and proposals), write all its entries in one call, one JSON line per entry (`--help` lists the fields):

```
node scripts/ledger.mjs import - --skill unslop-ui <<'EOF'
{"tell":"ui-13","action":"rewrite","file":"src/components/Card.tsx","line":8,"what":"bg-[#5b5bd6] to bg-primary","why":"Raw hex duplicates the primary token","evidence":"tokens.mjs: colors 23 to 22; screenshot unchanged"}
{"tell":"ui-2","action":"propose","file":"src/routes/index.svelte","what":"Replace the gradient hero with the product screenshot","why":"Template hero; restyling needs approval"}
{"tell":"ui-58","action":"propose","file":"src/routes/tasks/[id].svelte","line":41,"what":"Link the project name to /projects/[id]","why":"Plain text while the route exists; adds navigation, so it needs approval"}
EOF
```

Actions are `remove`, `delete-file`, `rewrite`, `merge`, `move`, `keep`, and `propose`. The first five need `evidence`: the command or check that showed the change was safe. One mechanical fix repeated in one file shares an entry with `count`. An invalid entry rejects the whole batch with its number, so fix it and resend the batch. Unless another skill invoked this one, finish with `node scripts/report.mjs` and give the user the path to `.unslop/report.html`. It shows every change with its reason, evidence, and diff, and lists any changed file that has no entry. When the user or the invoking skill asks for a report only, record each finding as `propose` with its fix in `what`, change no file, skip the fix and verify steps, and pass the same instruction to any skill this one invokes.

## Report

Group by screen and list: craft fixes made, template and product proposals with their status (approved, pending, or declined), token counts before and after, and anything left open.
