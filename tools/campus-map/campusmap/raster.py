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
