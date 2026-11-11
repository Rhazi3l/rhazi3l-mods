# Palette

## Fixed base

Source: the user's Omarchy theme `rhazi3l` (`colors.toml`), dark values. The light values are derived for this skill and are not from the theme. If the theme changes, change this file only.

| Role | Dark (default) | Light |
|---|---|---|
| Page | `#121418` | `#eef0f3` |
| App background | `#16181d` | `#f6f7f9` |
| Raised card | `#22262d` | `#ffffff` |
| Selected / hover | `#323844` | `#e3e7ee` |
| Text primary | `#cdd3dd` | `#16181d` |
| Text secondary | `#b4bbc7` | `#4a5262` |
| Text muted | `#959eae` | `#5d6677` |
| Accent fill | `#d4743c` | `#d4743c` |
| Accent as text or ink | `#d4743c` | `#a8531f` |
| Text on an accent fill | `#16181d` | `#16181d` |

Borders: the primary text colour at 6 to 10 percent opacity.

Do not use `#5d6677` as text on dark, or `#787d87` as text in either mode. They fail 4.5 to 1.

Contrast working (relative luminance, my arithmetic):

- Dark: primary on app background about 9 to 1 or more, secondary about 9.2, muted about 6.6, accent as text about 5.4, dark text on the accent fill about 5.4.
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
| Off / unlit / baseline | `#787d87` | Tracks, bars and strokes only, never text |
| Extra series | `#8fbcbb` cyan, `#d4a8d6` magenta | Only when more series are needed |

Series order: blue, green, yellow, magenta, cyan, then red last. Orange highlights one series or point and is not a default series.

Dark-mode contrast on `#16181d` (my arithmetic): blue about 6.9, green about 9.6, yellow about 11.7, red about 6.3, grey about 4.3.

In light mode, darken each hue until text on or in it reaches 4.5 to 1, and keep the hue recognisable.

Distance between cyan, magenta and the others has not been checked. If two neighbouring series look alike, change one.
