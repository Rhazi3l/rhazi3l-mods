#!/usr/bin/env python3
"""COOK (cookfood.net) shortlist of main meals for two against personal nutrition targets.

  cook.py pick [--refresh]   top 20, top 10 with flags, and a proposed 4
  cook.py stats [--refresh]  how the whole main-meal range does against the targets

COOK has no API. The menu pages embed product JSON and the product pages hold the
nutrition and ingredient tables, so this reads public HTML with no login. Pages are
cached for catalogue.maxAgeDays. Outputs go to $COOK_PICKER_DATA (default ~/.local/share/cook-picker).
"""
import argparse
import datetime
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PREFS = json.loads((ROOT / "preferences.json").read_text(encoding="utf-8"))
DATA = Path(os.environ.get("COOK_PICKER_DATA", Path.home() / ".local/share/cook-picker"))
SITE = "https://www.cookfood.net"
T = PREFS["targetsPerPortion"]
W = PREFS["weights"]
CAT = PREFS["catalogue"]
FIELDS = {"energyCal": "kcal", "protein": "protein", "carbs": "carbs", "sugars": "sugar", "fat": "fat",
          "saturates": "sat", "fibre": "fibre", "salt": "salt"}


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (cook-picker)"})
    try:
        return urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return ""


def cached(name, url, refresh):
    path = DATA / "cache" / (re.sub(r"[^a-z0-9-]+", "_", name.lower()) + ".html")
    age = (time.time() - path.stat().st_mtime) / 86400 if path.exists() else None
    if refresh or age is None or age > CAT["maxAgeDays"]:
        text = fetch(url)
        if text:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text, encoding="utf-8")
        time.sleep(CAT["requestDelaySec"])
        return text
    return path.read_text(encoding="utf-8")


def num(text):
    m = re.search(r"[\d.]+", (text or "").replace(",", ""))
    return float(m.group()) if m else None


def term_regex(term):
    stem = re.escape(term[:-1]) + "(y|ies)" if term.endswith("y") else re.escape(term) + "(e?s)?"
    return re.compile(rf"\b{stem}\b", re.I)


def has(term, text):
    return bool(term_regex(term).search(text or ""))


def clean(text):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html.unescape(text or ""))).strip()


def table(head, rows):
    print("| " + " | ".join(head) + " |\n|" + "---|" * len(head))
    for r in rows:
        print("| " + " | ".join(str(c) for c in r) + " |")


# ---------------- parsing ----------------
def category_products(page):
    """Products from the JSON a category page assigns to window.__INITIALPROPS__."""
    m = re.search(r'\["category_\d+_available_products"\]\s*=\s*', page)
    if not m:
        return []
    data, _ = json.JSONDecoder().raw_decode(page, m.end())
    return [p for p in data.get("productSections", []) if p.get("productId")]


def serves(text):
    return int(num(text) or 0)


def sections(block):
    """Split a nutrition or ingredients tab into {people served: html}. A product sold in one size
    has no "serves N" headings, so its single section is keyed 0 (any size)."""
    parts = re.split(r"<h6>\s*serves\s*(\d+)\s*</h6>", block, flags=re.I)
    if len(parts) == 1:
        return {0: block}
    return {int(parts[i]): parts[i + 1] for i in range(1, len(parts) - 1, 2)}


def tab(page, name):
    m = re.search(rf"<h3>\s*<a[^>]*>\s*{name}\s*</a>\s*</h3>(.*?)(?=<div class=\"accordion_item\"|\Z)", page, re.S | re.I)
    return m.group(1) if m else ""


def parse_product(page):
    """Per-pack-size nutrition and ingredients from a product page, keyed by people served (0 = only size)."""
    out = {"nutrition": {}, "ingredients": {}}
    for size, body in sections(tab(page, "Nutrition")).items():
        vals = {}
        for key, name in FIELDS.items():
            m = re.search(rf'id="[^"]*_{key}Portion"[^>]*>([^<]*)<', body)
            if m and num(m.group(1)) is not None:
                vals[name] = num(m.group(1))
        if vals:
            out["nutrition"][size] = vals
    for size, body in sections(tab(page, "Ingredients")).items():
        found = re.findall(r'<p class="ingredients">(.*?)</p>', body, re.S)
        text = clean(" ".join(found)) if found else re.sub(r"Please Note:.*$", "", clean(body)).strip()
        if text:
            out["ingredients"][size] = text
    return out


