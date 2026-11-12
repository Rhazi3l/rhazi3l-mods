# Cohesion sweep

A dashboard is judged panel against panel. Mismatches show up by eye: a thinner progress bar, grey bars in one panel, square corners beside round ones, a column that does not line up. Prevent them with tokens and a check.

Define each of these once, as a variable, and use it everywhere. Do not write the number inside a component.

| Token | Used by | Rule |
|---|---|---|
| Row height | table rows, bar rows, legend rows, list rows, buttons, inputs, selects | one value, a multiple of 4 (28px). Only wrapping text rows and rows of thick bars (thickness plus 8px) grow |
| Bar thickness | standalone bar and column charts | tiered by the number of bars (see bars-tables.md), one value per chart, the same value for charts in the same tier. Bars in table and list rows use one value (8px). A headline segmented bar may be larger, and is named in the report |
| Bar radius | every bar, fill and track | half the bar thickness, so bars are pills |
| Track tint | every bar track | the same faint neutral (text at about 8 percent) |
| Marker size and radius | status dots, series squares, legend and key squares, the marker beside a figure | one size (12px), one radius (3px) |
| Chip height | filter chips, platform tags, any tag | one value (24px) |
| Card padding, heading and note spacing | every card | same padding, heading size and margin, note style |
| Link style | every link | one colour (secondary), one underline, one hover (primary) |
| Hover and selected | every clickable row, legend item, list item | the same hover tint, selected tint and corner radius |
| Separators | tables and text lists | hairline between rows. Bar rows have none |

## Layout sweep

Run it after the passes, in this order.

1. Write a grid with one line per panel and one column per token. Fill it from the code, not from memory.
2. Any cell that differs from the rest of its column is a defect unless the report names the reason.
3. Check the data colours panel by panel. Each meaning has one colour everywhere, and no panel has a grey bar.
4. Check alignment in each repeated structure: values in one column start at the same x, markers sit on the same edge, repeated rows share columns.
5. Check every table for sideways scroll, and every panel for text that wraps unevenly.
6. Report the grid's exceptions and the fixes. List only what changed or what you kept on purpose.

## Type, colour and state sweep

Count from the code, for example by listing every distinct `font-size`, `font-weight`, `color`, `opacity` and literal colour with `grep`. The count should match the scale below.

Type
- Do set one family once on the page wrapper. No panel sets its own.
- Do use four sizes: caption (tables, lists, notes, controls, legends, keys, chips, and the sub-text under a figure), body (running text and the lead line), heading (every title: section titles and titles of headline boxes), title (page title and headline figures). A fifth size is a defect.
- Do make all titles one size, one colour (primary) and one weight. A small box title beside large section titles is a defect.
- Do use one weight (400), tabular figures, and no uppercase, letter-spacing or italics.

Text colour
- Do use three roles, by meaning and the same in every panel: primary for names, figures, values and titles, secondary for supporting text and links, muted for small labels, notes and sub-text.
- Do not use a role differently between panels. A value that is secondary in one and primary in another is a defect.
- Do not put a literal colour inside a component.

Data colour map
- Do write the map once: each status or series, its colour, and where it appears (bar, dot, legend, chip, tag). Check that every panel follows it.
- Do not use the accent for any data series, status or legend.

States
- Do use one faded opacity token for disabled and filtered-out items.
- Do use one hover tint, one selected tint and one focus ring (2px accent, 1px offset) on everything interactive, including selects, segmented buttons and the theme button. A 1px ring is too faint on a light page.
- Do use a 1px inset accent outline with the selected tint for a selected row or legend item inside a list. A 2px outline looks heavy on tight rows.
- Do check that the host's own focus style on selects and inputs does not add a second ring.
- Do use one transition (opacity, background and colour, same duration and easing) on every button and link, and none when the user prefers reduced motion.
- A loading or refreshing state may use its own value, which the report names.

Copy
- Do use the same separator in meta lines everywhere (a middle dot with spaces), one format for dates and units, and sentence case in every heading, label and button.
