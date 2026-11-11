# Cohesion sweep

A dashboard is judged panel against panel. Mismatches show up by eye: a thinner progress bar, grey bars in one panel, square corners beside round ones, a column that does not line up. Prevent them with tokens and a check.

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

## Layout sweep

Run it after the passes, in this order.

1. Write a grid with one line per panel and one column per token above. Fill it from the code, not from memory.
2. Any cell that differs from the rest of its column is a defect unless the report names the reason.
3. Check the data colours panel by panel. Each meaning has one colour everywhere. No panel has a grey bar unless it shows the grey status. A bar with no status of its own takes the same series colour in every panel where that happens.
4. Check alignment in each repeated structure: values in one column start at the same x, markers sit on the same edge, repeated rows share columns.
5. Check every table for sideways scroll, and every panel for text that wraps unevenly.
6. Report the grid's exceptions and the fixes. List only what changed or what you kept on purpose.

## Type, colour and state sweep

Count from the code, for example by listing every distinct `font-size`, `font-weight`, `color`, `opacity` and literal colour with `grep`. The count should match the scale in pass 5.

Text colour
- Three roles only, used by meaning and the same in every panel: primary for names, figures and values, secondary for supporting text and links, muted for labels, notes and captions. A value that is secondary in one panel and primary in another is a defect. Figures are primary everywhere, including bar-list values.
- No literal colour inside a component. Every colour is a token or comes from the look.

Data colour map
- Write the map once: each status or series, its colour, and where it appears (bar, dot, legend, chip, tag). Check that every panel follows it.
- If a colour has to be reused for a series with no status (for example a count per year and a count per category), use the same one in every such panel and state in the report which meaning it shares.
- The accent marks selection, focus and the in-progress status only.

States
- One faded opacity token for disabled and filtered-out items. Not two close values.
- One hover tint, one selected tint, one focus ring (2px accent, 2px offset) on everything interactive.
- One transition (opacity, background and colour, same duration and easing) on every button and link, and none when the user prefers reduced motion.
- A loading or refreshing state may use its own value, which is named in the report.
