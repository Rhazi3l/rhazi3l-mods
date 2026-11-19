---
name: "dashboard-polish"
description: "Restyles an existing dashboard, or builds a new one, so it stops looking AI-generated. Audits the tells, then fixes spacing, colour, charts, tables, icons, copy, type, card layout and interaction in order, on a charcoal and burnt-orange base with pastel data colours, compact spacing tokens, rounded chart segments, equal-height paired cards, side-drawer drill-downs and tick-box filters, with dark and light modes (dark by default). Use when the user asks to polish, restyle, clean up or build a dashboard, KPI page, metrics page or data view, or says it looks generic, vibecoded or AI-made."
---

# Dashboard polish

Adapted from unslop by Damir Sokolovsky (https://github.com/heydamir/unslop), licensed CC BY 4.0. This version is changed to cover dashboards only: five of its passes (spacing, colour, icons, copy, type), plus rules for data colour, charts, tables, card layout, interaction and page structure, on a fixed charcoal and orange base. Keep this credit in any copy.

The rules below are guidelines for any dashboard. Follow the Do and Do not lines. Detail sits in the reference files, which you read when the pass needs them. Where a reference file and this file differ, this file wins. The known differences are named in the pass they affect.

Keep the product. Features, numbers and section order stay. Every size, colour, word and icon becomes deliberate. Keep the chrome quiet and put the colour into the data. A chart's form may change when a better one fits the data (see [references/data-colour.md](references/data-colour.md)). List every such change in the report.

## Restyling an existing dashboard

1. Look at it. If you can render it, do so, so you judge what people see and not only the code. A screenshot usually shows only the visible part of the page, so scroll and take one per section, in both modes.
2. Audit. List every tell with where it lives, one line each. Typical tells: hue gradients, glows, gradient text, emoji labels, "New" badges, tracked uppercase labels, greeting headlines, exclamation marks, uneven spacing, many font weights, many greys, grey bars, the same chart form repeated, square bar corners, tick stubs on axes, cards of unequal height side by side, large empty areas inside cards, notes that wrap to three lines, lists that open inside a card and push its neighbours.
3. Write five lines.
   - Product: what it does and for whom.
   - Character: two or three concrete words. Not clean, modern, sleek, minimal or premium.
   - World: the material the product belongs to. It tints the data colours, not the surfaces.
   - Moments: one or two places that may carry rich colour, such as the main chart.
   - Signature: one small detail used consistently, such as a live status dot.
4. Show the audit and the five lines, then wait for the user's answer before editing. Skip the wait only if they said to just do it.
5. Apply passes 1 to 9 in order, finishing each across the whole dashboard before the next.
6. Check against the audit list, render again, and fix what is left. Then run the sweep in [references/cohesion.md](references/cohesion.md) and the checks under Reporting back, and fix every panel that differs.
7. Report (see Reporting back).

## Building a new dashboard

Skip the audit. Write the five lines, then build to the passes below and [references/page-structure.md](references/page-structure.md). Use plausible data. Do not use `[X]` or `123,456`.

## Always

- Do build two modes, dark and light, with dark as the default whatever the system setting says. Define every colour once as a CSS variable per mode.
- Do not hard-code a colour in a component.
- Do put view controls (theme button, cards picker) in the header row, right-aligned, and filters in their own bar below. The theme button is a square icon button the height of a row, showing the mode it switches to: sun when the page is dark, moon when it is light. Give it `aria-pressed` and an `aria-label` that names the action (`Switch to light theme`).
- Do toggle `data-theme` on the root element between `light` and `dark`, and set `dark` once at load if none is set.
- Do remember the theme in `localStorage` where the host allows it, with every read and write in `try/catch`, and fall back to dark. Say in the report that a host viewer's own theme control may override it, which is untested.
- If the host provides theme switching, keep dark as the starting mode and use its mechanism.
- Do redraw charts when the theme changes (destroy and recreate them), since canvas colours are read once at draw time.
- Do check contrast in both modes with a script, not by eye. Text needs 4.5 to 1. Bars, dots and other marks need 3 to 1.
- Unless the data says otherwise, use British English, metric, 24-hour time, DD/MM/YYYY and GBP.
- If the dashboard is built on a host with a page check or data store, read [references/artifact-hosts.md](references/artifact-hosts.md) first.

## 1. Spacing

The page is compact: dense data, small gaps, no padding for its own sake. Use these tokens and do not write the numbers inside components.

| Token | Value | Used by |
|---|---|---|
| `--pad` | 14px | padding inside every card |
| `--gap` | 12px | gap between cards in a row and between rows |
| Title to box | 6px | `margin-bottom` of every card title |
| Key to chart | 8px | `margin-bottom` of the colour key |
| Note to content | 12px | `margin-bottom` of a one-line card note |
| Section heading | 24px above, 10px below, 10px inside a hairline top border | group headings that split the page into sections. The first section after the headline row takes 20px above |
| Headline box padding | 12px top and bottom, 16px sides | the KPI boxes |
| Page | 24px top, 64px bottom, at least 16px sides, 1280px max width | the wrapper |
| Header to filters | 16px | |
| `--row` | 28px | buttons, inputs, selects, table rows, dropdown rows |
| `--chip` | 24px | chips, segmented buttons, tags |

- Do use even values: 4px steps by default, with the 2px half-steps above (14, 6, 10) where 4px steps leave the page too loose. This replaces the strict 4px grid and the 16 to 24px card padding in older guidance.
- Do give the same thing the same size. Rows in a list share one height and gap, cards in a row share one padding.
- Do keep space inside a group smaller than space between groups.
- Do line things up: icons in one column, labels on one line, numbers aligned right.
- Do not leave one-off values like `mt-[13px]`.

## 2. Colour

Only the page, card and border colours and the burnt orange accent are fixed hex values, in both modes. They are in [references/palette.md](references/palette.md). Do not change them.

- Do build surfaces, borders and text from the neutral ramp only. The data carries the colour.
- Do use three neutral text roles: primary, secondary, muted. These starting values meet the targets in the palette reference: dark `#ECEEF1`, `#B7BCC4`, `#8F959E`; light `#1A1D22`, `#3F4650`, `#59616C`. Hover and track tints: dark `#303235` and `#2a2c30`, light `#e3e5e7` and `#e3e6ea`. Selected tint: dark `#44322a`, light `#e7d7ce`. Faded opacity 0.4.
- Do use orange for the primary action and button fills, selection, focus, the outline of a selected or focused box, the 3px title bars and the 2px top edge of headline boxes.
- Do not use orange as a data colour: not for a bar, dot, segment, tag or any status, including in progress.
- Do use hairline borders at rest. On dark, depth comes from surface steps and hairlines, not shadows. On light, one soft neutral shadow (`0 1px 2px` at 8 percent).
- Do not use hue-to-hue gradients, glows, coloured shadows, gradient text or colour washes behind content.

### Default status map

Statuses use one house map so dashboards read the same way. It overrides the "no fixed data palette" line in the data colour reference for status meanings only. Category colours are still chosen per dashboard under that reference.

| Meaning | Name | Dark | Light |
|---|---|---|---|
| Good, done, complete, within target | green | `#72C29A` | `#3B8B65` |
| In between, partial, to do, waiting | amber | `#E3BC62` | `#A9801F` |
| Bad, overdue, failed, unassigned, missing | rose | `#E6879A` | `#C2566D` |
| Information, in progress, a plain count | blue | `#76A9EE` | `#2F6FC4` |
| Not set, cancelled, not applicable | violet | `#D08CE6` | `#A04FB8` |

- Do colour a share or rate by threshold: 80 percent or more green, 50 to 79 amber, below 50 rose. Invert the thresholds for figures where lower is better (open, overdue, unassigned).
- Do colour a done-of-total cell by state: none done rose, all done green, some done amber, nothing to count violet.
- Do colour time or age bands from green through amber to rose as they get worse, two bands per colour at most.
- Do exclude cancelled or not-applicable items from a done rate, and say so once in an info mark.

## 3. Icons

- Do replace emoji used as icons or decoration with line icons from one set, the project's own if it has one, otherwise lucide.
- Do use one size and one stroke everywhere: 16px at 1.5.
- Do give icons the colour of their text role.
- Do use a fixed icon box width and gap so labels align.
- Do use a small circled "i" (16px, hairline border, muted) after a card title for any explanation the reader does not need every time. It shows its text on hover and focus.
- Do not keep icons that add nothing.

## 4. Copy

- Do name the page in the title. Put scope and freshness in one muted line under it: `Data from 01/2025 · Last refreshed 19/11/2026 14:05`. Show where the data starts and when it was last refreshed, not where it ends, so the page never looks stale.
- Do not write greeting headlines or exclamation marks in interface text.
- Do keep labels short: `Search`, not `Search anything...`.
- Do state what a change compares to: `+12% vs last month`.
- Do keep a card note to one line, cut with an ellipsis. Move anything longer into the info mark.
- Do not put figures in notes or info text. Filters change the figures and the note goes stale; the chart, key and tooltip carry the numbers.
- Do write `n/a` where a value does not apply and `none` where it applies and is zero. Use each the same way in every card and table.
- Do write months short with a two-digit year in axes and lists (`May 25`).
- Do use one vocabulary for progress across the page, for example Done, Partial, Not started, and the same word for the same state in every card, key, filter and table.
- Do end headings, labels, buttons and captions without a full stop. Only multi-sentence paragraphs keep them.
- Do not use hype words (supercharge, seamless, unlock, magic) or `AI-powered` everywhere.
- Do remove claims that cannot be checked unless the user confirms them. List them in the report.
- Do remove badges like `PRO` or `New ✨` unless the product needs them. Then make them quiet text.
- Do keep explanation light. Do not add notes that tell the reader what they can see; one line or an info mark is enough.

## 5. Type

- Do use one family for the whole dashboard: the host's own sans family where it provides one, otherwise the system sans stack. Native controls and chart text inherit it.
- Do not default to a monospace face.
- Do use four sizes: caption 12px, body 14px, heading 16px, title 28px. Named exceptions, the only ones allowed: 13px for bar-list labels and the column key beside a doughnut, 32px for the total in a doughnut's centre with its unit at 13px, and 11px for the "i" in an info mark. Any other size is a defect. This widens the four-size rule in the cohesion reference.
- Do use one weight (400). Hierarchy comes from size and colour. Set `b, strong` to 400 in primary colour.
- Do use tabular numerals for figures, set once on the wrapper.
- Do use sentence case. Do not use uppercase, letter-spacing or italics.

## 6. Bars, tables and alignment

Apply in the first pass. Rules are in [references/bars-tables.md](references/bars-tables.md), with these changes:

- Bar thickness has three tokens, not one: 8px for progress bars inside table cells, 24px tracks for bar lists (28px when the list stretches to fill a card), and chart bars capped by Chart.js thickness (see pass 8). Every bar of each kind matches.
- Bar lists use 13px labels, rows at least 40px tall, a 45 percent name column, a 64px minimum bar and a 3ch figure. Rows are clickable and have no separators.
- A progress cell is a 56px bar plus a right-aligned figure at least 44px wide, coloured by the done-of-total rule in pass 2.
- An expanded table row shows its detail as a two-column grid (label 150px, value), with links in the value column.

## 7. Cards and layout

- Do lay cards on a 12-column grid. Two cards per row by default (6 + 6). A card left alone in a row spans 12. Below 900px every card spans 12.
- Do group cards under section headings in the order a reader works through the subject, and put the headline row in the same order.
- Do make paired cards the same height: each card wrapper is a flex column, the card takes `flex: 1`, and a card marked to fill makes its chart or list stretch (`flex: 1 1 0`, chart minimum 180px, bar-list rows `minmax(40px, 1fr)`). Charts that do not fill use 220px.
- Do not leave more than about 15 percent of any card empty. Fix by stretching the content, moving the card next to a better partner, or changing the chart form, not by adding filler.
- Do give doughnuts one fixed size across the page: 240 by 240px, beside a column key in a `240px 1fr` split. Two doughnuts on a page must render the same size. Stack the split below 560px.
- Do make the headline row six equal boxes (three columns below 1100px, two below 600px). Each has a title reserved to two lines, the figure, and one line of sub-text cut with an ellipsis. A small threshold ring (pass 2 colours) may sit top right. Each box is clickable and opens the list behind its figure.
- Do let the user hide cards with a Cards picker (tick boxes, saved in `localStorage`), and hide cards that mean nothing for the current filters automatically, with one muted line saying which: `Not shown for these filters: ...`.
- Do keep header notes, footer notes and status lines to one line each.

## 8. Charts

No chart type is banned; forms follow [references/data-colour.md](references/data-colour.md). Use horizontal bars when category labels are long (teams, names, sites) and columns for time. These Chart.js settings carry the house look; set them once.

```js
Chart.defaults.color = cssVar('--mute');
Chart.defaults.borderColor = cssVar('--line');
Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
Chart.defaults.font.size = 12;
Chart.defaults.scale.grid.drawTicks = false;   // no tick stubs between axis and labels
Chart.defaults.scale.ticks.padding = 8;
Object.assign(Chart.defaults.plugins.tooltip, {
  backgroundColor: cssVar('--bg'), titleColor: cssVar('--ink'), bodyColor: cssVar('--ink2'),
  borderColor: cssVar('--line'), borderWidth: 1, padding: 8, cornerRadius: 6, boxPadding: 4 });
const base = { responsive: true, maintainAspectRatio: false,
  animation: reducedMotion ? false : { duration: 200 }, plugins: { legend: { display: false } } };

// An object radius rounds every segment of a stack; a number rounds only its ends.
const RAD = { topLeft: 4, topRight: 4, bottomLeft: 4, bottomRight: 4 };
const bar = (label, data, color, extra) => ({ label, data, backgroundColor: color,
  borderRadius: RAD, borderSkipped: false, borderWidth: 1, borderColor: cssVar('--card'),
  maxBarThickness: 24, ...extra });

// Doughnut: rounded segments split by a card-coloured gap, total in the centre.
{ data: values, backgroundColor: colours, borderWidth: 2, borderColor: cssVar('--card'), borderRadius: 6 }
options: { ...base, cutout: '62%' }   // centre: total at 32px primary, unit at 13px muted
```

- Do round every bar segment, stacked or not, with the object radius, and separate stacked segments with a 1px card-coloured border.
- Do hide the grid on the category axis and keep it on the value axis. Use whole-number ticks for counts.
- Do give a line chart `offset: true` on the x axis so the first and last labels clear the axes, and draw value labels beside points (the higher series above, the other below) when there are few points.
- Do keep the built-in legend off. Every chart has an HTML key above it, or a clickable column key beside a doughnut showing count and percentage.
- Do show a total in the tooltip footer of every stacked chart.
- Do use one series colour per meaning across all charts (pass 2 map).

## 9. Interaction

- Do make every bar, segment, key item, bar-list row and headline box clickable. A click opens a side drawer on the right (about 480px, Esc and a Close button shut it) listing the items behind that mark. Do not open lists inside a card: it resizes the card and its neighbours.
- Do show the same summary on hover everywhere: the label and figure, then up to eight items, then `+ N more. Click for the full list with links.` or `Click for links.`. Chart tooltips, bar-list rows, key items and doughnut segments all use it. Use one tooltip element, kept inside the viewport.
- Do give each item in a drawer, list or detail one link per target. Do not repeat the same link twice in one row.
- Do make filters tick-box dropdowns (search box, All, per-item Only, counts), one per dimension, and keep the filter bar to one line on a desktop width. Show active filters as removable chips below it.
- Do show a refresh or loading progress bar only while it runs, and hide it a few seconds after success. Keep failures visible with what failed.
- Do give every interactive element the hover tint, the 2px accent focus ring and the 150ms transition from the cohesion reference.

## Reporting back

- Do say that you have not seen the live render, unless you have, and ask for screenshots in dark, light and at phone width.
- Do list what changed per pass, any claim removed, any chart whose form changed, and the result of the contrast check.
- Do run these checks on the render and report the result:
  - Paired cards are the same height, and no card is more than about 15 percent empty. In the console: for each visible `.card`, compare the summed height of its children with its inner height.
  - Clicking any mark opens the drawer and no card changes size.
  - Every bar corner is rounded, no axis shows tick stubs, and both doughnuts (if any) are the same size.
  - The distinct `font-size` values in the code are the four sizes plus the named exceptions.
  - Every note fits one line at 1280px.
- Do name any colour that could not be changed and the reason, such as a colour shared by two meanings.
- Do list the knock-on effects of each change, such as other panels that share a style, each with its fix.
- Do state what the change costs, such as taller rows or a narrower bar.

## Hero visuals and motion

- Do keep them simple, and only where the dashboard already has them or the user asks. Do not add them by default.
- Do make a hero visual one calm image or illustration from the product's world, on a quiet area of the page. Do not put it behind data, and do not use gradients or glows.
- Do keep motion to short fades and state changes (150 to 200ms), and none when the user prefers reduced motion. Do not use looping, pulsing or attention-seeking animation.
- Do not redesign the layout beyond the page structure reference and pass 7, and do not make story videos. If the user wants those, say so and suggest the original unslop.

