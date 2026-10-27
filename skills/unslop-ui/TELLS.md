<!-- unslop-ignore-file -->
# UI tells

Ids are stable, and reports cite them. **(L)** marks the tells `scripts/scan.mjs` can find; **(T)** marks the ones `scripts/tokens.mjs` measures. Everything else needs eyes on a screenshot or the markup.

## Template tells

These are taste calls. Each is a default that shows up regardless of subject. Any of them is fine when the brief asks for it. When nothing in the brief chose it, it is a tell.

- **ui-1 Default gradients (L).** Purple, indigo, or violet washes into blue or pink, and gradient text on one headline word. Fix: a palette drawn from the subject. Flat color unless a gradient carries meaning.
- **ui-2 Hero formula.** Centered headline with one accented word, a subhead, a primary button plus "Learn more", and a "Trusted by" logo strip. Fix: open with the most characteristic thing in the subject's world, such as the product itself, a real screenshot, or a live demo.
- **ui-3 Card-grid sameness.** Everything chopped into identical rounded cards, including the 3-up feature grid of icon-in-tinted-circle, title, and two lines. Fix: vary the form by content. Use a list for a list, a table for comparison, and prose for an argument.
- **ui-4 One radius, one shadow (T).** The same `rounded-2xl` and `shadow-lg` on every element regardless of hierarchy. Fix: radius and elevation that encode hierarchy, from a small defined set.
- **ui-5 Glass and glow (L).** Backdrop-blur panels, blurred color blobs, neon glow shadows used as decoration. Fix: remove them; use solid surfaces.
- **ui-6 Stock icons as content (L).** Sparkles, Zap, Rocket, and Shield icons, or emoji, standing in for feature illustrations. Fix: real product imagery, or no icon.
- **ui-7 Template chrome (L).** A "✨ New" pill above the hero, tracked-out ALL-CAPS eyebrows over every heading, numbered 01/02/03 markers on things that aren't a sequence, `A · B · C` meta strings, `→` appended to every link. Fix: keep only the chrome that encodes information.
- **ui-8 Fabricated proof (L).** "10K+ users", "99.9% uptime", invented testimonials, placeholder logos. Fix: real numbers with sources. If the numbers don't exist, cut the section.
- **ui-9 Default type.** One system or Inter family at default weights with no deliberate scale, or sizes picked ad hoc. Fix: a chosen family (two at most) and a stated scale.
- **ui-10 Studio defaults.** Cream background with a serif display and a terracotta accent; near-black with one acid-green accent; newspaper hairlines with zero radius. Fix: the same as ui-1, choose for the subject.
- **ui-11 Motion everywhere (L).** Fade-up on every section, hover-lift on every card, pulsing badges, `transition-all`. Fix: one deliberate moment, plus motion that answers a user action.
- **ui-12 Symmetric sameness.** Everything centered, every section the same width and padding, image and text alternating sides. Fix: hierarchy, meaning a clear primary element per screen and spacing that groups related things.

## Craft tells

These are bugs. Fix them without asking.

- **ui-13 Token sprawl (L, T).** Near-duplicate colors and grays, many radii, shadows, or font sizes; raw values that bypass existing tokens; arbitrary values (`mt-[13px]`, `bg-[#5b5bd6]`). Fix: map every value onto the project's scale. Extend the scale only for a real gap.
- **ui-14 Missing states.** Only the happy path exists. Empty, loading, error, disabled, and long-content states are missing. Fix: design each state. An empty state tells the user what to do next.
- **ui-15 Contrast (L).** Body text below 4.5:1 (large text below 3:1), such as light gray on white or a placeholder used as the label. Fix: darken to pass WCAG AA, and use visible labels.
- **ui-16 Focus removed (L).** `outline-none` with no visible replacement, or interactions reachable only by mouse or hover. Fix: a visible `:focus-visible` style and a working keyboard path.
- **ui-17 Semantics (L).** Clickable `div`s, `img` without `alt`, icon-only buttons without an accessible name, skipped heading levels, links styled as buttons that act as buttons. Fix: the native element with its name.
- **ui-18 Responsiveness.** Fixed widths, horizontal scroll at 375px, hover-only affordances, tap targets under 24px. Fix: fluid layout checked at mobile width, with targets of at least 24px (44px preferred).
- **ui-19 Reduced motion ignored (L).** Animation with no `prefers-reduced-motion` path. Fix: disable or shorten non-essential motion under it.
- **ui-20 Copy slop (L).** "Unlock", "Supercharge", "Elevate your workflow"; vague CTAs ("Get started", "Learn more", "Submit"); "Oops! Something went wrong"; an action renamed mid-flow. Fix: name things from the user's side. A button names its exact action ("Save changes"), the same action keeps the same name through the flow, and an error says what happened and how to fix it. Run `unslop-text` on all copy.
- **ui-21 Placeholder residue (L).** Lorem ipsum, "John Doe", "Acme", example.com, `placehold.co` images, "Feature 1/2/3". Fix: real content from the project, or ask.