def for_size(table_, size):
    return table_.get(size) or table_.get(0)


# ---------------- catalogue ----------------
def catalogue(refresh):
    items = {}
    sources = list(CAT["categories"].items()) + [(None, s) for s in CAT.get("extraSources", [])]
    for kind, slug in sources:
        page = cached("cat-" + slug, f"{SITE}/menu/main-meals/{slug}", refresh)
        for p in category_products(page):
            it = items.setdefault(p["productId"], {
                "id": p["productId"], "title": clean(p["title"]), "slug": p["link"], "kinds": [],
                "symbols": p.get("symbolIds") or [], "description": clean(p.get("description")),
                "packs": {serves(s["servesText"]): {"price": s["price"], "grams": s.get("servesInGrams"),
                                                    "buyable": s.get("allowAddToBasket", True)}
                          for s in p.get("servings", []) if serves(s.get("servesText"))},
                "available": p.get("available", True)})
            if kind and kind not in it["kinds"]:
                it["kinds"].append(kind)
    if not items:
        sys.exit("No products found: COOK may have changed its menu pages.")
    for cuisine, slugs in CAT.get("cuisineCategories", {}).items():
        for slug in slugs:
            for p in category_products(cached("cat-" + slug, f"{SITE}/menu/main-meals/{slug}", refresh)):
                if p["productId"] in items:
                    items[p["productId"]]["cuisine"] = cuisine
    return list(items.values())


def side_catalogue(refresh):
    """Sides sold as Serves 1 or 2, with nutrition per portion for the household."""
    cfg = PREFS.get("sides", {})
    if not cfg.get("enabled"):
        return []
    page = cached("cat-" + cfg["source"], f"{SITE}/menu/main-meals/{cfg['source']}", refresh)
    out = []
    for p in category_products(page):
        title = clean(p["title"])
        if re.search(cfg["excludeTitlePattern"], title, re.I) or not p.get("available", True):
            continue
        it = {"title": title, "slug": p["link"],
              "packs": {serves(s["servesText"]): {"price": s["price"], "buyable": s.get("allowAddToBasket", True)}
                        for s in p.get("servings", []) if serves(s.get("servesText"))}}
        opts = pack_options(it)
        if not opts:
            continue
        detail = parse_product(cached("p-" + it["slug"], f"{SITE}/products/{it['slug']}", refresh))
        size, how, pp = min(opts, key=lambda o: o[2])
        nut = for_size(detail["nutrition"], size)
        ingr = for_size(detail["ingredients"], size) or ""
        if not nut or "kcal" not in nut or any(has(t, ingr + " " + title) for t in PREFS["hardDrop"]["ingredientTerms"]):
            continue
        out.append({**it, "how": how, "pricePP": round(pp, 2), "n": nut, "ingredients": ingr,
                    "cuisine": side_cuisine(title), "url": f"{SITE}/products/{it['slug']}"})
    return out


def side_cuisine(title):
    return {c for c, terms in PREFS["sides"]["cuisine"].items() if any(has(t, title) for t in terms)}


def fits(side, main):
    cfg = PREFS["sides"]
    starchy = any(has(t, side["title"]) for t in cfg["starchTerms"])
    if starchy and re.search(cfg["mainStarchPattern"], main["title"], re.I):
        return False
    if side["cuisine"]:
        return main.get("cuisine") in side["cuisine"]
    return main.get("cuisine") is None


def combine(a, b):
    return {k: round(a.get(k, 0) + b.get(k, 0), 2) for k in set(a) | set(b)}


def pair_sides(pool, sides):
    """Pair a side only where it lifts a main from outside the top 10 into it. Mains already in the
    top 10 by themselves stay unpaired. The side must also lower the penalty by sides.minImprovement."""
    gain, n = PREFS["sides"]["minImprovement"], PREFS["shortlist"]["detail"]
    alone = sorted(pool, key=lambda r: (r["penalty"], -r["n"]["protein"]))
    for r in pool:
        r["side"], r["mainOnly"] = None, {"n": r["n"], "penalty": r["penalty"]}
    if len(alone) <= n:
        return
    bar = alone[n - 1]["penalty"]
    for r in alone[n:]:
        best = None
        for s in sides:
            if fits(s, r):
                p = penalty({**r, "n": combine(r["n"], s["n"])})
                if best is None or p < best[0]:
                    best = (p, s)
        if best and best[0] < bar and r["penalty"] - best[0] >= gain:
            s = best[1]
            r["side"] = {k: s[k] for k in ("title", "how", "pricePP", "url", "n")}
            r["n"], r["penalty"] = combine(r["n"], s["n"]), best[0]
            r["ingredients"] += " " + s["ingredients"]
            r["pricePP"] = round(r["pricePP"] + s["pricePP"], 2)


