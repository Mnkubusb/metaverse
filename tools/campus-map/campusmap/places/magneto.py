"""Magneto The Mall, Bilaspur: the mall on Shrikant Verma Marg beside the lake, with shops and
a food court on the ground floor and the multiplex on the first floor (watch parties play on
its screen), its forecourt and parking."""
from . import Builder, Plan


def plan():
    b = Builder()
    W, H = 100, 76
    b.add("sand", [(0, 14), (31, 14), (38, 30), (36, 76), (0, 76), (0, 14)])
    b.add("water", [(0, 17), (29, 17), (34, 30), (32, 76), (0, 76), (0, 17)])
    b.line("road", (0, 10.5), (48, 13.5), (92, 17.5), width=2, name="Lake Road")
    b.line("road", (92.5, 17), (92.5, 76), width=3, name="Shrikant Verma Marg")
    b.line("road", (92.5, 18), (100, 8), width=3)
    b.rect("building", 44, 22, 84, 44, name="Magneto Mall", style="d", template="mall>cinema", storeys=2)
    b.rect("paver", 40, 44, 88, 50)
    b.rect("asphalt", 46, 52, 86, 64, sub="parking")
    b.line("trail", (38, 48), (38, 74), width=2, sub="paved")
    props = [("fountain", 48, 45), ("fountain", 76, 45), ("marigold", 44, 44), ("marigold", 86, 44),
             ("tea-stall", 40, 66), ("auto", 88, 48), ("auto", 88, 60), ("boat", 14, 40), ("boat", 20, 56)]
    for x in range(42, 88, 8):
        props.append(("lamp-post", x, 48))
    return Plan("magneto-mall", "Magneto Mall", W, H, b.features, spawn=(62, 47), filler="houses",
                props=props, signs=[("sign:magneto", "Magneto The Mall", 58, 50, 4)], seed=9)
