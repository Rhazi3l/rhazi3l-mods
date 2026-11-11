---
name: "dashboard-polish"
description: "Restyles an existing dashboard, or builds a new one, so it stops looking AI-generated. Audits the tells, then fixes spacing, colour, charts, tables, icons, copy and type in order, on a soft charcoal and burnt-orange base with pastel data colours, with dark and light modes (dark by default). Use when the user asks to polish, restyle, clean up or build a dashboard, KPI page, metrics page or data view, or says it looks generic, vibecoded or AI-made."
license: CC-BY-4.0
---

# Dashboard polish

Adapted from unslop by Damir Sokolovsky (https://github.com/heydamir/unslop), licensed CC BY 4.0. This version narrows it to dashboards and swaps in a fixed charcoal and orange base. Keep this credit in any copy.

Fix the craft and keep the product. Features, numbers, charts and section order stay. Every size, colour, word and icon becomes deliberate. Keep the chrome quiet and put the colour into the data.

## Process

Restyling an existing dashboard:

1. Look at it. If you can render it, do so, so you judge what people see and not only the code.
2. Audit. List every tell with where it lives, one line each. Typical tells: hue gradients, glows, gradient text, emoji labels, "New" badges, tracked uppercase labels, greeting headlines, exclamation marks, uneven spacing, many font weights, ten shades of one grey, grey bars, the same chart form repeated.
3. Write five lines.
   - Product: what it does and for whom.
   - Character: two or three concrete words. Not clean, modern, sleek, minimal or premium.
   - World: the material the product belongs to. This tints the data colours, not the surfaces.
   - Moments: one or two places that may carry rich colour, such as the main chart.
   - Signature: one small detail used consistently, such as a live status dot.
4. Show the audit and the five lines, then wait for the user's answer before editing. Skip the wait only if they said to just do it.
5. Apply sections 1 to 8 in order, finishing each across the whole dashboard before the next.
6. Run the sweep in section 9 and fix every panel that differs. Render again.
7. Report as described in section 11.

Building a new dashboard: skip the audit, write the five lines, and build to sections 1 to 8. Use plausible data, never `[X]` or `123,456`.

## Always

- Two modes, dark and light, switchable, dark by default whatever the system setting says. Define every colour once per mode as a variable. Never hard-code a colour in a component.
- Add a theme button after the last control in the filter or toolbar row: a square icon button one row high, moon when the page is light and sun when it is dark, with `aria-pressed` and an `aria-label` that names the action. It sets `data-theme` on the root element between `light` and `dark`, and sets `dark` once at load if none is set. The choice is not stored. Say so, and say the host's own theme control may override it, because that was not tested. If the host already provides theme switching, use that and keep dark as the start.
- Text needs 4.5 to 1 in both modes. Check with a script, not by eye.
- Unless the data says otherwise, use British English, metric, 24-hour time and GBP.

## 1. Spacing

- 4px grid. Margins, paddings, gaps and fixed heights are multiples of 4.
- Same thing, same size. Rows in a list share one height and gap, cards in a row share one padding.
- Space inside a group is smaller than space between groups.
- Things line up: icons in one column, labels on one line, figures aligned right.
- Padding follows density: compact panels about 16, cards 20 to 24, page edges 24 to 32.
- Remove one-off values like `mt-[13px]`.

## 2. Colour

Surfaces and accent are fixed. Everything else is a guideline, not a list of values.

| Role | Dark (default) | Light |
|---|---|---|
| Page | `#151618` | `#e8eaee` |
| Card | `#202225` | `#f5f6f8` |
| Border | `#303338` | `#d3d8e0` |
| Accent (burnt orange) | `#d4743c` | `#af5926` |

The dark ramp has only a faint cool tint. The user compared plain charcoal (too dark) and a blue-tinted theme (too blue) and chose the middle. The light card is a soft off-white and never pure white. Text colour is derived and not listed: three roles, primary (at least 10 to 1 on the card), secondary (about 7 to 1) and muted (at least 5 to 1), all neutral with the same faint tint as the surfaces. Hover and track tints are the primary text colour at about 8 percent. The selected tint is the accent at 20 percent over the card. Depth on dark comes from surface steps and hairlines, not shadows. On light, shadows are neutral, soft and small. Borders are hairlines.

The accent is rarely used:

- It is the primary action and button fill, the selection, focus, and the outline of a selected or focused item. Text on an orange fill is dark in dark mode and white in light mode.
- Its two decorative uses are a 3px bar, one heading tall, before every section title, and a 2px top edge on the headline figure boxes. No other card, panel or table gets an orange edge, because more feels overused. If it does, remove it from boxes before titles. A 1px edge is barely visible on light.
- It is never a data colour: not a bar, dot, segment, tag or status, including in progress.

Data colours. Choose them for the product within these rules. Do not copy a palette from a previous dashboard.

- Pastel in both modes: soft, moderately saturated, no vivid or neon colours. On dark, at least 3 to 1 against the card. On light, keep the hue, lower the saturation as well as the lightness, and darken only until each bar and dot reaches 4.5 to 1 against the light card (not against white). Green stays green and red stays red.
- Meaning first. Green means good or done and red means bad, and neither is used for anything else. Red appears only when the data has a bad state and comes last in any series order. Every other hue is free, yellow included.
- Unique. Each category gets one colour that no other category or meaning on the dashboard uses, the accent included. Reusing a colour for a second meaning is a defect unless the report names it.
- Use only the colours the data needs, at most about six hues spaced evenly round the wheel (45 to 50 degrees apart). Group the rest.
- At most two tones of any hue across the whole dashboard, for example a strong fill and a soft tint. A third shade is a defect, so take another hue. Hues within about 40 degrees of each other count as one hue.
- No grey bars in either mode, because they blend into the background. Every status, including unstarted or off, gets a colour. The track behind a bar is a faint neutral tint, the only grey allowed.
- A bar that shows a status takes that status's colour, the same as its dot and legend. A bar with no status of its own takes one series colour. If it has to share a colour with a status, say which in the report.
- Soft fill (the colour at 15 to 25 percent) with a full-strength stroke or text of the same hue. Dark text on any solid fill.
- No hue-to-hue gradients, glows, coloured shadows, gradient text or colour washes. A gradient is allowed only as a small tone shift inside one neutral.
- Check before publishing. Render a swatch strip of every colour in each mode and look at it. On a host that checks the look, a chart colour too close to an earlier one is silently replaced by the dashboard's default, often a vivid colour that matches nothing. Measure the distance between every pair in each mode (CIE Lab, at least about 30) and fix any close pair. After publishing, check every slot shows the colour you chose.

Keys and legends:

- Every chart that uses colour gets a key: a one-line row of 12px squares with short labels between the heading and the chart. A marker beside a figure says which key colour it belongs to. Where a colour means the same as in another card, use the same word.
- Do not rely on a colour, a marker or an earlier panel to explain itself.

## 3. Charts

- Vary the form. Use one form at most twice on a dashboard and prefer a different one wherever the data allows. Pick from the data: a segmented bar for shares of one whole, vertical columns for time (oldest first, left to right), horizontal bars for ranked categories, a dot plot for a rate per category (one row each, one marker on a 0 to 100% scale, sorted high to low, figure on the right), a table for detail.
- Do not use pies or rings. The user rejected them. A segmented bar is right only when the parts do not overlap and add up to one whole, so overlapping categories such as tags where an item can have several are not a bar or a pie.
- Every chart keeps the same bar thickness, bar radius (pills), marker size, track tint and key style. Bar ends are fully rounded.
- A clickable bar, column or row uses the same hover, selected and faded states.
- Bar lists: cap the name column at about 45% of the card with an ellipsis and the full name in the hover text, and keep at least 64px for the bar. Give the value column a width that fits the longest value and forbid wrapping. Anchor any marker to the left edge of that column.
- A progress number sits in a fixed-width, right-aligned box (`min-width: 3ch`) beside its bar, so bars start at the same x in every row.
- A note under a chart is one line, two at most. It says only what the reader needs to read the chart. Detail goes in a tooltip or the report.

## 4. Tables and lists

- Rows that repeat across a list share one set of columns (CSS subgrid, `grid-column: 1 / -1` on each row). A detail that belongs to every row gets its own column, and an empty cell where there is no value. Below about 560px, stack to one column.
- Columns that hold figures, dates and statuses hug their content. Only one or two long text columns (genres, a description) get a width, in rem and stepped by the table box width with container queries (about 14rem narrow, 18rem medium, 20rem wide). The title column takes the slack, never a tag column. Tags and chips never wrap their own text.
- Text columns are left-aligned. Figures and dates are right-aligned. A bar then a number is left-aligned. Header and cells always match.
- A header says what is counted and the unit: `Played (h)`, not `Hours`. Add a hover that spells it out.
- Tables do not scroll sideways. Let the title and long text columns wrap (minimum widths about 160px and 144px), keep figures and dates on one line, and apply this to every table. A long title may make a row taller, so say so. If it still scrolls on a narrow window, hide the least important column.
- Two rows with the same name get a distinguishing suffix, such as the platform.

## 5. Type

- One family for the whole dashboard, set once on the page wrapper: the host's own sans family where it provides one (on the Dashboard artifact type, `--font-anthropic-sans`), because it is the same on every device. Do not default to a monospace face. The user rejected both a system mono stack, which differs on Windows, Mac and Linux, and the host mono token, which did not take effect. Native controls such as selects, buttons and inputs must inherit the family.
- Four sizes, no fifth: caption (tables, lists, notes, controls, legends, chips, the sub-text under a figure), body (running text and the lead line), heading (every title, section titles and headline box titles alike), title (page title and headline figures). If a title uses a size, all titles use it.
- One weight (400). Hierarchy comes from size and colour. Sentence case, no uppercase, no letter-spacing, no italics.
- Figures are tabular, set once on the wrapper.
- Text colour by role, the same in every panel: primary for titles, names, figures and values, secondary for supporting text and links, muted for small labels, notes and sub-text. A value that is secondary in one panel and primary in another is a defect.

## 6. Icons

- Replace emoji used as icons with line icons from one set, the project's own if it has one, otherwise lucide.
- One size and stroke everywhere (16 or 18px at 1.5), the colour of their text role, in a fixed box so labels align. Drop icons that add nothing.

## 7. Copy

- The title names the page. Add a period or date only when the page is scoped to it, and never when the same date is in the subtitle or a status line.
- No greeting headlines, exclamation marks, hype words (supercharge, seamless, unlock, magic) or `AI-powered` badges. Remove `PRO` or `New` badges unless the product needs them.
- Short labels. `Search`, not `Search anything...`. A change says what it compares to: `+12% vs last month`.
- Headings, labels, buttons and captions end without a full stop. Only multi-sentence paragraphs keep them.
- Claims that cannot be checked, such as `Loved by 10,000+ teams`, are removed unless the user confirms them. List them in the report.
- Separators in meta lines are one character everywhere (a middle dot with spaces). Dates and units use one format.

## 8. Page structure

- Each section is a wrapper holding the title, then the box. The title sits above its box with the orange bar before it. Hide, show and scroll to sections on the wrapper.
- Headline figures are separate boxes of equal height: a title (heading size), the figure (title size) and sub-text (caption size), a 2px orange top edge and hairline sides and bottom. A marker after a figure is a pseudo-element, so the figure does not shift.
- Boxes in one row share a height.

## 9. Tokens and the cohesion sweep

A dashboard is judged panel against panel. Define each token once as a variable and use it everywhere. Never write the number inside a component.

| Token | Used by | Value |
|---|---|---|
| Row height | table, bar, legend and list rows, buttons, inputs, selects | 28px. Only wrapping text rows grow |
| Bar thickness | progress bars, bar tracks | 8px. A headline segmented bar may be larger and is named in the report |
| Bar radius | every bar, fill and track | 4px, so 8px bars are pills |
| Marker | status dots, series squares, key squares | 12px, 3px radius |
| Chip height | filter chips, platform tags, any tag | 24px |
| Card | every card | same padding, note style and spacing |
| Link | every link | secondary colour, one underline, primary on hover |
| Hover, selected | every clickable row, legend item, list item | the same tints and corner radius |
| Separators | tables and text lists | hairline between rows. Bar rows have none |
| Faded | disabled and filtered-out items | one opacity |

States:

- One focus ring everywhere interactive, selects, segmented buttons, Reset and the theme button included: 2px accent, 1px offset. A 1px ring was too faint on light. A selected row in a list uses a 1px inset accent outline with the selected tint, because 2px looks heavy on tight rows. Check the host's own focus style is not adding a second ring.
- One transition (opacity, background, colour, same duration and easing) on every button and link, none when the user prefers reduced motion.

Sweep, after the passes:

1. Write a grid with one line per panel and one column per token. Fill it from the code, not memory. A cell that differs from its column is a defect unless the report names the reason.
2. Count the distinct `font-size`, `font-weight`, `color`, `opacity` and literal colour values with `grep`. The counts match sections 2 and 5. No literal colour sits inside a component.
3. Write the data colour map once: each status or series, its colour, and where it appears (bar, dot, key, chip, tag). Check every panel follows it and no panel has a grey bar.
4. Check alignment in every repeated structure, every table for sideways scroll, and every panel for uneven wrapping.

## 10. Dashboard artifacts with a page check

Some hosts build the dashboard from a page plus a data store and check the page.

- Work on a copy when the user has one. Never touch the original.
- Make the changes as text edits with asserted replacements, so a missed target fails loudly. Run `node --check` on the script before publishing.
- Pin every write to the version you last read, and re-read before a second write.
- On a one-writer page, outside a drawing a script may only set `class`, `style`, `hidden`, `open`, `disabled`, `checked`, `selected`, `value`, `tabindex` and `aria-*`. Data-dependent text lives in empty elements marked as drawings. Drawings are not nested, and a drawing inside a hidden element does not run, so show or hide optional sections from the data callback.
- The look (colours per mode, charts in order) is its own document. A whole replacement clears tweaks, and a partial update replaces the nested mode object, so send the complete dark or light object.
- Read the page check after publishing. If no tab has the dashboard open there is no result, so say so and do not claim a pass.
- Use a real clock for edit timestamps.

## 11. Reporting back

- Say you have not seen the live render, unless you have, and ask for screenshots in dark, light and at phone width.
- List what changed per pass, any claim you removed, any text and background pair below 4.5 to 1, any colour that could not be changed and why, and what each change costs (taller rows, a narrower bar).
- List the knock-on effects of each change, such as other panels that share a style, each with its fix.

## Not covered

Layout restructuring, generated hero visuals, motion and story videos from the original unslop are not part of this skill. If the user wants them, say so and suggest the original.