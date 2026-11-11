---
name: "dashboard-polish"
description: "Restyles an existing dashboard, or builds a new one, so it stops looking AI-generated. Audits the tells, then fixes spacing, colour, icons, copy and type in order, on a soft charcoal and burnt-orange base with pastel data colours, with dark and light modes (dark by default). Use when the user asks to polish, restyle, clean up or build a dashboard, KPI page, metrics page or data view, or says it looks generic, vibecoded or AI-made."
license: CC-BY-4.0
---

# Dashboard polish

Adapted from unslop by Damir Sokolovsky (https://github.com/heydamir/unslop), licensed CC BY 4.0. This version narrows it to dashboards, covers five of its passes (spacing, colour, icons, copy, type) and swaps in a fixed charcoal and orange base. Keep this credit in any copy.

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
5. Apply the passes below in order, finishing each across the whole dashboard before the next.
6. Check against the audit list, render again, and fix what is left. Then run the cohesion sweep below and fix every panel that differs.
7. Report what changed per pass, any claim you removed, and any text and background pair that misses 4.5 to 1.

## Building a new dashboard

Skip the audit. Write the five lines, then build to the passes below. Use plausible data, never `[X]` or `123,456`.

## Always

- Two modes, dark and light, switchable, with dark as the default whatever the system setting says. Define every colour as a CSS variable once for dark and once for light. Never hard-code a colour in a component.
- Add a theme button. Put it in the filter or toolbar row, after the last control, as a square icon button the height of a row: moon when the page is light, sun when it is dark, with `aria-pressed` and an `aria-label` that names the action (`Switch to light theme`). It sets `data-theme` on the root element between `light` and `dark`. When no `data-theme` is set, set `dark` once at load. The choice is not stored, so it resets on reload. Say so, and say that the host viewer's own theme control may override it, because that was not tested.
- If the host environment already provides theme switching, keep dark as the starting mode and use its mechanism.
- Check contrast in both modes. Text needs 4.5 to 1.
- Unless the data says otherwise, use British English, metric, 24-hour time and GBP.

## 1. Spacing

- 4px grid. Margins, paddings, gaps and fixed heights are multiples of 4. A 2px nudge inside small controls is fine.
- Same thing, same size. Rows in a list share one height and gap, cards in a row share one padding.
- Space inside a group is smaller than space between groups.
- Things line up: icons in one column, labels on one line, numbers aligned right.
- Padding follows density: compact panels and sidebars about 16, cards 20 to 24, page edges 24 to 32.
- Remove one-off values like `mt-[13px]`.

## 2. Colour

Fixed base, from the user's theme. Do not change these.

- Dark neutral charcoal ramp, darker and not blue-tinted, with a burnt orange accent `#d4743c`. The user asked for this after seeing the blue-tinted version, so where the dark values in [references/palette.md](references/palette.md) differ from the table below, use this table. The light values and the accent stay as in palette.md.

| Role (dark) | Value |
|---|---|
| Page | `#121212` |
| Card | `#1d1d1d` |
| Border | `#2a2a2a` |
| Text primary | `#d2d2d2` |
| Text secondary | the midpoint between primary and muted |
| Text muted | `#9b9b9b` (about 6 to 1 on the card, my arithmetic, recheck if changed) |
| Grey series (the off or baseline status) | `#7a7a7a` |

  Hover and track tints are the text colour at about 8 percent, so they stay neutral.
- Surfaces, borders and text come only from this ramp and stay neutral. The data carries the colour.
- Three text roles: primary, secondary, muted.
- The orange accent is used rarely: the primary action, the selection, in-progress, the one number that matters. Text on an orange fill is dark.
- Borders are hairlines, the text colour at 6 to 10 percent opacity.
- Depth on dark comes from surface steps and hairlines, not shadows. On light, shadows are neutral, soft and small.

Flexible, a guide only. For charts, bars, tags and status dots, choose soft pastel colours that sit well on the charcoal. The starting set and its meanings are in [references/palette.md](references/palette.md). Adjust hues, softness and count to fit the product, as long as these hold.

- Each colour means one thing and is used the same way everywhere.
- No grey bar fills on dark. A bar that is grey, or close to the card colour, is hard to see, and the user rejected it twice (progress bars, the by-year bars). Fill every bar with a data colour. Grey is only for the status that means off, unstarted or baseline, and the track behind a bar is a faint neutral tint.
- A bar that shows a status takes that status's colour, the same as its dot and legend. A bar with no status of its own (for example trophies per year) takes one series colour. Prefer one not already used for a status, and if every colour is taken, say which meaning it shares.
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

## 5. Type

- One family for the interface, plus at most one partner, such as a mono for figures. Keep the project's own font if it is a real brand choice.
- A few sizes from a scale, weights 400 and 500 only, 600 at most for rare emphasis.
- Hierarchy comes from size and colour, not weight.
- Sentence case. No tracked uppercase labels.
- Figures that stack use tabular numerals.

## 6. Bars, tables and alignment

These came from the user's review of a polished dashboard. Apply them in the first pass, so they do not have to be asked for.

- Progress bars in table rows: the number sits in a fixed-width, right-aligned box (`min-width: 3ch`) and the bar sits left of it in a flex row that is right-aligned. Bars then start at the same x in every row. The vertical centring was already right, and the visible misalignment came from numbers of different widths. Fill the bar with the row's status colour.
- Value columns in bar lists (a bar, then a figure such as `25 · 1238`): give the column a width that fits the longest value and forbid wrapping. Anchor any marker, such as a platinum square, to the left edge of the column, so it does not move with the length of the text.
- Rows that repeat across a list, such as pick or watch rows, share one set of columns (CSS subgrid on the list, `grid-column: 1 / -1` on each row). Per-row grids with an `auto` column put the second column at a different x in every row.
- A detail that belongs to every row, such as a platinum guide, gets its own column and not a line under the name. Where a row has no value, render an empty cell so the later columns stay aligned. Below about 560px, stack to one column.
- Tables do not scroll sideways by default. Let the first column and long text columns wrap, with minimum widths of about 160px and 144px, and keep numbers and dates on one line. Apply this to every table on the page, not only the biggest. A long title may then make a row taller. Say so. If it still scrolls on a narrow window, hide the least important column below a breakpoint.
- Round bar ends slightly (2px) on small bars.

## Dashboard artifacts with a page check

Some hosts build the dashboard from a page plus a data store, and check the page.

- Work on a copy when the user has one. Never touch the original.
- Do the audit and the passes as text edits to the page, with asserted replacements, so a missed target fails loudly. Check the script with `node --check` before publishing.
- Pin every write to the version you last read, and re-read the version before a second write.
- Script rules on a one-writer page: outside a drawing, a script may only set `class`, `style`, `hidden`, `open`, `disabled`, `checked`, `selected`, `value`, `tabindex` and `aria-*`. Text that depends on data lives in elements marked as drawings and stored empty. Drawings must not be nested, and a drawing inside a hidden element does not run, so show or hide optional sections from the data callback.
- The look (colours per mode, charts in order) is its own document. A whole replacement clears tweaks, and a partial update replaces the nested mode object, so send the complete dark or light object.
- Read the page check after publishing. If no tab has the dashboard open, there is no result, so say that and do not claim a pass.
- Use a real clock for edit timestamps.

## Reporting back

- Say that you have not seen the live render, unless you have.
- Where a colour could not be changed, name it and the reason (for example the grey status segment).
- List the knock-on effects of each change, such as other panels that share a style, or data text that still uses the wrong voice, each with its fix.
- State what the change costs, such as taller rows or a narrower bar.

## Cohesion sweep

A dashboard is judged panel against panel. The user found mismatches by eye (a thinner progress bar, grey bars in one panel, square corners beside round ones, a column that did not line up). Prevent that with tokens and a check.

Define each of these once, as a variable, and use it everywhere. Never write the number inside a component.

| Token | Used by | Rule |
|---|---|---|
| Row height | table rows, bar rows, legend rows, list rows, buttons, inputs, selects | one value, a multiple of 4 (32px). Only wrapping text rows grow |
| Bar thickness | progress bars, bar-list tracks | one value (8px). A headline segmented bar may be larger, and is named in the report |
| Bar radius | every bar, fill and track | one value (4px), so 8px bars are pills |
| Track tint | every bar track | the same faint neutral (text at about 8 percent) |
| Marker size and radius | status dots, series squares, legend squares | one size (8px), one small radius (2px) |
| Chip height | filter chips, platform tags, any tag | one value (24px) |
| Card padding, heading and note spacing | every card | same padding, same heading size and margin, same note style |
| Link style | every link | one colour (secondary), one underline, one hover (primary) |
| Hover and selected | every clickable row, legend item, list item | the same hover tint, the same selected tint, the same corner radius |
| Separators | tables and text lists | hairline between rows. Bar rows have none |

Sweep, in this order, after the passes:

1. Write a grid with one line per panel and one column per token above. Fill it from the code, not from memory.
2. Any cell that differs from the rest of its column is a defect unless the report names the reason.
3. Check the data colours panel by panel. Each meaning has one colour everywhere. No panel has a grey bar unless it shows the grey status. A bar with no status of its own takes the same series colour in every panel where that happens (for example trophies per year and games per genre).
4. Check alignment in each repeated structure: values in one column start at the same x, markers sit on the same edge, repeated rows share columns.
5. Check every table for sideways scroll, and every panel for text that wraps unevenly.
6. Report the grid's exceptions and the fixes. List only what changed or what you kept on purpose.

## Type, colour and state cohesion

The same sweep covers type, colour and interaction states. Count them from the code, for example by listing every distinct `font-size`, `font-weight`, `color`, `opacity` and literal colour with `grep`. The count should match the scale below.

Type
- One family, set once on the page wrapper. No panel sets its own.
- Four sizes from the host or a scale: caption (tables, lists, notes, controls, labels), body (running text and the lead line), heading (card titles), title (page title and headline figures). A fifth size is a defect.
- One weight (400). Hierarchy comes from size and colour.
- Figures are tabular everywhere, set once on the wrapper.
- No uppercase, no letter-spacing, no italics.

Text colour
- Three roles only, used by meaning and the same in every panel: primary for names, figures and values, secondary for supporting text and links, muted for labels, notes and captions. A value that is secondary in one panel and primary in another is a defect. Figures are primary everywhere, including bar-list values.
- No literal colour inside a component. Every colour is a token or comes from the look.

Data colour map
- Write the map once: each status or series, its colour, and where it appears (bar, dot, legend, chip, tag). Check that every panel follows it.
- If a colour has to be reused for a series with no status (for example trophies per year and games per genre), use the same one in every such panel and state in the report which meaning it shares.
- The accent marks selection, focus and the in-progress status only.

States
- One faded opacity token for disabled and filtered-out items. Not two close values.
- One hover tint, one selected tint, one focus ring (2px accent, 2px offset) on everything interactive.
- One transition (opacity, background and colour, same duration and easing) on every button and link, and none when the user prefers reduced motion.
- Loading or refreshing state may use its own value, which is named in the report.

Copy
- Separators in meta lines are the same character everywhere (a middle dot with spaces). Dates and units use one format throughout. Sentence case in every heading, label and button.

## Not covered

Layout restructuring, generated hero visuals, motion and story videos from the original unslop are not part of this skill. If the user wants them, say so and suggest the original.