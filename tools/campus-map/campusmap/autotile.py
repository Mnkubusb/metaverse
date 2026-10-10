"""Pick a tile variant from a cell's 4-neighbourhood within its region."""


def _n4(same, x, y):
    return same(x, y - 1), same(x + 1, y), same(x, y + 1), same(x - 1, y)  # up, right, down, left


def road_variant(same, x, y):
    u, r, d, l = _n4(same, x, y)
    if u and d and not (l or r):
        return "road-v"
    if l and r and not (u or d):
        return "road-h"
    if u and d and l and r:
        # a genuine crossing has open corners; a wide road's interior does not
        if not any(same(x + dx, y + dy) for dx in (-1, 1) for dy in (-1, 1)):
            return "road-x"
    return "road-plain"


def ring_variant(same, x, y):
    u, r, d, l = _n4(same, x, y)
    if not d:
        if not l:
            return "corner-bl"
        if not r:
            return "corner-br"
        return "bottom"
    if not u:
        if not l:
            return "corner-tl"
        if not r:
            return "corner-tr"
        return "top"
    if not l:
        return "left"
    if not r:
        return "right"
    return "inner"