def pack_options(it):
    """Ways to feed the household: one pack for that many people, or one single pack each."""
    people = PREFS["plan"]["people"]
    packs = {k: v for k, v in it["packs"].items() if v["buyable"]}
    opts = []
    if people in packs:
        opts.append((people, f"1 x Serves {people}", packs[people]["price"] / people))
    if 1 in packs and people != 1:
        opts.append((1, f"{people} x Serves 1", packs[1]["price"]))
    return opts


TITLE_KINDS = [("chicken", "chicken"), ("turkey", "chicken"), ("beef", "beef"), ("steak", "beef"), ("lamb", "lamb"),
               ("pork", "pork"), ("duck", "duck & game"), ("venison", "duck & game"), ("salmon", "fish"), ("cod", "fish"),
               ("haddock", "fish"), ("fish", "fish"), ("prawn", "fish")]


def protein_kind(it):
    if not it["kinds"]:
        return next((k for w, k in TITLE_KINDS if has(w, it["title"])), "other")
    for k in it["kinds"]:
        if k != "vegetarian":
            return k
    return "vegetarian" if "vegetarian" in it["kinds"] else "other"


def enrich(items, refresh):
    """One row per meal, using whichever pack option scores best for the targets (cheaper on a tie)."""
    rows, skipped = [], Counter()
    for i, it in enumerate(items):
        if re.search(PREFS["exclude"]["titlePattern"], it["title"], re.I):
            skipped["excluded by title"] += 1
            continue
        opts = pack_options(it) if it["available"] else []
        if not opts:
            skipped["not sold as Serves 1 or 2"] += 1
            continue
        if sys.stderr.isatty():
            print(f"\r  reading product pages {i + 1}/{len(items)}", end="", file=sys.stderr, flush=True)
        detail = parse_product(cached("p-" + it["slug"], f"{SITE}/products/{it['slug']}", refresh))
        chilli = max([int(s[1]) for s in it["symbols"] if re.fullmatch(r"c\d", s)] or [0])
        best = None
        for size, how, pp in opts:
            nut = for_size(detail["nutrition"], size)
            if not nut or not {"kcal", "protein", "sat", "salt"} <= nut.keys():
                continue
            row = {**it, "kind": protein_kind(it), "how": how, "pricePP": round(pp, 2), "n": nut,
                   "ingredients": for_size(detail["ingredients"], size) or "", "chilli": chilli,
                   "url": f"{SITE}/products/{it['slug']}"}
            row["penalty"] = penalty(row)
            if best is None or (row["penalty"], row["pricePP"]) < (best["penalty"], best["pricePP"]):
                best = row
        if best:
            rows.append(best)
        else:
            skipped["no nutrition table"] += 1
    print("", file=sys.stderr)
    return rows, skipped


# ---------------- scoring ----------------
def misses(n):
    out = {}
    if n.get("sat", 0) > T["satFatG"]["ideal"]:
        out["sat"] = (n["sat"] - T["satFatG"]["ideal"]) / T["satFatG"]["ideal"]
    if n.get("salt", 0) > T["saltG"]["ideal"]:
        out["salt"] = (n["salt"] - T["saltG"]["ideal"]) / T["saltG"]["ideal"]
    if n.get("protein", 0) < T["proteinG"]["min"]:
        out["protein"] = (T["proteinG"]["min"] - n["protein"]) / T["proteinG"]["min"]
    if n.get("fibre", 0) < T["fibreG"]["min"]:
        out["fibre"] = (T["fibreG"]["min"] - n.get("fibre", 0)) / T["fibreG"]["min"]
    if n.get("sugar", 0) > T["sugarsG"]["ideal"]:
        out["sugar"] = (n["sugar"] - T["sugarsG"]["ideal"]) / T["sugarsG"]["ideal"]
    return out


