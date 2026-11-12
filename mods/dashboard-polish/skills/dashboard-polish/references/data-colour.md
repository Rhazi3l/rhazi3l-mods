# Data colour, chart forms and keys

There is no fixed data palette. Choose the colours for the product, under these rules. Do not copy a palette from a previous dashboard. The only fixed colours are the neutral ramp and the orange accent in [palette.md](palette.md).

## Choosing colours

- Do use soft pastels in both modes: moderately saturated hues, at least 3 to 1 against the card on dark. Do not use vivid or neon colours.
- Do keep the same hue in light mode. Lower the saturation (about 25 percent) and darken only as far as the 3 to 1 target against the light card needs, so the colours stay soft. Text coloured with a data hue needs 4.5 to 1.
- Do reserve green for good or done and red for bad. Use each only for that meaning, and only when the data has that state. Do not use them for categories. Yellow and every other hue are free for categories.
- Do give each category one colour that no other category or meaning uses, including the accent, green and red. Reusing a colour for a second meaning is a defect unless the report names it.
- Do use only the colours the data needs. Do not add a colour to fill a palette. If there are more categories than colours, group the rest.
- Do space category hues at least 40 degrees apart on the wheel. Hues within 40 degrees count as one hue, so teal beside green or pink beside magenta is too close.
- Do use at most two tones of any hue across the dashboard, for example a strong fill and a soft tint. A third shade is a defect, so take a different hue instead.
- Do measure the distance between every pair of colours in each mode (CIE Lab, at least about 30) and fix any close pair before publishing. Hosts can silently replace a colour that is too close to an earlier one.
- Do render one swatch strip of every colour in each mode and look at it. Fix adjacent colours that are hard to tell apart before they go on the dashboard.
- Do order series with the most important first and red last.
- Do aim for four series or fewer. More than six colours in total means group.

## Marks

- Do fill every bar with a data colour. Do not use grey bars in either mode: grey, or close to the card colour, is hard to see.
- Do give every status a colour, including unstarted or off.
- Do make the track behind a bar a faint neutral tint. It is the only grey allowed.
- Do colour a bar that shows a status with that status's colour, the same as its dot and legend.
- Do give a bar with no status of its own (for example a count per year) one series colour, the same in every panel where that happens. Prefer one not used for a status. If every colour is taken, say in the report which meaning it shares.
- Do use a soft fill (the colour at 15 to 25 percent opacity) with a full-strength stroke or text of the same hue. Put dark text on any solid fill.
- Do not use hue-to-hue gradients, glows or coloured shadows.

## Chart forms

- Do pick the form that makes sense for the data and reads clearly. No chart type is banned. Examples, not a closed list:
  - Segmented bar, pie or ring: shares of one whole, where the parts do not overlap and add up to one whole.
  - Vertical columns or a line: a time series, oldest on the left.
  - Horizontal bars: ranked categories.
  - Dot plot: a rate or share per category. One row per category, one marker on a 0 to 100% scale, sorted high to low, the figure on the right.
  - Table: detail.
- Do not show categories that overlap, such as tags where an item can have several, as parts of a whole. Pick a form that does not imply they add up.
- Do not repeat one form more than twice on a dashboard, and prefer a different form where the data allows.
- Do give every panel the same bar thickness, radius, marker and key rules.
- Do give a clickable column or bar the same hover, selected and faded states as a row.

## Keys

- Do give every chart that uses colour a key: a one-line row of colour squares with short labels, between the card heading and the chart.
- Do add a note that says what the bar length and each figure mean.
- Do not rely on a colour, a marker or an earlier panel to explain itself.
- Do put a marker beside a figure when the colour tells which key entry it belongs to.
- Do use the same word where a colour means the same thing as in another card.
- Do make key squares and legend squares 12px with a 3px radius, one size across the page. Eight pixels is too small to tell similar pastels apart.
