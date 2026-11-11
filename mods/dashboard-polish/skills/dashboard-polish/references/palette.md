# Palette: neutrals and accent

Fixed. Do not change these per dashboard. The accent is from the user's Omarchy theme `rhazi3l`, and the dark neutrals match its page and card. The light values are derived from the same family. If the theme changes, change this file only.

## Dark (default)

| Role | Value | Note |
|---|---|---|
| Page | `#151618` | |
| Card | `#202225` | |
| Border | `#303338` | 1px hairline |
| Text primary | `#d2d2d2` | |
| Text secondary | `#b6b6b6` | midpoint of primary and muted |
| Text muted | `#9b9b9b` | |
| Selected row | `#443229` | the accent at 20% over the card |
| Hover and bar track | `#2e3033` | the primary text at 8% over the card |
| Accent fill | `#d4743c` | text on it is `#151618` |
| Accent as text | `#d4743c` | |

## Light

| Role | Value | Note |
|---|---|---|
| Page | `#e8eaee` | |
| Card | `#f5f6f8` | a soft off-white, never pure white |
| Border | `#d3d8e0` | 1px hairline |
| Text primary | `#16181d` | |
| Text secondary | `#4a5262` | |
| Text muted | `#5d6677` | |
| Selected row | `#eedcd2` | derived: the accent fill at 20% over the card |
| Hover and bar track | `#e3e4e6` | derived: the primary text at 8% over the card |
| Accent fill | `#af5926` | text on it is white |
| Accent as text | `#af5926` | |

The dark ramp has only a faint cool tint, between plain charcoal and a blue-tinted theme. Keep text and borders neutral with the same faint tint.

Do not use pure white for a card, because it is too bright. Check data colours against this card, not against white, since they lose about 0.5 of contrast.

## Contrast working

Approximate, from relative luminance. Recheck with a script if any value changes.

- Dark, on the card: primary about 10.5 to 1, secondary about 7.9, muted about 5.7, accent as text about 4.8. `#151618` text on the accent fill about 5.5.
- Light, on the card: secondary about 7.3, muted about 5.4, accent as text about 4.5. White on the accent fill `#af5926` about 4.9.
- The plain `#d4743c` as text on light is about 3.1, so it fails and `#af5926` is used.
