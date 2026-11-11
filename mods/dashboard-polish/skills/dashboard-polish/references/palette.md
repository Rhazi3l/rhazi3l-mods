# Palette

## Fixed base

The accent is from the user's Omarchy theme `rhazi3l` (`colors.toml`). The dark neutrals are a darker, neutral charcoal, not the theme's blue-tinted one. The light values are derived for this skill and are not from the theme. This file is the only place these values live. If the theme changes, change this file only.

| Role | Dark (default) | Light |
|---|---|---|
| Page and app background | `#121212` | `#f6f7f9` |
| Raised card | `#1d1d1d` | `#ffffff` |
| Selected / hover | `#2e2e2e` | `#e3e7ee` |
| Text primary | `#d2d2d2` | `#16181d` |
| Text secondary | `#b6b6b6` | `#4a5262` |
| Text muted | `#9b9b9b` | `#5d6677` |
| Accent fill | `#d4743c` | `#d4743c` |
| Accent as text or ink | `#d4743c` | `#a8531f` |
| Text on an accent fill | `#121212` | `#16181d` |

Borders: hairlines, the primary text colour at 6 to 10 percent opacity (about `#2a2a2a` on a dark card). Hover and track tints are the text colour at about 8 percent, so they stay neutral.

Light mode has a slightly darker page behind the cards: `#eef0f3`.

Do not use `#5d6677` as text on dark, or `#7a7a7a` as text in either mode. They fail 4.5 to 1.

## Contrast working

Relative luminance, approximate. Recheck with a contrast tool before relying on them, and again if any value changes.

Dark, on the `#1d1d1d` card:

| Colour | Ratio |
|---|---|
| Text primary `#d2d2d2` | about 11.1 |
| Text secondary `#b6b6b6` | about 8.3 |
| Text muted `#9b9b9b` | about 6.1 |
| Accent `#d4743c` as text | about 5.1 |
| Blue `#73a5de` | about 6.5 |
| Green `#9dcb86` | about 9.1 |
| Yellow `#f1ce7e` | about 11.1 |
| Red `#e67a85` | about 6.0 |
| Cyan `#8fbcbb` | about 8.1 |
| Magenta `#d4a8d6` | about 8.3 |
| Grey `#7a7a7a` | about 3.9 (4.4 on the page), so never text |

Dark text `#121212` on the accent fill: about 5.7.

Light, on `#f6f7f9`: muted `#5d6677` about 5.4, secondary `#4a5262` about 7.3, accent text `#a8531f` about 4.9. The plain `#d4743c` as text on light is about 3.1, so it fails and the darker shade is used.

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

In light mode, darken each hue until text on or in it reaches 4.5 to 1, and keep the hue recognisable.

Distance between cyan, magenta and the others has not been checked. If two neighbouring series look alike, change one.
