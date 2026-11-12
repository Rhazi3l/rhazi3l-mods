# Palette: backgrounds and accent

Only the values in the first two tables are fixed. Do not change them per dashboard. Everything after them is a guideline. If a value changes, change this file only.

## Fixed

| Role | Dark (default) | Light |
|---|---|---|
| Page | `#151618` | `#e8eaee` |
| Card | `#202225` | `#f5f6f8` |
| Border | `#303338` | `#d3d8e0` |
| Accent (burnt orange) | `#d4743c` | `#af5926` |

The dark ramp has only a faint cool tint, between plain charcoal and a blue-tinted theme. The light card is a soft off-white and never pure white, because pure white is too bright. Check data colours against this card, not against white, since they lose about 0.5 of contrast. Borders are 1px hairlines.

## Guidelines, not values

- Text has three neutral roles, with the same faint tint as the surfaces. Primary is at least 10 to 1 on the card, secondary about 7 to 1, and muted at least 5 to 1. Choose the shades to meet these, in each mode.
- The selected tint is the accent at 20 percent over the card. The hover and bar-track tint is the primary text colour at about 8 percent, so it stays neutral. Work these out per mode.
- Text on an orange fill is dark in dark mode and white in light mode (about 4.9 to 1 on `#af5926`).
- Accent used as text needs 4.5 to 1 on the card. The plain `#d4743c` as text on light is about 3.1, so light mode uses `#af5926`.
- Check every pair with a script, not by eye, and list any text and background pair below 4.5 to 1 in the report.
- Do not use a fixed data palette. Data colours follow [data-colour.md](data-colour.md).
