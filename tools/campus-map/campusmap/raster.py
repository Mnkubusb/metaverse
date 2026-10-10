"""Cell grid and rasterization of tile-space polygons / polylines."""
import math


class Grid:
    def __init__(self, width, height, fill="grass"):
        self.width, self.height = width, height
        self.cells = [[fill] * width for _ in range(height)]

    def inside(self, x, y):
        return 0 <= x < self.width and 0 <= y < self.height

    def get(self, x, y):
        return self.cells[y][x] if self.inside(x, y) else None

    def set(self, x, y, v):
        if self.inside(x, y):
            self.cells[y][x] = v

    def find(self, kind):
        return [(x, y) for y in range(self.height) for x in range(self.width) if self.cells[y][x] == kind]


def bbox_of(points):
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return math.floor(min(xs)), math.floor(min(ys)), math.floor(max(xs)), math.floor(max(ys))


def _inside(px, py, points):
    """Even-odd rule for point (px, py) against a closed polygon."""
    inside = False
    n = len(points)
    for i in range(n - 1):
        (x0, y0), (x1, y1) = points[i], points[i + 1]
        if (y0 > py) != (y1 > py):
            xi = x0 + (py - y0) * (x1 - x0) / (y1 - y0)
            if px < xi:
                inside = not inside
    return inside


def fill_polygon(grid, points, value):
    if points[0] != points[-1]:
        points = list(points) + [points[0]]
    x0, y0, x1, y1 = bbox_of(points)
    for y in range(max(y0, 0), min(y1, grid.height - 1) + 1):
        for x in range(max(x0, 0), min(x1, grid.width - 1) + 1):
            if _inside(x + 0.5, y + 0.5, points):
                grid.set(x, y, value)


def _dist_to_segment(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    if dx == dy == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def stroke_polyline(grid, points, width, value):
    r = width / 2
    for i in range(len(points) - 1):
        (ax, ay), (bx, by) = points[i], points[i + 1]
        x0, y0, x1, y1 = bbox_of([(ax - r, ay - r), (bx + r, by + r)])
        for y in range(max(y0, 0), min(y1, grid.height - 1) + 1):
            for x in range(max(x0, 0), min(x1, grid.width - 1) + 1):
                if _dist_to_segment(x + 0.5, y + 0.5, ax, ay, bx, by) < r:
                    grid.set(x, y, value)


def _simplify(points, tol):
    """Douglas-Peucker: drop points that deviate less than `tol` from the chord."""
    if len(points) < 3:
        return list(points)
    (ax, ay), (bx, by) = points[0], points[-1]
    far_i, far_d = 0, -1.0
    for i in range(1, len(points) - 1):
        d = _dist_to_segment(points[i][0], points[i][1], ax, ay, bx, by)
        if d > far_d:
            far_i, far_d = i, d
    if far_d <= tol:
        return [points[0], points[-1]]
    left = _simplify(points[: far_i + 1], tol)
    right = _simplify(points[far_i:], tol)
    return left[:-1] + right


STEP = 16  # longest L leg; longer diagonals become a few big steps


def orthogonalize(points, tol=2.0, step=STEP):
    """Route a polyline as axis-aligned legs. Each simplified segment becomes one or
    more L steps (longer axis first), so a diagonal stays within ~step/2 of the real
    line without turning into a fine staircase. Endpoints are kept exactly."""
    pts = _simplify(list(points), tol)
    out = [pts[0]]
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        if ax == bx or ay == by:
            out.append((bx, by))
            continue
        n = max(1, math.ceil(max(abs(bx - ax), abs(by - ay)) / step))
        for i in range(1, n + 1):
            px, py = out[-1]
            qx, qy = ax + (bx - ax) * i / n, ay + (by - ay) * i / n
            corner = (qx, py) if abs(bx - ax) >= abs(by - ay) else (px, qy)
            out.append(corner)
            out.append((qx, qy))
    return out


def _centre(v):
    return math.floor(v) + 0.5


def snap45(points, tol=2.0):
    """Route a polyline as 45°/90° legs through tile centres: each simplified segment
    becomes a diagonal leg (as long as the shorter axis allows) then a straight leg.
    Diagonals at exactly 45° through tile centres repeat the same tile pattern, so the
    rendered road slices into a handful of distinct tiles."""
    pts = [(_centre(x), _centre(y)) for x, y in _simplify(list(points), tol)]
    out = [pts[0]]
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        dx, dy = bx - ax, by - ay
        d = min(abs(dx), abs(dy))
        if d > 0 and (abs(dx) != abs(dy)):
            mid = (ax + math.copysign(d, dx), ay + math.copysign(d, dy))
            if mid != out[-1]:
                out.append(mid)
        if (bx, by) != out[-1]:
            out.append((bx, by))
    return out
