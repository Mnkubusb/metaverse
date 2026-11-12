"""Maa Mahamaya Temple, Ratanpur (11th century, Kalachuri): the temple compound with its
nagara spire, the round kund beside it, the covered queue walkway along the kund, the mela
ground with prasad stalls, the Ambikapur highway and the paddy fields to the south-west."""
from . import Builder, Plan, circle


def plan():
    b = Builder()
    W, H = 112, 84
    b.line("road", (0, 55.5), (112, 55.5), width=3, name="Bilaspur-Ambikapur Road")
    b.line("road", (88.5, 0), (88.5, 55), width=2)
    # temple compound: paved courtyard, compound wall with a south and an east gate
    b.rect("paver", 12, 10, 40, 40)
    b.fence_rect(11.5, 9.5, 40.5, 40.5, gaps=[("s", 23, 29), ("e", 26, 32)])
    b.rect("building", 20, 16, 32, 26, name="Mahamaya Mandir", style="d", template="temple", storeys=1)
    b.add("water", [(2, 4), (9, 4), (9, 16), (2, 16), (2, 4)])
    # the kund with its stepped ghat ring
    b.add("sand", circle(60, 26, 13))
    b.add("water", circle(60, 26, 10.5))
    # covered queue walkway south of the kund, joined to the temple's south gate
    b.line("trail", (26, 41), (26, 45.5), (82, 45.5), width=2, sub="paved")
    b.line("trail", (41, 29), (46, 29), width=2, sub="paved")
    # mela ground
    b.add("dirt", [(92, 4), (110, 4), (110, 48), (92, 48), (92, 4)])
    # fields south of the highway
    for x0 in (2, 18, 34):
        b.rect("field", x0, 60, x0 + 14, 82)
    props = [("shikhara", 24, 14), ("shikhara-small", 20, 15), ("shikhara-small", 29, 15), ("bell-arch", 25, 38), ("marigold", 22, 39), ("marigold", 30, 39),
             ("marigold", 14, 12), ("marigold", 37, 12), ("tree-b", 14, 28), ("tree-a", 37, 18), ("tree-a", 14, 18),
             ("tree-b", 37, 30), ("lamp-post", 17, 33), ("lamp-post", 34, 33), ("bench", 15, 36), ("bench", 33, 36),
             ("bell-arch", 25, 28)]
    for x in range(28, 80, 4):
        props.append(("canopy-red", x, 44))
    for k, y in enumerate(range(6, 44, 5)):
        props.append(("stall-prasad" if k % 2 == 0 else "stall-toys", 93, y))
        props.append(("stall-chaat" if k % 3 == 0 else "stall-prasad", 104, y))
    props += [("cow", 98, 20), ("cow", 80, 50), ("auto", 60, 54), ("scooter-blue", 99, 34), ("scooter-red", 100, 35),
              ("tea-stall", 74, 40)]
    signs = [("sign:mahamaya-welcome", "Maa Mahamaya Mandir", 30, 46, 4)]
    return Plan("ratanpur-mahamaya", "Ratanpur Mahamaya Temple", W, H, b.features, spawn=(40, 46),
                filler="houses", props=props, signs=signs, seed=3)
