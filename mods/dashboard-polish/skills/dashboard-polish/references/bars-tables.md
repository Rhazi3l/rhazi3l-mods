# Bars, tables and alignment

Rules for pass 6. They apply to every bar and table on the page, not only the biggest.

## Bars

- Do put the number of a progress bar in a table row in a fixed-width, right-aligned box (`min-width: 3ch`), with the bar left of it in a right-aligned flex row. Bars then start at the same x in every row. Fill the bar with the row's status colour.
- Do cap the name column in a bar list (name, bar, figure) at about 45% of the card and keep the bar at least about 64px. Cut long names with an ellipsis and put the full name in the hover text. An uncapped name column squeezes the bars.
- Do give the value column a width that fits the longest value, and forbid wrapping. Anchor any marker to the left edge of the column, so it does not move with the length of the text.
- Do round every bar with the one bar radius token (4px), on all four corners and on every segment of a stack.
- Do use three bar thicknesses, and make every bar of each kind match: 8px for progress bars inside table cells, 24px tracks for bar lists (28px when the list stretches to fill a card), and chart bars capped by the chart library's maximum thickness (24px).
- Do give bar lists 14px labels, rows at least 40px tall, a 45 percent name column, a 64px minimum bar and a figure box of 3ch. Rows are clickable and have no separators.
- Do make a progress cell a 56px bar plus a right-aligned figure at least 44px wide, coloured by the done-of-total rule in pass 2.
- Do show an expanded table row's detail as a two-column grid (label 150px, then the value), with links in the value column.

## Repeated rows

- Do make rows that repeat across a list share one set of columns (CSS subgrid on the list, `grid-column: 1 / -1` on each row). Per-row grids with an `auto` column put the second column at a different x in every row.
- Do give a detail that belongs to every row, such as a link or badge, its own column and not a line under the name. Where a row has no value, render an empty cell so later columns stay aligned.
- Do stack to one column below about 560px.

## Tables

- Do size columns by content. Columns of figures, dates and statuses hug their content.
- Do give only one or two long text columns a width, set in rem and stepped by the table box width with container queries (about 14rem narrow, 18rem medium, 20rem wide). The title column takes what is left, so a text column never takes the slack.
- Do not let tags and chips wrap their own text.
- Do left-align text columns and right-align figures and dates, header and cells together. A column that holds a bar then a number is left-aligned, so its title sits over the start of the bar.
- Do say what is counted and in what unit in a column header, for example `Played (h)`, not `Hours`. Put the unit in brackets when cells hold only a number, and add a hover that spells it out.
- Do not scroll tables sideways by default. Let the first column and long text columns wrap, with minimum widths of about 160px and 144px, and keep numbers and dates on one line. A long title may make a row taller, so say so. If it still scrolls on a narrow window, hide the least important column below a breakpoint.
- Do apply this to every table on the page.
