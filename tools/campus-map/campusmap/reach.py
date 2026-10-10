"""Movement blocking (mirrors apps/ws/src/SpaceGrid.ts) and BFS reachability."""
from collections import deque


def blocked_tiles(lay, area="main"):
    """Blocked tiles of one area (placements carry an `area`; the outdoors is "main")."""
    blocked = set()
    for p in lay.placements:
        if getattr(p, "area", "main") != area:
            continue
        e = lay.elements[p.key]
        if not e.static:
            continue
        if e.layer == "wall":
            rows = range(p.y, p.y + e.height)
        elif e.layer == "objects":
            rows = range(p.y + e.height - 1, p.y + e.height)
        else:
            continue
        for y in rows:
            for x in range(p.x, p.x + e.width):
                blocked.add((x, y))
    return blocked


def _flood(lay, area="main"):
    blocked = blocked_tiles(lay, area)
    seen = set()
    if lay.spawn in blocked:
        return seen
    q = deque([lay.spawn])
    seen.add(lay.spawn)
    while q:
        x, y = q.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < lay.width and 0 <= ny < lay.height and (nx, ny) not in blocked and (nx, ny) not in seen:
                seen.add((nx, ny))
                q.append((nx, ny))
    return seen


def reachable_count(lay):
    return len(_flood(lay))


def unreachable_doors(lay):
    seen = _flood(lay)
    return [name for (name, dx, dy) in lay.doors if (dx, dy + 2) not in seen]
