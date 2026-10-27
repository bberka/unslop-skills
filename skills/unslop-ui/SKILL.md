---
name: unslop-ui
description: "Audits and fixes the generic AI-generated look in interfaces and graphic design: template gradients and card grids, token sprawl, missing states, broken focus and contrast, marketing copy. Use when the user asks to unslop, de-template, or critique a UI, landing page, frontend, mockup, or screenshot."
---

# Unslop UI

UI slop is what a generated interface looks like when nothing about the subject shaped it: the same hero, palette, cards, and motion on every project. Each tell has a stable id (`ui-13`) in [TELLS.md](TELLS.md), split into two families:

- **Template tells** are taste. A default stands in for a choice. **Propose** a direction before restyling.
- **Craft tells** are bugs: sprawl, missing states, broken focus, failing contrast. **Fix** them.

The project's design system and the user's brief override both lists. If the brief asks for a gradient hero, the gradient hero stays.

## Workflow

1. **Subject.** From the README, the brief, or the user, write down three things: what the product is, who uses it, and the screen's one job. Every template judgment is made relative to these. Done when each fits in one sentence.
2. **Load the tells.** Read [TELLS.md](TELLS.md) in full.
3. **Look.** Take screenshots at 1440px and 375px when the environment allows it (start the dev server and drive a browser or Playwright). If the user gave images or mockups, work from those. Otherwise read the markup and styles for every page or route in scope (the paths the user named, or the scope the invoking skill passed). If the scope holds no markup, styles, or components and the user gave no images, report "nothing in scope" and stop. Done when every screen in scope has a screenshot or has been read.
4. **Measure.** Run `node scripts/tokens.mjs <ui-src>` for distinct colors, neutrals, radii, shadows, fonts, sizes, unused CSS variables, and which files animate without a `prefers-reduced-motion` path. Run `node scripts/scan.mjs <ui-src>` for lexical tells. Find the project's scale (Tailwind config, CSS variables, theme file) so the counts have something to compare against. Done when you can say how many values the scale defines per category.
5. **Findings.** List each finding as `screen or path:line  ui-N  what  ->  fix`, tagged craft or template. Every scanner hit is judged, and every screenshot is checked against the template tells the scanner can't see (`ui-2`, `-3`, `-9`, `-10`, `-12`, `-14`, `-18`).
6. **Fix craft tells.**
   - Map raw values onto the existing scale.
   - Add the missing states.
   - Restore visible focus, and use native elements with accessible names.
   - Fix contrast to WCAG AA.
   - Respect `prefers-reduced-motion`. One rule in the base stylesheet covers CSS animations; animation libraries need their own switch (`useReducedMotion` in Motion, for example).
   - For copy, run the `unslop-text` skill (sibling folder `../unslop-text/`) on every user-facing string. Apply `ui-20` alongside it.
7. **Template tells.** Write a short direction grounded in step 1: 4 to 6 named hex colors, the type family and scale, the layout idea, and the one element meant to be memorable. Show it to the user. Restyle only after they agree, or right away if they already asked for a redesign.
8. **Verify.** Re-take the screenshots and compare them with the originals. Build, lint, and tests stay green. Run `tokens.mjs` again; the distinct counts should drop toward the scale.

## Image or mockup only

With no code, run steps 1 to 5 and deliver the findings as a critique. Give each template tell a concrete alternative tied to the subject.

## Report

Group by screen and list: craft fixes made, template proposals with their status (approved, pending, or declined), token counts before and after, and anything left open.
