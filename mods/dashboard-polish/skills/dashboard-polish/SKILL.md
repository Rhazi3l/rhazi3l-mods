---
name: dashboard-polish
description: Restyles an existing dashboard, or builds a new one, so it stops looking AI-generated. Audits the tells, then fixes spacing, colour, charts, tables, icons, copy and type in order, on a charcoal and burnt-orange base with pastel data colours, with dark and light modes (dark by default). Use when the user asks to polish, restyle, clean up or build a dashboard, KPI page, metrics page or data view, or says it looks generic, vibecoded or AI-made.
license: CC-BY-4.0
---

# Dashboard polish

Adapted from unslop by Damir Sokolovsky (https://github.com/heydamir/unslop), licensed CC BY 4.0. This version is changed to cover dashboards only: five of its passes (spacing, colour, icons, copy, type), plus rules for data colour, charts, tables and page structure, on a fixed charcoal and orange base. Keep this credit in any copy.

The rules below are guidelines for any dashboard. Follow the Do and Do not lines. Detail sits in the reference files, which you read when the pass needs them.

Keep the product. Features, numbers and section order stay. Every size, colour, word and icon becomes deliberate. Keep the chrome quiet and put the colour into the data. A chart's form may change when a better one fits the data (see [references/data-colour.md](references/data-colour.md)). List every such change in the report.

## Restyling an existing dashboard

1. Look at it. If you can render it, do so, so you judge what people see and not only the code.
2. Audit. List every tell with where it lives, one line each. Typical tells: hue gradients, glows, gradient text, emoji labels, "New" badges, tracked uppercase labels, greeting headlines, exclamation marks, uneven spacing, many font weights, many greys, grey bars, the same chart form repeated.
3. Write five lines.
   - Product: what it does and for whom.
   - Character: two or three concrete words. Not clean, modern, sleek, minimal or premium.
   - World: the material the product belongs to. It tints the data colours, not the surfaces.
   - Moments: one or two places that may carry rich colour, such as the main chart.
   - Signature: one small detail used consistently, such as a live status dot.
4. Show the audit and the five lines, then wait for the user's answer before editing. Skip the wait only if they said to just do it.
5. Apply passes 1 to 6 in order, finishing each across the whole dashboard before the next.
6. Check against the audit list, render again, and fix what is left. Then run the sweep in [references/cohesion.md](references/cohesion.md) and fix every panel that differs.
7. Report (see Reporting back).

## Building a new dashboard

Skip the audit. Write the five lines, then build to the passes below and [references/page-structure.md](references/page-structure.md). Use plausible data. Do not use `[X]` or `123,456`.

## Always

- Do build two modes, dark and light, with dark as the default whatever the system setting says. Define every colour once as a CSS variable per mode.
- Do not hard-code a colour in a component.
- Do add a theme button in the filter or toolbar row, after the last control. Make it a square icon button the height of a row: moon when the page is light, sun when it is dark. Give it `aria-pressed` and an `aria-label` that names the action (`Switch to light theme`).
- Do toggle `data-theme` on the root element between `light` and `dark`, and set `dark` once at load if none is set.
- Do say in the report that the choice is not stored and resets on reload, and that a host viewer's own theme control may override it, which is untested.
- If the host provides theme switching, keep dark as the starting mode and use its mechanism.
- Do check contrast in both modes with a script, not by eye. Text needs 4.5 to 1. Bars, dots and other marks need 3 to 1.
- Unless the data says otherwise, use British English, metric, 24-hour time and GBP.
- If the dashboard is built on a host with a page check or data store, read [references/artifact-hosts.md](references/artifact-hosts.md) first.

## 1. Spacing

- Do use a 4px grid. Margins, paddings, gaps and fixed heights are multiples of 4. A 2px nudge inside small controls is fine.
- Do give the same thing the same size. Rows in a list share one height and gap, cards in a row share one padding.
- Do keep space inside a group smaller than space between groups.
- Do line things up: icons in one column, labels on one line, numbers aligned right.
- Do set padding by density: compact panels and sidebars about 16, cards 20 to 24, page edges 24 to 32.
- Do not leave one-off values like `mt-[13px]`.

## 2. Colour

Fixed base: a charcoal with a faint cool tint and the burnt orange accent `#d4743c`, in both modes. All values are in [references/palette.md](references/palette.md). Do not change them.

- Do build surfaces, borders and text from the neutral ramp only. The data carries the colour.
- Do use three text roles: primary, secondary, muted.
- Do use orange for the primary action and button fills, selection, focus, the outline of a selected or focused box, and the fixed decorative uses in the page structure reference.
- Do not use orange as a data colour: not for a bar, dot, segment, tag or any status, including in progress.
- Do use hairline borders at rest. On dark, depth comes from surface steps and hairlines, not shadows. On light, shadows are neutral, soft and small.
- Do not use hue-to-hue gradients, glows, coloured shadows, gradient text or colour washes behind content. A gradient is allowed only as a small tone shift inside one neutral.
- Data colours have no fixed palette. Choose them per dashboard under the rules in [references/data-colour.md](references/data-colour.md).

## 3. Icons

- Do replace emoji used as icons or decoration with line icons from one set, the project's own if it has one, otherwise lucide.
- Do use one size and one stroke everywhere, 16 or 18px at 1.5.
- Do give icons the colour of their text role.
- Do use a fixed icon box width and gap so labels align.
- Do not keep icons that add nothing.

## 4. Copy

- Do name the page in the title. Add a period or date only when the page is scoped to it, and never when the same date appears in a subtitle or status line.
- Do not write greeting headlines or exclamation marks in interface text.
- Do keep labels short: `Search`, not `Search anything...`.
- Do state what a change compares to: `+12% vs last month`.
- Do keep a note under a card to one line, two at most. It says what the reader needs to read the chart. Put details in a tooltip or the report.
- Do end headings, labels, buttons and captions without a full stop. Only multi-sentence paragraphs keep them.
- Do not use hype words (supercharge, seamless, unlock, magic) or `AI-powered` everywhere.
- Do remove claims that cannot be checked, like `Loved by 10,000+ teams`, unless the user confirms them. List them in the report.
- Do remove badges like `PRO` or `New ✨` unless the product needs them. Then make them quiet text.

## 5. Type

- Do use one family for the whole dashboard: the host's own sans family where it provides one, otherwise the project's. Native controls (selects, buttons, inputs) inherit it.
- Do not default to a monospace face. Use a mono for figures only if the user asks.
- Do use four sizes: caption, body, heading, title. A fifth size is a defect. The sizes are defined in [references/cohesion.md](references/cohesion.md).
- Do use one weight (400). Hierarchy comes from size and colour.
- Do use tabular numerals for figures, set once on the wrapper.
- Do use sentence case. Do not use uppercase, letter-spacing or italics.

## 6. Bars, tables and alignment

Apply in the first pass, so they do not have to be asked for. Rules and values are in [references/bars-tables.md](references/bars-tables.md).

## Reporting back

- Do say that you have not seen the live render, unless you have, and ask for screenshots in dark, light and at phone width.
- Do list what changed per pass, any claim removed, any chart whose form changed, and the result of the contrast check.
- Do name any colour that could not be changed and the reason, such as a colour shared by two meanings.
- Do list the knock-on effects of each change, such as other panels that share a style, each with its fix.
- Do state what the change costs, such as taller rows or a narrower bar.

## Not covered

Do not generate hero visuals, motion or story videos, and do not redesign the layout beyond the page structure reference. If the user wants those, say so and suggest the original unslop.
