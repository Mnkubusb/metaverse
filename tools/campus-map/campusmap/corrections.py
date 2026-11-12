"""Hand corrections to the OSM campus, checked against Esri World Imagery (z18, 2025).

OSM traces each building as one outline, so the generator used to draw buildings with
courtyards (the CS/IT block, Amarkantak hostel) as solid slabs, and it paved the tree-filled
quadrangles of the academic block. These tables fix that, and give every building the roof
colour it has from the air (the academic block is whitewashed, the older blocks and hostels
have dark roofs).
"""

# Roof style per building (sign name): a sandstone, b red tile, c dark grey, d white.
ROOF = {
    "CS/IT Block": "c",
    "Canteen": "b",
    "Main Building": "d",
    "Visvesvaraya Hall": "d",
    "Electrical Dept": "d",
    "Civil Dept": "c",
    "Electronics Dept": "c",
    "CS/IT Annexe": "d",
    "Mechanical Dept": "d",
    "Workshop": "c",
    "Mining Dept": "d",
    "Amarkantak Hostel": "c",
    "SVNS Hostel": "b",
    "Panchsheel Hostel": "c",
}
DEFAULT_ROOF = "d"

# Open courtyards traced from the imagery: (north, west, south, east) in degrees.
COURTYARDS = {
    "CS/IT Block": [
        (22.137413, 82.1287347, 22.1372739, 82.1289761),
        (22.1370255, 82.1286543, 22.1368168, 82.1288152),
        (22.1370304, 82.1288796, 22.1368019, 82.1290834),
    ],
}

# Buildings that are a ring of rooms around one courtyard: wing depth in tiles (3 m each).
RING_DEPTH = {"Amarkantak Hostel": 3}

# Named campus areas that are planted quadrangles, not paving.
QUADS = {"Civil Ground", "Electrical Quad", "Outdoor Gym"}

# Storeys per building (ground, first and second floor); interiors get one area per floor
# joined by a stairwell.
FLOORS = {name: 3 for name in ROOF if name not in ("Canteen", "Workshop")}
