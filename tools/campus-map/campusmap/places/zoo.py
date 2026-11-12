"""Kanan Pendari Zoo on the Mungeli road (NH130A): the gate and ticket booths, a loop of dirt
paths through the forest, fenced enclosures for tigers, spotted deer, sloth bears, crocodiles,
hippos and monkeys, and the boating lake."""
from . import Builder, Plan, circle


def plan():
    b = Builder()
    W, H = 120, 96
    b.line("road", (0, 3.5), (120, 3.5), width=3, name="NH130A")
    b.rect("asphalt", 30, 7, 50, 13, sub="parking")
    b.rect("paver", 52, 7, 64, 14)
    # loop of paths
    b.line("trail", (58, 14), (58, 30), width=2)
    b.line("trail", (20, 30), (98, 30), (98, 82), (20, 82), (20, 30), width=2)
    b.line("trail", (58, 30), (58, 82), width=2)
    b.line("trail", (98, 56), (104, 56), width=2)
    # enclosures: (fence box, gap on the path side, ground, animals)
    b.fence_rect(4, 33, 17, 50)
    b.fence_rect(23, 33, 55, 54)
    b.fence_rect(61, 33, 95, 50)
    b.add("dirt", [(62, 34), (94, 34), (94, 49), (62, 49), (62, 34)])
    b.fence_rect(23, 58, 55, 79)
    b.add("sand", circle(39, 68, 10))
    b.add("water", circle(39, 68, 7))
    b.fence_rect(61, 56, 95, 79)
    b.add("water", [(66, 60), (90, 60), (92, 72), (68, 75), (66, 60)])
    b.fence_rect(101, 34, 116, 52)
    # boating lake and the canteen
    b.add("water", [(104, 62), (118, 60), (119, 92), (102, 93), (104, 62)])
    b.rect("building", 30, 86, 42, 92, name="Zoo Canteen", style="b", template="canteen", storeys=1)
    b.line("trail", (36, 82), (36, 86), width=2)
    props = [("tiger", 7, 38), ("tiger", 11, 44), ("rock", 12, 36),
             ("deer", 27, 36), ("deer", 34, 40), ("deer", 44, 37), ("deer", 30, 46), ("deer", 48, 45), ("peacock", 40, 47),
             ("bear", 66, 37), ("bear", 82, 43), ("rock", 74, 38), ("rock", 88, 36),
             ("crocodile", 30, 61), ("crocodile", 44, 74), ("crocodile", 36, 67),
             ("hippo", 74, 64), ("hippo", 82, 68),
             ("monkey", 104, 38), ("monkey", 110, 44), ("monkey", 106, 48), ("peacock", 112, 36),
             ("boat", 108, 70), ("boat", 110, 80),
             ("ticket-booth", 52, 9), ("ticket-booth", 62, 9), ("stall-toys", 66, 14), ("tea-stall", 46, 15)]
    signs = [("sign:zoo-tigers", "Tigers", 15, 30, 3), ("sign:zoo-deer", "Spotted Deer", 34, 30, 3),
             ("sign:zoo-bears", "Sloth Bears", 72, 30, 3), ("sign:zoo-crocs", "Crocodiles", 34, 80, 3),
             ("sign:zoo-hippos", "Hippos", 72, 80, 3), ("sign:zoo-monkeys", "Monkeys", 104, 53, 3),
             ("sign:zoo-lake", "Boating", 100, 82, 3)]
    gate = ("gate-arch-zoo", 54, 12, 8, "KANAN PENDARI ZOO")
    return Plan("kanan-pendari-zoo", "Kanan Pendari Zoo", W, H, b.features, spawn=(58, 17), filler="forest",
                props=props, signs=signs, gate=gate, seed=7)
