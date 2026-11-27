---
name: cook-picker
description: Shortlist COOK (cookfood.net) frozen main meals for two against personal nutrition targets, pairing a side where it fixes a miss (top 20, then top 10 with flags, then a proposed 4), or show how the whole COOK range does against the targets. Use when asked to pick, shortlist or review COOK meals.
argument-hint: [pick|stats] [--refresh]
---

# COOK picker

Needs Python 3 only (`python3`, or `python` on Windows). COOK has no API: the script reads the product JSON embedded in the public main-meal category pages and the nutrition and ingredient tables on each product page, with no login. Pages are cached for 30 days (`catalogue.maxAgeDays`), since COOK's range is fixed rather than weekly; a fresh run reads about 230 pages at one per second (about 4 minutes). Rules and targets are in `preferences.json` next to this file, copied from gousto-picker.

Let `DIR` be the folder holding this SKILL.md. Outputs go to `~/.local/share/cook-picker/` (override with `COOK_PICKER_DATA`).

## Run

1. `python3 -I DIR/scripts/cook.py pick` prints the top 20, the top 10 with flags, and a proposed 4 with links and the total price. Add `--refresh` to ignore the cache.
2. `python3 -I DIR/scripts/cook.py stats` prints how the whole range meets each target. Use it when the user asks whether COOK is healthy overall.
3. Show the user the top 10 with misses and flags, and the proposed 4. The user makes the final choice.

## Rules

- Feeding two: each meal is either one Serves 2 pack or two Serves 1 packs, whichever scores better on the targets (cheaper on a tie). Serves 1 packs widen the choice, since many dishes come only in that size.
- Sides: each main is tried with every side from the sides page (Serves 1 or 2 packs; gravies, sauces, trimmings and meaty starters left out). The best side is paired only if it lowers the penalty by `sides.minImprovement`, so most mains stay unpaired. Pairing figures, price and ingredient flags then include the side, and ranking uses them. The "Why these sides" table shows what each side fixes.
- Sides must suit the dish: Indian sides (naan, dhal, saag...) only with Indian mains, Asian sides (spring rolls, soy greens...) only with Thai and pan-Asian mains, plain rice with either, everything else only with the remaining mains. A starchy side is never added to a main that already has rice, pasta, potato, couscous or pastry.
- `stats` judges mains alone, without sides.
- If fibre is still the only miss, say a home vegetable side would cover it.
- Prawn is the only hard drop. Flag terms, additives and processed meat are flag-only.
- The bloating watchlist only highlights. It never filters or re-ranks.
- Chilli level is a soft penalty. The proposed 4 has at most 2 dishes of one protein, and fish only wins close calls.
- COOK publishes no cook time, so there is no speed penalty.
- Weights are in `weights` in `preferences.json`. They are assumptions, not user-set, so say so if asked. Sugar cannot separate added from intrinsic.
