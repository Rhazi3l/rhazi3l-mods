# Palette

## Fixed base

Source: the user's Omarchy theme `rhazi3l` (`colors.toml`) for the accent. The dark neutrals were changed from the theme's blue-tinted charcoal to a neutral, darker charcoal at the user's request after they saw the first version. The light values are derived for this skill and are not from the theme. If the theme changes, change this file only.

| Role | Dark (default) | Light |
|---|---|---|
| Page | `#121212` | `#eef0f3` |
| App background | `#121212` | `#f6f7f9` |
| Raised card | `#1d1d1d` | `#ffffff` |
| Selected / hover | `#2e2e2e` | `#e3e7ee` |
| Text primary | `#d2d2d2` | `#16181d` |
| Text secondary | `#b6b6b6` | `#4a5262` |
| Text muted | `#9b9b9b` | `#5d6677` |
| Accent fill | `#d4743c` | `#d4743c` |
| Accent as text or ink | `#d4743c` | `#a8531f` |
| Text on an accent fill | `#121212` | `#16181d` |

Borders: the primary text colour at 6 to 10 percent opacity.

Do not use `#5d6677` as text on dark, or `#7a7a7a` as text in either mode. They fail 4.5 to 1.

Contrast working (relative luminance, my arithmetic):

- Dark (my arithmetic on `#1d1d1d` cards and `#121212` page): primary about 11 to 1, secondary about 8.3, muted about 6.1, accent as text about 5.1, dark text on the accent fill about 5.7. Recheck with a contrast tool before relying on them.
- Light: muted `#5d6677` on `#f6f7f9` about 5.4, secondary about 7.3, accent text `#a8531f` about 4.9. The plain `#d4743c` as text on light is about 3.1, so it fails and the darker shade is used.

Check these again if any value changes.

## Pastel guide (flexible)

Starting points taken from the user's `clean-view` mod and the theme's bright colours. Adjust freely, keep the meanings.

| Meaning | Dark starting value | Note |
|---|---|---|
| In progress / accent | `#d4743c` | Fixed, same as the accent |
| Waiting / info | `#73a5de` | A clear blue |
| Warning / stuck | `#f1ce7e` | A warm yellow |
| Good / done / on | `#9dcb86` | A fresh green |
| Bad / error | `#e67a85` | A coral red |
| Off / unlit / baseline | `#7a7a7a` | The grey status or series only, never text. Never a plain bar fill for something that is not off |
| Extra series | `#8fbcbb` cyan, `#d4a8d6` magenta | Only when more series are needed |

Series order: blue, green, yellow, magenta, cyan, then red last. Orange highlights one series or point and is not a default series.

Dark-mode contrast on the earlier `#16181d` background (my arithmetic, not redone for `#121212`, where each is slightly higher): blue about 6.9, green about 9.6, yellow about 11.7, red about 6.3, grey about 4.3.

In light mode, darken each hue until text on or in it reaches 4.5 to 1, and keep the hue recognisable.

Distance between cyan, magenta and the others has not been checked. If two neighbouring series look alike, change one.
