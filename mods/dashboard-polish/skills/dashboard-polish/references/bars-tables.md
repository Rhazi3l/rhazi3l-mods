# Bars, tables and alignment

Rules for pass 6. They apply to every bar and table on the page, not only the biggest.

## Bar thickness

Bars in a standalone chart adapt to how many bars there are, how much room the card has, and the window size. Do not use one fixed thickness for every chart.

- Do pick the thickness from the number of bars. Start from these tiers (multiples of 4), then adjust to the room:

| Bars in the chart | Thickness |
|---|---|
| 1 to 4 | 24px |
| 5 to 8 | 16px |
| 9 to 16 | 12px |
| 17 to 30 | 8px |
| More than 30 | group, show the top N and an "Other" row, or paginate. Do not go thinner |

- Do keep the gap between bars at about half the thickness, at least 4px.
- Do let the thickness follow the space. Where the chart has a fixed height, use `thickness = clamp(8px, height / (1.5 × bars), 24px)`. Where the card can grow, use the tier and let the card height follow the content. Use container-relative units, `clamp()` or flex and grid so bars resize when the card or window resizes.
- Do size vertical columns the same way, along the width: `width = clamp(8px, (card width - gaps) / columns, 48px)`, gap at least 4px. If columns would fall under 8px, aggregate (weeks to months, for example) or show the latest period only.
- Do not shrink bars below the minimum (8px). Group, cut or paginate instead.
- Do not stretch bars to fill spare height when there are few. Cap at 24px and let the card height follow the content.
- Do keep one thickness within a chart, and the same tier thickness for charts of the same size across the dashboard. Name the tiers as tokens (for example `--bar-lg`, `--bar-md`, `--bar-sm`, `--bar-xs`).
- Do let a bar row be at least the thickness plus 8px high. Thick bars make taller rows.
- Do check each chart at a wide desktop width, a narrow window and phone width, in the render or screenshots, and fix any chart whose bars look thin or heavy at any of them.
- Bars inside table or list rows are not part of this rule. They keep one thickness set by the row height (8px by default).

## Bars

- Do put the number of a progress bar in a table row in a fixed-width, right-aligned box (`min-width: 3ch`), with the bar left of it in a right-aligned flex row. Bars then start at the same x in every row. Fill the bar with the row's status colour.
- Do cap the name column in a bar list (name, bar, figure) at about 45% of the card and keep the bar at least about 64px. Cut long names with an ellipsis and put the full name in the hover text. An uncapped name column squeezes the bars.
- Do give the value column a width that fits the longest value, and forbid wrapping. Anchor any marker to the left edge of the column, so it does not move with the length of the text.
- Do round bar ends to half the bar thickness, so every bar is a pill at any thickness.

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
