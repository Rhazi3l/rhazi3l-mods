"""Offline checks for the gousto-picker script. Run: python3 -I mods/gousto-picker/tests/test_gousto.py"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "skills/gousto-picker/scripts"))
import gousto as g  # noqa: E402


class Terms(unittest.TestCase):
    def test_apple_not_pineapple(self):
        self.assertFalse(g.has("apple", "pineapple salsa"))
        self.assertTrue(g.has("apple", "grated apple"))

    def test_pulse_beans_only(self):
        self.assertTrue(g.has("pulse beans", "Black beans (200g)"))
        for t in ("fine green beans", "soya bean, wheat", "runner beans", "French beans"):
            self.assertFalse(g.has("pulse beans", t), t)

    def test_red_wine_not_rice_wine(self):
        self.assertTrue(g.has("red wine", "Red wine paste"))
        self.assertTrue(g.has("red wine", "red wine vinegar"))
        self.assertFalse(g.has("red wine", "rice wine vinegar"))

    def test_plurals_and_basics(self):
        for t, x in (("prawn", "king prawns"), ("chickpea", "chickpeas"), ("balsamic", "Balsamic vinegar"),
                     ("feta", "Feta (30g)"), ("cucumber", "Cucumber (0.5pcs)")):
            self.assertTrue(g.has(t, x), t)


class Watch(unittest.TestCase):
    def test_soy_sauce_is_not_bean(self):
        self.assertNotIn("bean", g.watch("soy sauce soya bean wheat").get("galactans", []))

    def test_plant_milks_not_lactose(self):
        self.assertNotIn("lactose", g.watch("coconut milk, oat milk"))

    def test_real_milk(self):
        self.assertIn("lactose", g.watch("whole milk"))

    def test_pea_not_pepper_or_peanut(self):
        self.assertNotIn("galactans", g.watch("pepper peanut"))


class Kinds(unittest.TestCase):
    def test_types(self):
        for t, k in (("Chicken, Bacon & Red Wine Chasseur", "chicken"), ("Bacon Wrapped Cod With Asparagus", "fish"),
                     ("Honey & Stout Glazed Gammon", "pork"), ("Classic Kedgeree", "fish"), ("Beef Bourguignon", "beef"),
                     ("Mushroom Risotto", "other"), ("Sea Bass With Potatoes", "fish"), ("Bacon Mac", "pork")):
            self.assertEqual(g.protein_type(t), k, t)


def dish(title, kind, pen):
    return {"title": title, "kind": kind, "penalty": pen}


class Picking(unittest.TestCase):
    def test_close_call_favours_fish(self):
        keep = [dish("Basa", "fish", 1.0), dish("Chicken", "chicken", 0.9), dish("Beef", "beef", 1.2)]
        self.assertIn("Basa", [a["title"] for a in g.pick_final(keep, 2)])

    def test_nutrition_beats_fish(self):
        keep = [dish("Cod", "fish", 3.0), dish("Chicken", "chicken", 0.5), dish("Beef", "beef", 0.6), dish("Pork", "pork", 0.7)]
        self.assertEqual(sum(a["kind"] == "fish" for a in g.pick_final(keep, 3)), 0)

    def test_same_species_allowed(self):
        keep = [dish(f"Basa {c}", "fish", 1 + i / 10) for i, c in enumerate("ABC")] + [dish("Chicken", "chicken", 1.3)]
        self.assertEqual(sum(a["kind"] == "fish" for a in g.pick_final(keep, 3)), 3)

    def test_fewer_candidates_than_n(self):
        self.assertEqual(len(g.pick_final([dish("Cod", "fish", 1)], 4)), 1)
        self.assertEqual(g.pick_final([], 4), [])


class Penalty(unittest.TestCase):
    base = {"nutrition": {"sat": 1, "salt": 1, "protein": 35, "fibre": 8, "sugar": 5}, "spice": [], "mins": 10}

    def test_faster_scores_better(self):
        self.assertLess(g.penalty({**self.base, "mins": 10}), g.penalty({**self.base, "mins": 50}))

    def test_hot_adds(self):
        self.assertGreater(g.penalty({**self.base, "spice": ["Hot"]}), g.penalty(self.base))

    def test_missing_data_does_not_crash(self):
        g.penalty({"nutrition": {}, "spice": [], "mins": None})

    def test_misses_lists_failures(self):
        a = {"nutrition": {"sat": 5, "salt": 1, "protein": 25, "fibre": 8, "sugar": 5}}
        self.assertEqual(g.misses(a), ["sat 5", "protein 25"])


if __name__ == "__main__":
    unittest.main()
