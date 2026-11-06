#!/usr/bin/env python3
"""Gousto weekly shortlist: stage1 (menu -> top 20), stage2 (detail -> top 10 and a proposed 4).

  gousto.py stage1 --date 2026-11-23
  gousto.py stage2 --date 2026-11-23 [--verdicts verdicts.json]

Uses undocumented Gousto endpoints with no login. Keep request rates low.
Outputs go to $GOUSTO_PICKER_DATA (default ~/.local/share/gousto-picker)/runs/<date>/.
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
import uuid
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PREFS = json.loads((ROOT / "preferences.json").read_text())
DATA = Path(os.environ.get("GOUSTO_PICKER_DATA", Path.home() / ".local/share/gousto-picker"))
API = "https://production-api.gousto.co.uk/experience/choice/menu/v1"
ALL_RECIPES = "ca8f71be-63ac-11e6-a693-068306404bab"
DEVICE = str(uuid.uuid4())
PORTIONS = PREFS["plan"]["portions"]
TARGETS = PREFS["targetsPerPortion"]
W = PREFS["weights"]
FLAG_TERMS = PREFS["flagOnly"]["terms"]
DROP_TERMS = PREFS["hardDrop"]["ingredientTerms"]

# First match wins, so bacon and sausage come last ("Chicken, Bacon & ..." is chicken).
PROTEINS = [(w, k) for k, ws in [
    ("chicken", ["chicken"]), ("turkey", ["turkey"]), ("beef", ["beef", "brisket", "steak"]),
    ("pork", ["pork", "gammon"]), ("lamb", ["lamb"]), ("duck", ["duck"]),
    ("fish", ["salmon", "cod", "basa", "sole", "pollock", "sea bass", "haddock", "tuna", "fish", "trout", "mackerel",
              "kedgeree"]),
    ("shellfish", ["prawn"]), ("pork", ["bacon", "sausage"]),
] for w in ws]
NUTRITION = {"Energy (kCal)": "kcal", "of which saturates (g)": "sat", "of which sugars (g)": "sugar",
             "Fibre (g)": "fibre", "Protein (g)": "protein", "Salt (g)": "salt"}
CONDIMENT = re.compile(r"\b(paste|vinegar|sauce|stock|dressing|marinade|rub|seasoning|spice mix|glaze|gravy|syrup)\b", re.I)


def fetch(url):
    req = urllib.request.Request(url, headers={"X-Gousto-Device-Id": DEVICE, "User-Agent": "gousto-picker"})
    try:
        return urllib.request.urlopen(req, timeout=30).read()
    except urllib.error.HTTPError as e:
        return e.read()


def num(text):
    m = re.search(r"[\d.]+", text or "")
    return float(m.group()) if m else None


def protein_type(title):
    return next((k for w, k in PROTEINS if re.search(rf"\b{w}\b", title, re.I)), "other")


def term_regex(term):
    if term == "pulse beans":
        return re.compile(r"\b(kidney|black|cannellini|butter|haricot|baked|borlotti|pinto|mixed)\s+beans?\b", re.I)
    return re.compile(rf"\b{re.escape(term)}s?\b", re.I)


def val(a, key):
    return a["nutrition"].get(key) or 0


def has(term, text):
    return bool(term_regex(term).search(text))


def clean(text):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", html.unescape(text or "")))


def table(head, rows):
    print("| " + " | ".join(head) + " |\n|" + "---|" * len(head))
    for r in rows:
        print("| " + " | ".join(str(c) for c in r) + " |")


# ---------------- stage 1 ----------------
def parse_item(i):
    tags = i["tagGroups"]
    sub = {t["type"]: t["text"] for t in tags.get("subtitle", [])}
    return {
        "id": i["id"], "urn": i["urn"], "title": i["title"].strip(),
        "mins": num(sub.get("cookingTime")), "kcal": num(sub.get("energy")), "protein": num(sub.get("protein")),
        "dietary": {t["type"] for t in tags.get("dietary", [])},
        "surcharge": i.get("pricing", {}).get("perPortionSurcharge"),
        "available": i["isAvailable"] and any(p["numPortions"] == PORTIONS and p["isAvailable"] for p in i.get("portions", [])),
        "kind": protein_type(i["title"]),
        "image": next((c["url"] for c in i["image"]["crops"] if c["width"] == 700), None),
    }


def stage1(date, run):
    menu = json.loads(fetch(f"{API}/menu?numPortions={PORTIONS}&deliveryDate={date}&categorySlug=all-recipes"))
    if "content" not in menu:
        sys.exit(f"No menu for {date}: {menu.get('detail') or menu}")
    rows = [parse_item(i) for c in menu["content"] if c["type"] == "recipe-grid" for i in c["items"]]
    s1, pmin = PREFS["stage1"], TARGETS["proteinG"]["min"]
    skipped, missing, pool = Counter(), [], []
    for r in rows:
        if None in (r["kcal"], r["protein"], r["mins"]):
            skipped["missing data"] += 1
            missing.append(r["title"])
        elif PREFS["plan"]["requireTwoPortionOption"] and not r["available"]:
            skipped["no 2-portion option"] += 1
        elif r["mins"] > s1["maxCookMins"]:
            skipped["over max time"] += 1
        elif r["dietary"] & set(s1["excludeDietaryTags"]):
            skipped["dietary tag"] += 1
        else:
            r["score"] = round(r["protein"] / r["kcal"] * 100 - max(0, pmin - r["protein"]) * W["proteinShortfallStage1"]
                           - r["mins"] * W["speedStage1"], 2)
            r["flags"] = [t for t in FLAG_TERMS + DROP_TERMS if has(t, r["title"])]
            pool.append(r)
    top, kinds = [], Counter()
    for r in sorted(pool, key=lambda r: -r["score"]):
        if kinds[r["kind"]] < s1["maxPerProteinType"]:
            kinds[r["kind"]] += 1
            top.append(r)
        if len(top) == PREFS["shortlist"]["stage1"]:
            break
    run.mkdir(parents=True, exist_ok=True)
    saved = [{**r, "dietary": sorted(r["dietary"])} for r in top]
    (run / "stage1.json").write_text(json.dumps(saved, indent=1))
    if datetime.date.fromisoformat(date).weekday() != 0:
        print(f"WARNING: {date} is not a Monday. Gousto still returned '{menu['menuTitle']}'; "
              "check it is the delivery you mean.\n")
    if missing:
        print(f"Skipped for missing cook time, kcal or protein: {'; '.join(missing)}\n")
    print(f"# Stage 1: {menu['menuTitle']} | {len(rows)} recipes, skipped {dict(skipped)}, pool {len(pool)}\n")
    table(["#", "Recipe", "kcal", "Protein", "Min", "Type", "Surcharge", "Flags"],
          [(n, r["title"], f"{r['kcal']:.0f}", f"{r['protein']:.1f}", f"{r['mins']:.0f}", r["kind"],
            r["surcharge"] or "", ", ".join(r["flags"])) for n, r in enumerate(top, 1)])
    print(f"\nSaved {run / 'stage1.json'}")


# ---------------- stage 2 ----------------
def detail(r, date, run):
    path = run / "detail" / f"{r['id']}.json"
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(fetch(f"{API}/recipes/{r['urn']}?numPortions={PORTIONS}&deliveryDate={date}&collectionId={ALL_RECIPES}"))
        time.sleep(0.7)
    return json.loads(path.read_text())


def watch(text):
    text = re.sub(r"\b(coconut|oat|soya|almond|rice) milk\b", "", text, flags=re.I)
    text = re.sub(r"\bsoya beans?\b", "soya", text, flags=re.I)
    hits = {g: [t for t in terms if has(t, text)] for g, terms in PREFS["bloatingWatchlist"]["groups"].items()}
    return {g: found for g, found in hits.items() if found}


def analyse(r, d):
    lines = [{"pantry": key == "notIncluded", "text": x["text"], "sub": clean(x.get("subIngredientsHTML"))}
             for key in ("included", "notIncluded") for x in d["ingredients"].get(key, [])]
    flagged, dropped = [], []
    for ln in lines:
        blob = f"{ln['text']} {ln['sub']}"
        dropped += [ln["text"] for t in DROP_TERMS if has(t, blob)]
        for t in (t for t in FLAG_TERMS if has(t, blob)):
            form = ("condiment-like" if CONDIMENT.search(ln["text"])
                    else "compound-mix" if len(ln["sub"]) > 120 or re.search(r"\(\d+g\) x \d", ln["text"])
                    else "whole-food line")
            flagged.append({"term": t, "line": ln["text"], "form": form, "pantry": ln["pantry"]})
    return {
        **{k: r[k] for k in ("id", "title", "kind", "mins", "surcharge", "image")},
        "nutrition": {NUTRITION[n["name"].strip()]: num(n["perServing"])
                      for n in d["nutrition"]["list"] if n["name"].strip() in NUTRITION},
        "spice": [t["text"] for t in d["tagGroups"].get("general", []) if t["type"].startswith("spice")],
        "flagged": flagged, "watchlist": watch(" ".join(f"{ln['text']} {ln['sub']}" for ln in lines)),
        "dropReason": f"hard drop: {', '.join(dropped)}" if dropped else None,
    }


def penalty(a):
    t = TARGETS

    def over(key, limit):
        return max(0, val(a, key) - limit) / limit

    p = W["satFat"] * over("sat", t["satFatG"]["ideal"]) + W["salt"] * over("salt", t["saltG"]["ideal"])
    p += W["saltOverAcceptable"] * (val(a, "salt") > t["saltG"]["acceptableOccasional"])
    p += W["protein"] * max(0, t["proteinG"]["min"] - val(a, "protein")) / t["proteinG"]["min"]
    p += W["fibre"] * max(0, t["fibreG"]["min"] - val(a, "fibre")) / t["fibreG"]["min"]
    p += W["sugar"] * over("sugar", t["sugarsG"]["ideal"])
    p += W["hot"] * any("hot" in s.lower() for s in a["spice"])
    p += (a["mins"] or 0) / 60 * W["speedStage2"]
    return round(p, 2)


def misses(a):
    t = TARGETS
    bad = {"sat": val(a, "sat") > t["satFatG"]["ideal"], "salt": val(a, "salt") > t["saltG"]["ideal"],
           "protein": val(a, "protein") < t["proteinG"]["min"], "fibre": val(a, "fibre") < t["fibreG"]["min"],
           "sugar": val(a, "sugar") > t["sugarsG"]["ideal"]}
    return [f"{k} {a['nutrition'].get(k)}" for k, b in bad.items() if b]


def pick_final(ranked, n):
    """Best n by penalty, with fish given a small bonus so nutrition decides unless it is a close call."""
    bonus = PREFS["variety"]["fishBonus"]
    best = sorted(ranked, key=lambda a: a["penalty"] - (bonus if a["kind"] == "fish" else 0))[:n]
    return sorted(best, key=lambda a: a["penalty"])


def stage2(date, run, verdict_file):
    top = json.loads((run / "stage1.json").read_text())
    verdicts = json.loads(Path(verdict_file).read_text()) if verdict_file else {}
    results = [analyse(r, detail(r, date, run)) for r in top]
    for a in results:
        a["penalty"], a["misses"] = penalty(a), misses(a)
        structural = [k for k, v in verdicts.get(a["title"], {}).items() if v == "structural"]
        a["excluded"] = a["dropReason"] or (f"structural: {', '.join(structural)}" if structural else None)
    ranked = sorted((a for a in results if not a["excluded"]), key=lambda a: a["penalty"])
    keep = ranked[:PREFS["shortlist"]["stage2"]]
    final = pick_final(keep, PREFS["shortlist"]["final"])
    out = [a for a in results if a["excluded"]]
    saved = {"top": keep, "final": [a["title"] for a in final], "excluded": out}
    (run / "stage2.json").write_text(json.dumps(saved, indent=1))
    images = run / "images"
    for a in (a for a in results if a["flagged"] and a["image"]):
        images.mkdir(exist_ok=True)
        if not (images / f"{a['id']}.jpg").exists():
            (images / f"{a['id']}.jpg").write_bytes(fetch(a["image"]))
    print(f"# Stage 2: {date} | {len(results)} analysed, {len(out)} excluded, top {len(keep)} shown\n")
    table(["#", "Recipe", "kcal", "Prot", "Sat", "Salt", "Fibre", "Sugar", "Heat", "Misses", "Flags", "Watchlist"],
          [(n, a["title"], *(a["nutrition"].get(k) for k in ("kcal", "protein", "sat", "salt", "fibre", "sugar")),
            ", ".join(a["spice"]), ", ".join(a["misses"]),
            "; ".join(f"{f['term']} ({f['line']}, {f['form']})" for f in a["flagged"]),
            "; ".join(f"{g}: {', '.join(v)}" for g, v in a["watchlist"].items())) for n, a in enumerate(keep, 1)])
    print("\n## Stage 3: proposed final 4 (before your own review)\n")
    table(["#", "Recipe", "Type", "Min", "Penalty", "Surcharge", "Misses"],
          [(n, a["title"], a["kind"], f"{a['mins']:.0f}", a["penalty"], a["surcharge"] or "", ", ".join(a["misses"]))
           for n, a in enumerate(final, 1)])
    fish = sum(a["kind"] == "fish" for a in final)
    print(f"\nMix: {fish} fish, {len(final) - fish} other (nutrition decides; fish only wins close calls)")
    for a in out:
        print(f"Excluded: {a['title']} ({a['excluded']})")
    print(f"\nSaved {run / 'stage2.json'}" + (f"; photos of flagged recipes in {images}" if images.exists() else ""))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("stage", choices=["stage1", "stage2"])
    ap.add_argument("--date", required=True, help="delivery date, YYYY-MM-DD (a Monday)")
    ap.add_argument("--verdicts", help="JSON {title: {term: separable|structural|unclear}}")
    args = ap.parse_args()
    run_dir = DATA / "runs" / args.date
    stage1(args.date, run_dir) if args.stage == "stage1" else stage2(args.date, run_dir, args.verdicts)