def penalty(r):
    n, m = r["n"], misses(r["n"])
    weight = {"sat": W["satFat"], "salt": W["salt"], "protein": W["protein"], "fibre": W["fibre"], "sugar": W["sugar"]}
    p = sum(v * weight[k] for k, v in m.items())
    if n["salt"] > T["saltG"]["acceptableOccasional"]:
        p += W["saltOverAcceptable"]
    return round(p + r["chilli"] * W["hotPerChilli"], 2)


def flags(r):
    text = r["ingredients"]
    pr = PREFS["processing"]
    return {
        "drop": [t for t in PREFS["hardDrop"]["ingredientTerms"] if has(t, text) or has(t, r["title"])],
        "flag": [t for t in PREFS["flagOnly"]["terms"] if has(t, text)],
        "additives": [t for t in pr["additiveTerms"] if has(t, text)],
        "processedMeat": [t for t in pr["processedMeatTerms"] if has(t, text) or has(t, r["title"])],
        "watch": [g for g, ts in PREFS["bloatingWatchlist"]["groups"].items() if any(has(t, text) for t in ts)],
    }


def miss_text(r):
    n, m = r["n"], misses(r["n"])
    labels = {"sat": f"sat {n.get('sat')}g", "salt": f"salt {n.get('salt')}g", "protein": f"protein {n.get('protein')}g",
              "fibre": f"fibre {n.get('fibre', 0)}g", "sugar": f"sugar {n.get('sugar')}g"}
    return ", ".join(labels[k] for k in m) or "none"


def score_all(rows):
    for r in rows:
        r["flags"] = flags(r)
    return sorted(rows, key=lambda r: (r["penalty"], -r["n"]["protein"]))


def propose(ranked):
    cap, final, kinds = PREFS["plan"]["maxPerProteinType"], [], Counter()
    bonus = PREFS["variety"]["fishBonus"]
    for r in sorted(ranked, key=lambda r: r["penalty"] - (bonus if r["kind"] == "fish" else 0)):
        if kinds[r["kind"]] < cap:
            kinds[r["kind"]] += 1
            final.append(r)
        if len(final) == PREFS["shortlist"]["final"]:
            break
    return final


def nut_cells(r):
    n = r["n"]
    return [int(n["kcal"]), n["protein"], n.get("sat"), n.get("salt"), n.get("fibre", 0), n.get("sugar")]


def load(refresh, with_sides=True):
    rows, skipped = enrich(catalogue(refresh), refresh)
    for r in rows:
        r["penalty"], r["side"] = penalty(r), None
    ranked = score_all(rows)
    dropped = [r for r in ranked if r["flags"]["drop"]]
    excluded = [r for r in ranked if r["kind"] in PREFS["exclude"]["proteinTypes"]]
    pool = [r for r in ranked if r not in dropped and r not in excluded]
    if with_sides:
        pair_sides(pool, side_catalogue(refresh))
        pool = score_all(pool)
    return ranked, pool, dropped, excluded, skipped


def save(name, rows):
    run = DATA / "runs" / datetime.date.today().isoformat()
    run.mkdir(parents=True, exist_ok=True)
    (run / name).write_text(json.dumps(rows, indent=1, default=str), encoding="utf-8")
    return run


