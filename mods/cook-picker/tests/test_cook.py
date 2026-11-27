import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("cook", Path(__file__).resolve().parent.parent / "skills/cook-picker/scripts/cook.py")
cook = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cook)


def nut(size_hdr, kcal, protein):
    hdr = f"<h6>serves {size_hdr}</h6>" if size_hdr else ""
    return (hdr + f'<table><td id="C_energyCalPortion">{kcal}</td><td id="C_proteinPortion">{protein}</td>'
            '<td id="C_saturatesPortion">2</td><td id="C_saltPortion">1.5</td><td id="C_fibrePortion">8</td></table>')


def page(nutrition, ingredients):
    return ('<div class="accordion_item" id="tab3"><h3><a href="../#">Nutrition</a></h3>' + nutrition +
            '</div><div class="accordion_item" id="tab4"><h3><a href="../#">Ingredients</a></h3>' + ingredients + '</div>')


class Parse(unittest.TestCase):
    def test_multi_size(self):
        d = cook.parse_product(page(nut(1, "1,200", 30) + nut(2, 600, 35),
                                    '<h6>serves 1</h6><p class="ingredients">Chicken, Ham</p><h6>serves 2</h6><p class="ingredients">Chicken</p>'))
        self.assertEqual(d["nutrition"][1]["kcal"], 1200)
        self.assertEqual(d["nutrition"][2]["protein"], 35)
        self.assertEqual(d["ingredients"][1], "Chicken, Ham")

    def test_single_size_has_no_headings(self):
        d = cook.parse_product(page(nut(None, 500, 31), '<p class="ingredients">Lamb, <strong>[Milk]</strong></p>'))
        self.assertEqual(cook.for_size(d["nutrition"], 1)["protein"], 31)
        self.assertEqual(cook.for_size(d["ingredients"], 2), "Lamb, [Milk]")

    def test_category_json(self):
        html = 'x["category_7_available_products"] = {"productSections":[{"productId":3,"title":"A"},{"title":"banner"}]};\r\n'
        self.assertEqual([p["productId"] for p in cook.category_products(html)], [3])


class Plan(unittest.TestCase):
    def test_two_singles_offered_alongside_serves_two(self):
        it = {"packs": {1: {"price": 6.5, "buyable": True}, 2: {"price": 11, "buyable": True}}}
        self.assertEqual([o[1] for o in cook.pack_options(it)], ["1 x Serves 2", "2 x Serves 1"])

    def test_large_only_is_skipped(self):
        self.assertEqual(cook.pack_options({"packs": {4: {"price": 20, "buyable": True}}}), [])

    def test_penalty_zero_when_targets_met(self):
        r = {"n": {"kcal": 500, "protein": 35, "sat": 2, "salt": 1.5, "fibre": 8, "sugar": 5}, "chilli": 0}
        self.assertEqual(cook.penalty(r), 0)


class Sides(unittest.TestCase):
    def side(self, title):
        return {"title": title, "cuisine": cook.side_cuisine(title)}

    def test_rice_not_added_to_biryani(self):
        self.assertFalse(cook.fits(self.side("Plain Basmati Rice"), {"title": "Chicken Biryani", "cuisine": "indian"}))

    def test_rice_with_curry_not_hotpot(self):
        self.assertTrue(cook.fits(self.side("Plain Basmati Rice"), {"title": "Chicken Balti", "cuisine": "indian"}))
        self.assertFalse(cook.fits(self.side("Plain Basmati Rice"), {"title": "Beef Stew", "cuisine": None}))

    def test_naan_only_with_indian(self):
        self.assertFalse(cook.fits(self.side("Plain Naan"), {"title": "Beef Bourguignon", "cuisine": None}))

    def test_greens_with_british_not_thai(self):
        self.assertTrue(cook.fits(self.side("Trio of Greens"), {"title": "Lamb Casserole", "cuisine": None}))
        self.assertFalse(cook.fits(self.side("Trio of Greens"), {"title": "Green Thai Curry", "cuisine": "asian"}))

    def test_pairing_only_when_it_helps(self):
        main = {"title": "Lamb Casserole", "cuisine": None, "chilli": 0, "ingredients": "", "pricePP": 6,
                "n": {"kcal": 300, "protein": 32, "sat": 2, "salt": 1.5, "fibre": 4, "sugar": 3}}
        good = {"title": "Trio of Greens", "cuisine": set(), "how": "", "pricePP": 2, "url": "", "ingredients": "",
                "n": {"kcal": 60, "protein": 3, "sat": 0.2, "salt": 0.1, "fibre": 4, "sugar": 2}}
        full = {**main, "n": {**main["n"], "fibre": 8}}
        for r in (main, full):
            r["penalty"] = cook.penalty(r)
        cook.pair_sides([main, full], [good])
        self.assertEqual(main["side"]["title"], "Trio of Greens")
        self.assertIsNone(full["side"])


if __name__ == "__main__":
    unittest.main()
