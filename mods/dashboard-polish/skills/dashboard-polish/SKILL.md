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

- Dark neutral charcoal ramp with only a faint cool tint, between plain charcoal and a blue-tinted theme (the user compared both and chose the middle), with a burnt orange accent `#d4743c`. The neutral values for both modes are below and in [references/palette.md](references/palette.md). Any other colour value in palette.md is superseded by the colour guidelines further down.

| Role (dark) | Value |
|---|---|
| Page | `#151618` |
| Card | `#202225` |
| Border | `#303338` |
| Text primary | `#d2d2d2` |
| Text secondary | `#b6b6b6`, the midpoint between primary and muted |
| Text muted | `#9b9b9b` (5.7 to 1 on the card, by script) |
| Selected row | `#443229`, the accent at 20% over the card |
| Hover and track | `#2e3033`, the text colour at 8% over the card |

  Light neutrals: page `#e8eaee`, card `#f5f6f8`, border `#d3d8e0`, text primary `#16181d`, secondary `#4a5262`, muted `#5d6677`. The light card is a soft off-white and never pure white, because the user found pure white too bright. Check the data colours against this card and not against white, since they lose about 0.5 of contrast. Bars and dots need 4.5 to 1 against the card.

  Hover and track tints are the text colour at about 8 percent, so they stay neutral.
- Surfaces, borders and text come only from this ramp and stay neutral. The data carries the colour.
- Three text roles: primary, secondary, muted.
- The orange accent is used rarely: the primary action and button fills, the selection, focus, the one number that matters, and the outline of a selected or focused box or panel. It is never a data colour: not for a bar, dot, segment, tag or any status, including in progress. Its fixed decorative uses are a short vertical bar (3px wide, one heading tall) before every section title, with the title sitting above its box and not inside it, and a 2px orange top edge on the headline figure boxes only (each key figure is its own box). A 1px edge is barely visible on a white page. No other card, panel or table gets an orange edge, because the title bar is accent enough and more feels overused. Everything else at rest, including box sides and bottoms, stays a neutral hairline. The user's reference was another of their dashboards, which used an orange top edge on cards and an orange bar beside section titles that sit outside the panel, and asked for the same here. Text on an orange fill is dark in dark mode. In light mode use a darker orange (`#af5926`) with white text, which reaches 4.9 to 1.
- Borders are hairlines, the text colour at 6 to 10 percent opacity.
- Depth on dark comes from surface steps and hairlines, not shadows. On light, shadows are neutral, soft and small.

Colour guidelines. There is no fixed data palette. Choose the data colours for the product, within these rules. The only fixed colours are the neutral ramp and the orange accent.

- Pastel in both modes: soft, moderately saturated hues, with at least 3 to 1 against the card on dark. No vivid or neon colours. In light mode lower the saturation as well as the lightness (about 25 percent less saturation), and darken only as far as the contrast target needs, so the colours stay soft and do not turn vivid.
- Meaning first. Green means good or done and red means bad, always, and neither is used for anything else. Orange is the accent and is never a data colour. Every other hue is free to use for categories, yellow included, as long as it is not used for a second meaning.
- Unique. Each category gets one colour that no other category or meaning on the dashboard uses, including the accent, green and red. Pick hues that are far apart on the wheel and not yet used. Reusing a colour for a second meaning is a defect unless the report names it.
- Use only the colours the data needs. Do not add a colour to fill a palette. Space the hues evenly around the wheel, about 45 to 50 degrees apart. Six hues (for example about 48, 104, 175, 222, 275 and 330 degrees) is the practical limit with orange held back, so group the rest and do not reuse a colour. Red appears only when the data has a bad state.
- Maximum two tones of any hue across the whole dashboard, for example a strong fill and a soft tint. A third shade of the same hue is a defect, so take a different hue instead (yellow, magenta, teal). Hues within about 40 degrees of each other count as the same hue for this rule, so teal beside green, or pink beside magenta, is too close.
- Before applying, render one swatch strip of every colour in each mode and look at it. Adjacent colours that are hard to tell apart are fixed before they go on the dashboard.
- On a host that checks the look, a chart colour that is too close to an earlier one is silently replaced by the dashboard's own default, which can be a vivid colour that matches nothing else. Measure the distance between every pair of colours in each mode (CIE Lab distance, at least about 30, since pairs near 20 were replaced and pairs near 24 were kept) and fix any close pair before publishing. After publishing, check that every slot shows the colour you chose. If one is wrong, it was replaced.
- Series order: the most important category first, red last when it appears.
- Vary the chart types. Do not draw every panel as horizontal bars, because the user asked for variety. Pick the form from the data: a segmented bar for shares of one whole, vertical columns for a time series (oldest first, left to right), horizontal bars for ranked categories, a table for detail. Use a form at most twice on one dashboard, and prefer a different form wherever the data allows: for a set of categories that each have their own rate or share, a dot plot works well (one row per category, one marker on a 0 to 100% scale, sorted high to low, with the figure on the right). The user rejected a grid of small rings or pies for this, so do not use rings or pies. A single segmented bar is right only when the parts do not overlap and add up to one whole. Categories that overlap, such as genre tags where a game can have several, are not parts of a whole, so do not use a pie or a segmented bar for them. Every panel keeps the same bar thickness, radius, marker and key rules. A clickable column or bar uses the same hover, selected and faded states as a row.