# ---------------- commands ----------------
def cmd_pick(args):
    ranked, pool, dropped, excluded, skipped = load(args.refresh)
    s = PREFS["shortlist"]
    top, detail = pool[:s["top"]], pool[:s["detail"]]
    final = propose(detail)
    run = save("pick.json", {"top": top, "final": final})
    print(f"Read {len(ranked)} main meals for two. Skipped: {dict(skipped) or 'none'}. "
          f"Excluded {len(excluded)} ({', '.join(PREFS['exclude']['proteinTypes'])}), hard-dropped {len(dropped)}.\n")
    print(f"## Top {len(top)} (lower penalty is better; per portion; {T['proteinG']['min']}g+ protein, "
          f"<{T['satFatG']['ideal']}g sat, <{T['saltG']['ideal']}g salt, {T['fibreG']['min']}g+ fibre)\n")
    print("Figures include the paired side where there is one.\n")
    table(["#", "Meal", "Side", "Type", "Penalty", "kcal", "Protein", "Sat", "Salt", "Fibre", "Sugar", "£/person", "Buy"],
          [[i + 1, r["title"], r["side"]["title"] if r["side"] else "-", r["kind"], r["penalty"], *nut_cells(r),
            f"{r['pricePP']:.2f}", r["how"] + (f" + {r['side']['how']}" if r["side"] else "")]
           for i, r in enumerate(top)])
    paired = [r for r in detail if r.get("side")]
    if paired:
        print("\n## Why these sides\n")
        table(["Meal", "Side", "Main alone misses", "With side misses", "Side adds"],
              [[r["title"], r["side"]["title"], miss_text(r["mainOnly"]), miss_text(r),
                f"+{r['side']['n'].get('fibre', 0)}g fibre, +{r['side']['n'].get('protein', 0)}g protein, "
                f"+{int(r['side']['n'].get('kcal', 0))} kcal, £{r['side']['pricePP']:.2f}/person"] for r in paired])
    print(f"\n## Top {len(detail)} with flags\n")
    table(["Meal", "Misses", "Flags", "Additives", "Processed meat", "Chilli", "Bloating watchlist"],
          [[r["title"], miss_text(r), ", ".join(r["flags"]["flag"]) or "-", ", ".join(r["flags"]["additives"]) or "-",
            ", ".join(r["flags"]["processedMeat"]) or "-", r["chilli"] or "-", ", ".join(r["flags"]["watch"]) or "-"]
           for r in detail])
    print(f"\n## Proposed {len(final)}\n")
    total = 0
    for r in final:
        total += r["pricePP"] * PREFS["plan"]["people"]
        side = f" + **{r['side']['title']}** ({r['side']['how']}) - {r['side']['url']}" if r["side"] else ""
        print(f"- **{r['title']}** ({r['how']}) - {r['url']}{side} - £{r['pricePP'] * PREFS['plan']['people']:.2f}")
    print(f"\nTotal for {len(final)} meals for two: £{total:.2f}")
    if dropped:
        print("\nHard-dropped: " + "; ".join(f"{r['title']} ({', '.join(r['flags']['drop'])})" for r in dropped[:10]))
    print(f"\nSaved to {run}")


def cmd_stats(args):
    ranked, pool, *_ = load(args.refresh, with_sides=False)
    rows = pool
    n = len(rows)
    if not n:
        sys.exit("Nothing to summarise.")

    def share(pred):
        return f"{sum(1 for r in rows if pred(r))}/{n} ({round(100 * sum(1 for r in rows if pred(r)) / n)}%)"

    def median(key):
        v = sorted(r["n"].get(key, 0) for r in rows)
        return v[n // 2]

    print(f"## How {n} COOK main meals for two meet the targets (per portion)\n")
    table(["Target", "Meets it", "Median"], [
        [f"Protein {T['proteinG']['min']}g+", share(lambda r: r["n"]["protein"] >= T["proteinG"]["min"]), median("protein")],
        [f"Sat fat {T['satFatG']['ideal']}g or less", share(lambda r: r["n"].get("sat", 99) <= T["satFatG"]["ideal"]), median("sat")],
        [f"Salt {T['saltG']['ideal']}g or less", share(lambda r: r["n"]["salt"] <= T["saltG"]["ideal"]), median("salt")],
        [f"Salt under {T['saltG']['acceptableOccasional']}g", share(lambda r: r["n"]["salt"] <= T["saltG"]["acceptableOccasional"]), "-"],
        [f"Fibre {T['fibreG']['min']}g+", share(lambda r: r["n"].get("fibre", 0) >= T["fibreG"]["min"]), median("fibre")],
        [f"Sugar {T['sugarsG']['ideal']}g or less", share(lambda r: r["n"].get("sugar", 99) <= T["sugarsG"]["ideal"]), median("sugar")],
        ["No target missed", share(lambda r: not misses(r["n"])), "-"],
        ["Any additive term", share(lambda r: r["flags"]["additives"]), "-"],
        ["Processed meat", share(lambda r: r["flags"]["processedMeat"]), "-"],
    ])
    print("\n## By protein type (median penalty)\n")
    kinds = sorted({r["kind"] for r in rows})
    table(["Type", "Meals", "Median penalty"], [
        [k, len(v := sorted(r["penalty"] for r in rows if r["kind"] == k)), v[len(v) // 2]] for k in kinds])


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("pick", "stats"):
        p = sub.add_parser(name)
        p.add_argument("--refresh", action="store_true", help="ignore the page cache")
    args = ap.parse_args()
    {"pick": cmd_pick, "stats": cmd_stats}[args.cmd](args)


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    main()
