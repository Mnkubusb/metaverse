"""Arpa Riverfront, Bilaspur: the river between the Old Sarkanda bridge (west) and the Rapta
bridge (east), the paved riverfront promenade on the south bank with its ghat, and the dense
old-city blocks on both sides."""
from . import Builder, Plan


def plan():
    b = Builder()
    W, H = 120, 84
    # sand banks under the river, then the river itself
    b.add("sand", [(0, 20), (40, 18), (82, 26), (120, 38), (120, 70), (82, 60), (40, 51), (0, 53), (0, 20)])
    b.add("water", [(0, 25), (40, 23), (82, 31), (120, 43), (120, 63), (82, 53), (40, 45), (0, 47), (0, 25)])
    # south bank promenade between the sand and the riverfront road
    b.add("paver", [(0, 53), (40, 51), (82, 60), (120, 70), (120, 72), (82, 62), (40, 53.6), (0, 55.6), (0, 53)])
    # the ghat: wide steps running down into the water below the Rapta bridge
    b.add("paver", [(60, 50), (76, 54), (76, 60), (60, 56), (60, 50)])
    b.line("road", (0, 58.5), (40, 56.5), (82, 65.5), (120, 75.5), width=3, name="Riverfront Road")
    b.line("road", (0, 15.5), (40, 13.5), (82, 21.5), (120, 33.5), width=2)
    # bridges: Old Sarkanda (north-south) and the Rapta causeway (diagonal)
    b.line("road", (18.5, 0), (18.5, 84), width=3, name="Old Sarkanda Bridge")
    b.line("road", (106.5, 22), (90.5, 84), width=2, name="Rapta Bridge")
    # riverside park and the cafe south of the road
    b.rect("lawn", 44, 62, 58, 72)
    b.rect("building", 30, 64, 40, 70, name="Riverfront Cafe", style="b", template="canteen", storeys=1)
    b.rect("building", 66, 70, 74, 76, name="Ghat Mandir", style="d", template="temple", storeys=1)

    props = [("boat", 30, 33), ("boat", 52, 36), ("boat", 72, 44), ("boat", 96, 50), ("boat", 8, 38),
             ("statue", 63, 52), ("led-screen", 70, 50),
             ("stall-chaat", 36, 49), ("stall-toys", 46, 50), ("tea-stall", 84, 59),
             ("cow", 10, 50), ("cow", 100, 64), ("auto", 26, 57), ("auto", 70, 63),
             ("shikhara-small", 69, 67)]
    for x in range(4, 116, 9):
        y = 52 if x < 40 else int(52 + (x - 40) * 9 / 42) if x < 82 else int(61 + (x - 82) * 10 / 38)
        if not 58 <= x <= 78 and not 34 <= x <= 50:
            props.append(("lamp-post", x, y - 1))
    for x in (6, 24, 88, 104):
        y = 53 if x < 40 else int(61 + (x - 82) * 10 / 38)
        props.append(("bench", x + 2, y))
    return Plan("arpa-riverfront", "Arpa Riverfront", W, H, b.features, spawn=(54, 54), filler="houses",
                props=props, signs=[("sign:arpa-riverfront", "Arpa Riverfront", 56, 55, 4)], seed=11)