- Each colour means one thing and is used the same way everywhere.
- Every chart that uses colour gets a key. A one-line row of colour squares with short labels sits between the card heading and the chart, and a note says what the bar length and each figure mean. Do not rely on a colour, a marker square or an earlier panel to explain itself. A marker beside a figure says which colour that figure belongs to in the key. Where a colour means the same thing as in another card (for example platinum), say so with the same word.
- Colour squares in legends and keys are 12px, with a 3px radius, one size on the whole page. Eight pixels is too small to tell similar pastels apart.
- No grey bars in either mode. A bar that is grey, or close to the card colour, is hard to see, and the user rejected it twice (progress bars, the by-year bars). Every status, including unstarted or off, gets a colour. The track behind a bar is a faint neutral tint, the only grey allowed.
- A bar that shows a status takes that status's colour, the same as its dot and legend. A bar with no status of its own (for example trophies per year) takes one series colour. Prefer one not already used for a status, and if every colour is taken, say which meaning it shares.
- Good, bad and warning keep their usual meaning, toned down. Red is last in any series order, because it reads as bad.
- Four series or fewer where possible, and check that neighbours are easy to tell apart.
- Soft fill (the colour at 15 to 25 percent opacity) with a full-strength stroke or text of the same hue. Dark text on any solid fill.
- In light mode keep the same hue and darken it until each bar or dot reaches 4.5 to 1 against its card, which also covers any text on it. Green stays green and red stays red. Check this with a script and not by eye: compute the contrast of every colour against its card in both modes and list any below 4.5 in the report.
- No hue-to-hue gradients, glows, coloured shadows, gradient text or colour washes behind content. A gradient is allowed only as a small tone shift inside one neutral.

## 3. Icons

- Replace emoji used as icons or decoration with line icons from one set, the project's own if it has one, otherwise lucide.
- One size and one stroke everywhere, 16 or 18px at 1.5.
- Icons take the colour of their text role, never their own.
- Fixed icon box width and gap so labels align.
- Drop icons that add nothing.

## 4. Copy

- The title names the page. Add a period or date to it only when the page is scoped to that period, and never when the same date appears in the subtitle or a status line, because the user asked why a month was shown twice. No greeting headlines.
- No exclamation marks in interface text.
- Short labels. `Search`, not `Search anything...`.
- A note under a card is one line, two at most. It says what the reader needs to read the chart and nothing else. Details such as how the data was tagged go in a tooltip or the report. The user rejected three-line notes twice.
- A change says what it compares to: `+12% vs last month`.
- Headings, labels, buttons and captions end without a full stop. Only multi-sentence paragraphs keep them.
- No hype words (supercharge, seamless, unlock, magic) and no `AI-powered` everywhere.
- Claims that cannot be checked, like `Loved by 10,000+ teams`, are removed unless the user confirms them. List them in the report.
- Remove badges like `PRO` or `New ✨` unless the product needs them, then quiet text.

## 5. Type

- One family for the whole dashboard: the host's own sans family where the host provides one (on the Dashboard artifact type, `--font-anthropic-sans`), because it is the same on every device. Do not default to a monospace face. The user tried a system monospace stack and the host mono token and rejected both (the system stack differs on Windows, Mac and Linux, and the host token did not take effect on the page). Use a mono only for figures if the user asks. Native controls such as selects, buttons and inputs must inherit the family.
- A few sizes from a scale, weights 400 and 500 only, 600 at most for rare emphasis.
- Hierarchy comes from size and colour, not weight.
- Sentence case. No tracked uppercase labels.
- Figures that stack use tabular numerals.

