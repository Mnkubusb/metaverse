"""Bilaspur Junction (BSP), zonal headquarters of the South East Central Railway: the station
building and circulating area on the north side, six tracks, three platforms joined by two foot
over-bridges, trains waiting at the platforms."""
from . import Builder, Plan

TRACKS = (31.5, 34.5, 42.5, 45.5, 53.5, 56.5)


def plan():
    b = Builder()
    W, H = 130, 80
    b.line("road", (0, 3.5), (130, 3.5), width=3, name="Station Road")
    b.rect("asphalt", 40, 7, 88, 12, sub="parking")
    b.rect("paver", 38, 12, 90, 14)
    b.rect("building", 44, 14, 84, 25, name="Bilaspur Junction", style="b", template="station", storeys=1)
    # platforms between the tracks
    b.rect("platform", 8, 26, 122, 30.6)
    b.rect("platform", 12, 35.4, 118, 41.6)
    b.rect("platform", 14, 46.4, 116, 52.6)
    for y in TRACKS:
        b.line("rail", (0, y), (W, y))
    # foot over-bridges from platform 1 to the south platform
    for x in (30.5, 98.5):
        b.line("fob", (x, 27), (x, 52))
    props = [("train-engine", 14, 42), ("train-coach", 19, 42), ("train-coach", 26, 42), ("train-coach", 33, 42),
             ("train-coach", 40, 42), ("train-coach", 47, 42), ("train-coach-red", 54, 42),
             ("train-coach-red", 70, 53), ("train-coach-red", 77, 53), ("train-coach-red", 84, 53), ("train-engine", 91, 53),
             ("tea-stall", 60, 37), ("ticket-booth", 106, 26)]
    for y, (x0, x1) in ((27, (36, 94)), (37, (36, 94)), (48, (36, 94))):
        for x in range(x0, x1, 4):
            props.append(("canopy", x, y))
    for y, xs in ((29, (12, 22, 104, 114)), (40, (16, 24, 104, 112)), (51, (18, 24, 104, 110))):
        for x in xs:
            props.append(("platform-bench", x, y))
    for x in range(0, 130, 13):
        props.append(("auto" if x % 2 else "scooter-red", x + 2, 6))
    signs = [("board:bsp-1", "BILASPUR JN.", 18, 26, 4), ("board:bsp-2", "BILASPUR JN.", 22, 36, 4),
             ("board:bsp-3", "BILASPUR JN.", 22, 47, 4), ("sign:bsp-welcome", "Welcome to Bilaspur", 58, 12, 4)]
    return Plan("bilaspur-junction", "Bilaspur Junction Railway Station", W, H, b.features, spawn=(64, 27),
                filler="houses", props=props, signs=signs, seed=5)
