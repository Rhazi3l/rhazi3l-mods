---
name: gousto-picker
description: Shortlist a week's Gousto recipes against personal nutrition targets (top 20, then top 10, then a proposed 4). Use when asked to pick, shortlist or review Gousto recipes for a delivery Monday.
argument-hint: <delivery Monday YYYY-MM-DD> [more dates]
---

# Gousto picker

Needs `python3` only. The script uses undocumented Gousto endpoints with no login, so keep request rates low and expect them to change. Rules and targets are in `preferences.json` next to this file; edit that file to change them.

Let `DIR` be the folder holding this SKILL.md. Outputs go to `~/.local/share/gousto-picker/runs/<date>/` (override with `GOUSTO_PICKER_DATA`).

## Run

1. Use the date(s) in the arguments, or ask for the delivery Monday(s). Run each date separately.
2. `python3 -I DIR/scripts/gousto.py stage1 --date YYYY-MM-DD` prints the top 20 from the menu.
3. `python3 -I DIR/scripts/gousto.py stage2 --date YYYY-MM-DD` fetches detail for those 20 and prints the top 10, a proposed final 4, and any exclusions. It saves photos of flagged recipes to the run folder.
4. Judge each flagged ingredient line as `separable`, `structural` or `unclear` from the recipe title, the ingredient line form and the photo (read the image file). A photo is a clue only, so use `unclear` when unsure.
   - `separable`: one person can omit or split it (feta on a salad).
   - `structural`: cooked into a sauce or base, so both eat it (red wine paste in a sauce).
   - Red wine, balsamic and similar condiment lines lean `structural`.
5. If any verdict is `structural`, save `{"<exact title>": {"<term>": "structural"}}` to a JSON file and rerun stage 2 with `--verdicts <file>`. Structural recipes drop out and are listed so the user can bring one back.
6. Show the user the top 10 with misses, flags, heat, surcharge and watchlist groups, and the proposed 4. The user makes the final choice.

## Rules

- Use exact recipe names.
- Prawn is the only hard drop. Everything else flagged is a judgement call.
- The bloating watchlist only highlights. It never filters or re-ranks, so the user can spot patterns.
- Heat is a soft penalty and surcharge is flag-only.
- Nutrition decides the proposed 4. Fish only wins close calls (`variety.fishBonus`).
- Menus exist for Mondays only. The script warns on any other date.
- Ranking weights are in `weights` in `preferences.json`. They are assumptions, not user-set, so say so if asked. Sugar cannot separate added from intrinsic.
