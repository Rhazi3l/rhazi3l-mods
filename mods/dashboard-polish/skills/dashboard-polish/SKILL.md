---
name: dashboard-polish
description: Restyles an existing dashboard, or builds a new one, so it stops looking AI-generated. Audits the tells, then fixes spacing, colour, icons, copy, type, and bars and tables in order, on a neutral charcoal and burnt-orange base with pastel data colours, with dark and light modes (dark by default). Use when the user asks to polish, restyle, clean up or build a dashboard, KPI page, metrics page or data view, or says it looks generic, vibecoded or AI-made.
license: CC-BY-4.0
---

# Dashboard polish

Adapted from unslop by Damir Sokolovsky (https://github.com/heydamir/unslop), licensed CC BY 4.0. This version narrows it to dashboards, covers five of its passes (spacing, colour, icons, copy, type), adds bar, table and cohesion rules, and swaps in a fixed charcoal and orange base. Keep this credit in any copy.

Fix the craft and keep the product. Features, numbers, charts and section order stay. Every size, colour, word and icon becomes deliberate. Keep the chrome quiet and put the colour into the data.

## Restyling an existing dashboard

1. Look at it. If you can render it, do so, so you judge what people see and not only the code.
2. Audit. List every tell with where it lives, one line each. Typical tells: hue gradients, glows, gradient text, emoji labels, "New" badges, tracked uppercase labels, greeting headlines, exclamation marks, uneven spacing, many font weights, ten shades of one grey.
3. Write five lines.
   - Product: what it does and for whom.
   - Character: two or three concrete words. Not clean, modern, sleek, minimal or premium.
   - World: the material the product belongs to. This tints the data colours, not the surfaces.
   - Moments: one or two places that may carry rich colour, such as the main chart.
   - Signature: one small detail used consistently, such as a live status dot.
4. Show the audit and the five lines, then wait for the user's answer before editing. Skip the wait only if they said to just do it.
5. Apply passes 1 to 6 below in order, finishing each across the whole dashboard before the next.
6. Check against the audit list, render again, and fix what is left. Then run the sweep in [references/cohesion.md](references/cohesion.md) and fix every panel that differs.
7. Report (see Reporting back).

## Building a new dashboard

Skip the audit. Write the five lines, then build to the passes below. Use plausible data, never `[X]` or `123,456`.

## Always

- Two modes, dark and light, switchable, with dark as the default whatever the system setting says. Define every colour as a CSS variable once for dark and once for light. Never hard-code a colour in a component.
- Add a theme button in the filter or toolbar row, after the last control: a square icon button the height of a row, moon when the page is light and sun when it is dark, with `aria-pressed` and an `aria-label` that names the action (`Switch to light theme`). It toggles `data-theme` on the root element between `light` and `dark`, and sets `dark` once at load if none is set. The choice is not stored, so it resets on reload. Say so, and say that a host viewer's own theme control may override it, which is untested.
- If the host environment already provides theme switching, keep dark as the starting mode and use its mechanism.
- Check contrast in both modes. Text needs 4.5 to 1.
- Unless the data says otherwise, use British English, metric, 24-hour time and GBP.
- If the dashboard is built on a host with a page check or data store, read [references/artifact-hosts.md](references/artifact-hosts.md) first.

## 1. Spacing

- 4px grid. Margins, paddings, gaps and fixed heights are multiples of 4. A 2px nudge inside small controls is fine.
- Same thing, same size. Rows in a list share one height and gap, cards in a row share one padding.
- Space inside a group is smaller than space between groups.
- Things line up: icons in one column, labels on one line, numbers aligned right.
- Padding follows density: compact panels and sidebars about 16, cards 20 to 24, page edges 24 to 32.
- Remove one-off values like `mt-[13px]`.

## 2. Colour

Fixed base, from the rhazi3l theme: a neutral dark charcoal and the burnt orange accent `#d4743c`. All values, in both modes, are in [references/palette.md](references/palette.md). Do not change them.

- Surfaces, borders and text come only from the neutral ramp. The data carries the colour.
- Three text roles: primary, secondary, muted.
- The orange accent is used rarely: the primary action, the selection, in-progress, the one number that matters. Text on an orange fill is dark.
- Borders are hairlines. Depth on dark comes from surface steps and hairlines, not shadows. On light, shadows are neutral, soft and small.

Flexible, a guide only. For charts, bars, tags and status dots, choose soft pastel colours that sit well on the charcoal. The starting set and its meanings are in [references/palette.md](references/palette.md). Adjust hues, softness and count to fit the product, as long as these hold.

- Each colour means one thing and is used the same way everywhere.
- No grey bar fills on dark. A grey bar, or one close to the card colour, is hard to see. Fill every bar with a data colour. Grey is only for the status that means off, unstarted or baseline, and the track behind a bar is a faint neutral tint.
- A bar that shows a status takes that status's colour, the same as its dot and legend. A bar with no status of its own (for example a count per year) takes one series colour. Prefer one not already used for a status, and if every colour is taken, say which meaning it shares.
- Good, bad, warning and in-progress keep their usual meaning, toned down.
- Red is last in a series order, because it reads as bad.
- Four series or fewer where possible, and check that neighbours are easy to tell apart.
- Soft fill (the colour at 15 to 25 percent opacity) with a full-strength stroke or text of the same hue. Dark text on any solid fill.
- In light mode, darken the pastels until text on or in them reaches 4.5 to 1.
- No hue-to-hue gradients, glows, coloured shadows, gradient text or colour washes behind content. A gradient is allowed only as a small tone shift inside one neutral.

## 3. Icons

- Replace emoji used as icons or decoration with line icons from one set, the project's own if it has one, otherwise lucide.
- One size and one stroke everywhere, 16 or 18px at 1.5.
- Icons take the colour of their text role, never their own.
- Fixed icon box width and gap so labels align.
- Drop icons that add nothing.

## 4. Copy

- The title names the context, like the page or the period (`November 2026`). No greeting headlines.
- No exclamation marks in interface text.
- Short labels. `Search`, not `Search anything...`.
- A change says what it compares to: `+12% vs last month`.
- Headings, labels, buttons and captions end without a full stop. Only multi-sentence paragraphs keep them.
- No hype words (supercharge, seamless, unlock, magic) and no `AI-powered` everywhere.
- Claims that cannot be checked, like `Loved by 10,000+ teams`, are removed unless the user confirms them. List them in the report.
- Remove badges like `PRO` or `New ✨` unless the product needs them, then quiet text.
- Separators in meta lines are one character everywhere (a middle dot with spaces). Dates and units use one format. Sentence case in every heading, label and button.

## 5. Type

- One family on the page wrapper, plus at most one partner, such as a mono for figures. Keep the project's own font if it is a real brand choice.
- Four sizes: caption (tables, lists, notes, controls, labels), body, heading (card titles), title (page title and headline figures). A fifth size is a defect.
- One weight (400). Hierarchy comes from size and colour.
- Sentence case. No uppercase, letter-spacing or italics.
- Figures use tabular numerals, set once on the wrapper.

## 6. Bars, tables and alignment

Apply in the first pass, so they do not have to be asked for. Rules and values are in [references/bars-tables.md](references/bars-tables.md).

## Reporting back

- Say that you have not seen the live render, unless you have.
- What changed per pass, any claim removed, and any text and background pair that misses 4.5 to 1.
- Where a colour could not be changed, name it and the reason (for example the grey off status).
- List the knock-on effects of each change, such as other panels that share a style, or data text that still uses the wrong voice, each with its fix.
- State what the change costs, such as taller rows or a narrower bar.

## Not covered

Layout restructuring, generated hero visuals, motion and story videos from the original unslop are not part of this skill. If the user wants them, say so and suggest the original.
