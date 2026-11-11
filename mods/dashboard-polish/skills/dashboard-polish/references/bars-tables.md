# Bars, tables and alignment

Rules for pass 6. They apply to every bar and table on the page, not only the biggest.

- Progress bars in table rows: the number sits in a fixed-width, right-aligned box (`min-width: 3ch`) and the bar sits left of it in a flex row that is right-aligned. Bars then start at the same x in every row. Misalignment usually comes from numbers of different widths, not from vertical centring. Fill the bar with the row's status colour.
- Value columns in bar lists (a bar, then a figure such as `25 · 1238`): give the column a width that fits the longest value and forbid wrapping. Anchor any marker, such as a badge square, to the left edge of the column, so it does not move with the length of the text.
- Rows that repeat across a list, such as recommendation or watchlist rows, share one set of columns (CSS subgrid on the list, `grid-column: 1 / -1` on each row). Per-row grids with an `auto` column put the second column at a different x in every row.
- A detail that belongs to every row, such as a link or badge, gets its own column and not a line under the name. Where a row has no value, render an empty cell so the later columns stay aligned. Below about 560px, stack to one column.
- Tables do not scroll sideways by default. Let the first column and long text columns wrap, with minimum widths of about 160px and 144px, and keep numbers and dates on one line. A long title may then make a row taller. Say so. If it still scrolls on a narrow window, hide the least important column below a breakpoint.
- Round bar ends slightly (2px) on small bars.