## 6. Bars, tables and alignment

These came from the user's review of a polished dashboard. Apply them in the first pass, so they do not have to be asked for.

- Progress bars in table rows: the number sits in a fixed-width, right-aligned box (`min-width: 3ch`) and the bar sits left of it in a flex row that is right-aligned. Bars then start at the same x in every row. The vertical centring was already right, and the visible misalignment came from numbers of different widths. Fill the bar with the row's status colour.
- Name columns in bar lists (a name, a bar, a figure) are capped at about 45% of the card, and the bar keeps a minimum of about 64px. Long names are cut with an ellipsis and the full name goes in the hover text. An uncapped name column squeezed the bars to a few pixels.
- Value columns in bar lists (a bar, then a figure such as `25 · 1238`): give the column a width that fits the longest value and forbid wrapping. Anchor any marker, such as a platinum square, to the left edge of the column, so it does not move with the length of the text.
- Rows that repeat across a list, such as pick or watch rows, share one set of columns (CSS subgrid on the list, `grid-column: 1 / -1` on each row). Per-row grids with an `auto` column put the second column at a different x in every row.
- A detail that belongs to every row, such as a platinum guide, gets its own column and not a line under the name. Where a row has no value, render an empty cell so the later columns stay aligned. Below about 560px, stack to one column.
- Table columns share space by content. Columns that hold figures, dates and statuses hug their content. Only one or two long text columns (genres, a description) get a width, set in rem and stepped by the width of the table box with container queries (about 14rem narrow, 18rem medium, 20rem wide), so a text column never takes the slack. The title column takes whatever is left, because the user rejected tables where the genre column had the extra space. Tags and chips never wrap their own text.
- Alignment follows one rule: text columns are left-aligned, and figures and dates are right-aligned, header and cells together. A column that holds a bar then a number (progress) is left-aligned, so its title sits over the start of the bar.
- A column header says what is counted and in what unit, for example `Played (h)` and not `Hours`, which the user could not tell from hours left. Put the unit in brackets when the cells hold only a number, and add a hover that spells it out.
- Tables do not scroll sideways by default. Let the first column and long text columns wrap, with minimum widths of about 160px and 144px, and keep numbers and dates on one line. Apply this to every table on the page, not only the biggest. A long title may then make a row taller. Say so. If it still scrolls on a narrow window, hide the least important column below a breakpoint.
- Bar ends are rounded with the one bar radius token (4px on 8px bars, so they are pills). Square or barely rounded bars looked harsh beside the rounded cards.

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
- Where a colour could not be changed, name it and the reason (for example a colour shared by two meanings).
- List the knock-on effects of each change, such as other panels that share a style, or data text that still uses the wrong voice, each with its fix.
- State what the change costs, such as taller rows or a narrower bar.

## Cohesion sweep

A dashboard is judged panel against panel. The user found mismatches by eye (a thinner progress bar, grey bars in one panel, square corners beside round ones, a column that did not line up). Prevent that with tokens and a check.

Define each of these once, as a variable, and use it everywhere. Never write the number inside a component.

| Token | Used by | Rule |
|---|---|---|
| Row height | table rows, bar rows, legend rows, list rows, buttons, inputs, selects | one value, a multiple of 4 (28px). 32px looked too far apart to the user. Only wrapping text rows grow |
| Bar thickness | progress bars, bar-list tracks | one value (8px). A headline segmented bar may be larger, and is named in the report |
| Bar radius | every bar, fill and track | one value (4px), so 8px bars are pills |
| Track tint | every bar track | the same faint neutral (text at about 8 percent) |
| Marker size and radius | status dots, series squares, legend squares, key squares, the marker beside a figure | one size (12px), one small radius (3px). Eight pixels made similar pastels hard to tell apart |
| Chip height | filter chips, platform tags, any tag | one value (24px) |
| Card padding, heading and note spacing | every card | same padding, same heading size and margin, same note style |
| Link style | every link | one colour (secondary), one underline, one hover (primary) |
| Hover and selected | every clickable row, legend item, list item | the same hover tint, the same selected tint, the same corner radius |
| Separators | tables and text lists | hairline between rows. Bar rows have none |

Sweep, in this order, after the passes:

1. Write a grid with one line per panel and one column per token above. Fill it from the code, not from memory.
2. Any cell that differs from the rest of its column is a defect unless the report names the reason.
3. Check the data colours panel by panel. Each meaning has one colour everywhere. No panel has a grey bar. A bar with no status of its own takes the same series colour in every panel where that happens (for example trophies per year and games per genre).
4. Check alignment in each repeated structure: values in one column start at the same x, markers sit on the same edge, repeated rows share columns.
5. Check every table for sideways scroll, and every panel for text that wraps unevenly.
6. Report the grid's exceptions and the fixes. List only what changed or what you kept on purpose.

## Type, colour and state cohesion

The same sweep covers type, colour and interaction states. Count them from the code, for example by listing every distinct `font-size`, `font-weight`, `color`, `opacity` and literal colour with `grep`. The count should match the scale below.

Type
- One family, set once on the page wrapper. No panel sets its own.
- Four sizes from the host or a scale: caption (tables, lists, notes, controls, legends, keys, chips, and the sub-text under a figure), body (running text and the lead line), heading (every title: section titles and the titles of headline figure boxes), title (page title and headline figures). A fifth size is a defect. If a title uses a size, all titles use it: a small box title beside large section titles was rejected. Titles are also one colour (primary) and one weight.
- One weight (400). Hierarchy comes from size and colour.
- Figures are tabular everywhere, set once on the wrapper.
- No uppercase, no letter-spacing, no italics.

Text colour
- Three roles only, used by meaning and the same in every panel: primary for names, figures and values, secondary for supporting text and links, muted for small labels, notes and sub-text. Titles of every kind, headline box titles included, are primary. A value that is secondary in one panel and primary in another is a defect. Figures are primary everywhere, including bar-list values.
- No literal colour inside a component. Every colour is a token or comes from the look.

Data colour map
- Write the map once: each status or series, its colour, and where it appears (bar, dot, legend, chip, tag). Check that every panel follows it.
- If a colour has to be reused for a series with no status (for example trophies per year and games per genre), use the same one in every such panel and state in the report which meaning it shares.
- The accent marks selection, focus, outlines, button fills, the title bar and the headline top edge only. No data series, status or legend uses it.

States
- One faded opacity token for disabled and filtered-out items. Not two close values.
- One hover tint, one selected tint, one focus ring (2px accent, 1px offset) on everything interactive, including selects, segmented buttons, Reset and the theme button. A 1px ring was too faint on a white page. A selected row or legend item inside a list uses a 1px inset accent outline with the selected tint, because a 2px outline looks heavy on tight rows. Check that the host's own focus style on selects and inputs is not adding a second ring.
- One transition (opacity, background and colour, same duration and easing) on every button and link, and none when the user prefers reduced motion.
- Loading or refreshing state may use its own value, which is named in the report.

Copy
- Separators in meta lines are the same character everywhere (a middle dot with spaces). Dates and units use one format throughout. Sentence case in every heading, label and button.

## Page structure

The user chose these after seeing the dashboard, so build them this way from the start.

- Each section is a wrapper holding the title and then the box. The title sits above its box, never inside it, with a 3px orange bar before it. Hide and show sections on the wrapper, so a hidden section loses its title too, and point scroll targets at the wrapper.
- Headline figures are separate boxes of equal height, each with a title (heading size), the figure (title size) and sub-text (caption size), a 2px orange top edge, and hairline sides and bottom. Titles in these boxes are the same size and colour as section titles.
- Boxes in one row share the same height. Where a marker follows a figure, draw it as a pseudo-element after the figure, so the figure does not shift.
- Two rows with the same name, such as one game on two platforms, get a distinguishing suffix so they can be told apart.
- Orange appears on the title bars, the headline top edges, buttons, selection and focus, and nowhere else. If it starts to feel overused, remove it from boxes before removing it from titles.
- The dark page is a neutral charcoal with a faint cool tint. The user rejected both the plain `#121212` ramp (too dark) and a blue-tinted OS theme (`#16181d` page, `#22262d` card, too blue), and chose a middle that is a touch darker than a straight average.
- `references/palette.md` still lists an older colour set that this skill supersedes. Ignore its colour lists and use the guidelines above.

## Not covered

Layout restructuring, generated hero visuals, motion and story videos from the original unslop are not part of this skill. If the user wants them, say so and suggest the original.