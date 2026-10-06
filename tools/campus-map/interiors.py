"""
Building interiors for the campus map: sprites for walls, floors and furniture, plus the room
templates that lay them out. Imported by generate.py, which owns the element catalogue and
the placement list.

Every interior is its own "area" (see the `areas` column): a small map with its own walkable
grid. Doors are placements with a target area/tile; stepping on one moves the player there.
"""
import random

from PIL import Image, ImageDraw

T = 32
OUTLINE = (52, 44, 58)
WHITE = (250, 250, 246)
rng = random.Random(9)


def new(w_tiles, h_tiles, fill=(0, 0, 0, 0)):
    im = Image.new("RGBA", (w_tiles * T, h_tiles * T), fill)
    return im, ImageDraw.Draw(im)


def shade(c, k):
    return tuple(max(0, min(255, v + k)) for v in c[:3])


def speckle(d, box, base, amount=0.08, spread=8):
    x0, y0, x1, y1 = box
    for _ in range(int((x1 - x0) * (y1 - y0) * amount)):
        x = rng.randrange(x0, x1)
        y = rng.randrange(y0, y1)
        d.point((x, y), shade(base, rng.randint(-spread, spread)))


# --------------------------------------------------------------------------- floors

def floor_wood():
    im, d = new(1, 1, (196, 150, 96, 255))
    for row in range(4):
        y = row * 8
        d.line((0, y, 31, y), fill=(160, 116, 70))
        off = (row * 11) % 32
        d.line((off, y, off, y + 7), fill=(160, 116, 70))
        d.line((0, y + 4, 31, y + 4), fill=(206, 162, 108))
    speckle(d, (0, 0, 32, 32), (196, 150, 96), 0.05, 10)
    return im


def floor_tile(a=(226, 226, 220), b=(206, 208, 204)):
    im, d = new(1, 1, a + (255,))
    d.rectangle((16, 0, 31, 15), fill=b)
    d.rectangle((0, 16, 15, 31), fill=b)
    d.line((0, 0, 31, 0), fill=(180, 182, 178))
    d.line((0, 0, 0, 31), fill=(180, 182, 178))
    d.line((16, 0, 16, 31), fill=(190, 192, 188))
    d.line((0, 16, 31, 16), fill=(190, 192, 188))
    return im


def floor_carpet(c=(150, 48, 56)):
    im, d = new(1, 1, c + (255,))
    speckle(d, (0, 0, 32, 32), c, 0.25, 12)
    for x in range(0, 32, 8):
        d.point((x, 4), fill=shade(c, 30))
        d.point((x + 4, 12), fill=shade(c, 30))
    return im


def floor_concrete():
    im, d = new(1, 1, (176, 176, 170, 255))
    speckle(d, (0, 0, 32, 32), (176, 176, 170), 0.2, 9)
    d.line((0, 31, 31, 31), fill=(150, 150, 146))
    d.line((31, 0, 31, 31), fill=(150, 150, 146))
    return im


def floor_stage():
    im, d = new(1, 1, (112, 70, 44, 255))
    for y in range(0, 32, 8):
        d.line((0, y, 31, y), fill=(90, 54, 34))
    return im


def door_mat(kind):
    """Walk onto it to go through a door. 'in' lies outside a building, 'out' inside one."""
    im, d = new(1, 1)
    if kind == "in":
        d.rectangle((3, 8, 28, 29), fill=(120, 60, 50), outline=OUTLINE)
        d.rectangle((6, 11, 25, 26), fill=(160, 84, 70))
        for y in range(13, 26, 4):
            d.line((8, y, 23, y), fill=(140, 70, 60))
        d.polygon([(16, 12), (11, 18), (14, 18), (14, 24), (18, 24), (18, 18), (21, 18)], fill=(255, 228, 160))
    else:
        d.rectangle((2, 2, 29, 29), fill=(60, 140, 90), outline=OUTLINE)
        d.rectangle((5, 5, 26, 26), fill=(84, 176, 118))
        d.polygon([(16, 25), (10, 18), (14, 18), (14, 8), (18, 8), (18, 18), (22, 18)], fill=WHITE)
    return im


# --------------------------------------------------------------------------- walls

def wall_back(paint=(226, 222, 206)):
    """Back wall seen face-on: two tiles tall, plaster above a wooden dado."""
    im, d = new(1, 2)
    d.rectangle((0, 0, 31, 63), fill=paint)
    d.rectangle((0, 0, 31, 6), fill=shade(paint, -60))
    d.line((0, 7, 31, 7), fill=OUTLINE)
    d.rectangle((0, 44, 31, 63), fill=(150, 104, 66))
    d.line((0, 44, 31, 44), fill=(110, 72, 44))
    d.line((0, 47, 31, 47), fill=(180, 130, 86))
    for x in range(0, 32, 8):
        d.line((x, 48, x, 63), fill=(130, 88, 54))
    speckle(d, (0, 8, 32, 44), paint, 0.04, 6)
    return im


def wall_side():
    im, d = new(1, 1)
    d.rectangle((10, 0, 21, 31), fill=(190, 182, 164))
    d.rectangle((12, 0, 19, 31), fill=(214, 206, 188))
    d.line((10, 0, 10, 31), fill=OUTLINE)
    d.line((21, 0, 21, 31), fill=OUTLINE)
    return im


def wall_front():
    """Front wall seen from above (the room's bottom edge)."""
    im, d = new(1, 1)
    d.rectangle((0, 8, 31, 31), fill=(214, 206, 188))
    d.rectangle((0, 22, 31, 31), fill=(190, 182, 164))
    d.rectangle((0, 4, 31, 9), fill=(150, 104, 66))
    d.line((0, 4, 31, 4), fill=OUTLINE)
    d.line((0, 31, 31, 31), fill=OUTLINE)
    return im


# --------------------------------------------------------------------------- furniture

def desk():
    im, d = new(2, 1)
    d.rectangle((2, 24, 61, 30), fill=(0, 0, 0, 50))
    d.rectangle((2, 6, 61, 24), fill=(176, 126, 80), outline=OUTLINE)
    d.rectangle((4, 8, 59, 12), fill=(196, 146, 96))
    d.rectangle((5, 14, 20, 21), fill=WHITE, outline=(190, 190, 186))
    d.line((7, 16, 17, 16), fill=(120, 120, 130))
    d.line((7, 18, 14, 18), fill=(120, 120, 130))
    d.rectangle((44, 14, 56, 21), fill=(60, 60, 70), outline=OUTLINE)
    return im


def pc_desk():
    im, d = new(2, 1)
    d.rectangle((2, 24, 61, 30), fill=(0, 0, 0, 50))
    d.rectangle((2, 8, 61, 26), fill=(210, 210, 204), outline=OUTLINE)
    for x in (8, 38):
        d.rectangle((x, 2, x + 18, 16), fill=(40, 44, 52), outline=OUTLINE)
        d.rectangle((x + 2, 4, x + 16, 14), fill=(60, 140, 200))
        d.rectangle((x + 4, 6, x + 9, 7), fill=(200, 230, 255))
        d.rectangle((x + 7, 16, x + 11, 19), fill=(60, 60, 70))
        d.rectangle((x + 2, 20, x + 16, 23), fill=(90, 90, 100), outline=OUTLINE)
    return im


def chair(color=(70, 100, 170)):
    im, d = new(1, 1)
    d.ellipse((7, 24, 25, 30), fill=(0, 0, 0, 50))
    d.rectangle((8, 4, 23, 14), fill=color, outline=OUTLINE)
    d.rectangle((7, 14, 24, 23), fill=shade(color, 30), outline=OUTLINE)
    for x in (8, 22):
        d.rectangle((x, 23, x + 1, 28), fill=(50, 50, 56))
    return im


def seat_row():
    """Three auditorium seats."""
    im, d = new(3, 1)
    for i in range(3):
        x = i * 32 + 4
        d.rectangle((x, 24, x + 23, 29), fill=(0, 0, 0, 50))
        d.rectangle((x, 3, x + 23, 14), fill=(150, 40, 50), outline=OUTLINE)
        d.rectangle((x - 1, 14, x + 24, 23), fill=(178, 52, 62), outline=OUTLINE)
        d.line((x + 2, 16, x + 21, 16), fill=(130, 34, 44))
    return im


def bench_long():
    """Classroom bench with desk."""
    im, d = new(3, 1)
    d.rectangle((2, 25, 93, 30), fill=(0, 0, 0, 50))
    d.rectangle((2, 4, 93, 14), fill=(170, 118, 74), outline=OUTLINE)
    d.rectangle((4, 6, 91, 8), fill=(196, 146, 96))
    d.rectangle((3, 17, 92, 25), fill=(146, 98, 58), outline=OUTLINE)
    for x in (6, 48, 86):
        d.rectangle((x, 25, x + 2, 29), fill=(60, 60, 64))
    return im


def bookshelf():
    im, d = new(2, 2)
    d.rectangle((1, 2, 62, 62), fill=(120, 78, 46), outline=OUTLINE)
    colors = [(200, 60, 60), (60, 110, 200), (60, 160, 90), (230, 190, 60), (160, 80, 180), (240, 240, 230)]
    for row in range(3):
        y0 = 6 + row * 18
        d.rectangle((4, y0, 59, y0 + 14), fill=(80, 50, 30))
        x = 5
        while x < 57:
            w = rng.choice((3, 4, 5))
            h = rng.choice((10, 12, 13))
            d.rectangle((x, y0 + 14 - h, x + w, y0 + 13), fill=rng.choice(colors), outline=OUTLINE)
            x += w + 2
        d.line((3, y0 + 15, 60, y0 + 15), fill=(160, 112, 70))
    return im


def cupboard(color=(120, 128, 140)):
    im, d = new(1, 2)
    d.rectangle((2, 2, 29, 62), fill=color, outline=OUTLINE)
    d.line((16, 4, 16, 60), fill=OUTLINE)
    d.rectangle((12, 30, 13, 36), fill=(230, 230, 230))
    d.rectangle((18, 30, 19, 36), fill=(230, 230, 230))
    d.rectangle((4, 4, 27, 8), fill=shade(color, 30))
    return im


def bed(sheet=(90, 150, 210)):
    im, d = new(1, 2)
    d.rectangle((1, 2, 30, 62), fill=(150, 104, 66), outline=OUTLINE)
    d.rectangle((3, 4, 28, 12), fill=(140, 90, 56))
    d.rectangle((4, 6, 27, 16), fill=WHITE, outline=(200, 200, 196))
    d.rectangle((3, 18, 28, 58), fill=sheet, outline=shade(sheet, -50))
    d.rectangle((3, 18, 28, 24), fill=shade(sheet, 40))
    for y in range(30, 56, 8):
        d.line((5, y, 26, y), fill=shade(sheet, -20))
    return im


def hospital_bed():
    im = bed((236, 236, 240))
    d = ImageDraw.Draw(im)
    d.rectangle((12, 36, 19, 43), fill=(220, 50, 50))
    d.rectangle((14, 34, 17, 45), fill=(220, 50, 50))
    return im


def counter(w=3):
    im, d = new(w, 1)
    W = w * T
    d.rectangle((0, 26, W - 1, 31), fill=(0, 0, 0, 50))
    d.rectangle((0, 2, W - 1, 26), fill=(186, 140, 90), outline=OUTLINE)
    d.rectangle((1, 3, W - 2, 9), fill=(214, 170, 116))
    d.rectangle((0, 14, W - 1, 26), fill=(150, 104, 66))
    for x in range(10, W - 6, 22):
        d.rectangle((x, 16, x + 12, 24), fill=(130, 88, 54), outline=OUTLINE)
    return im


def table_round():
    im, d = new(2, 2)
    d.ellipse((6, 14, 57, 58), fill=(0, 0, 0, 50))
    d.ellipse((4, 6, 59, 50), fill=(196, 150, 96), outline=OUTLINE)
    d.ellipse((10, 10, 53, 44), fill=(214, 170, 116))
    d.rectangle((18, 20, 44, 34), fill=(230, 230, 60), outline=(200, 190, 40))
    d.ellipse((26, 22, 36, 32), fill=(240, 240, 236), outline=(180, 180, 176))
    return im


def canteen_table():
    im, d = new(3, 1)
    d.rectangle((2, 26, 93, 31), fill=(0, 0, 0, 50))
    d.rectangle((2, 4, 93, 26), fill=(226, 226, 220), outline=OUTLINE)
    d.rectangle((4, 6, 91, 10), fill=WHITE)
    for x in (12, 44, 72):
        d.ellipse((x, 12, x + 12, 22), fill=(240, 240, 236), outline=(180, 180, 176))
        d.ellipse((x + 3, 15, x + 9, 19), fill=(230, 170, 70))
    return im


def whiteboard(w=3):
    im, d = new(w, 1)
    W = w * T
    d.rectangle((2, 4, W - 3, 28), fill=(140, 140, 136), outline=OUTLINE)
    d.rectangle((5, 7, W - 6, 25), fill=WHITE)
    d.line((9, 11, 40, 11), fill=(40, 80, 200))
    d.line((9, 15, 58, 15), fill=(200, 40, 40))
    d.line((9, 19, 30, 19), fill=(40, 40, 40))
    d.rectangle((W // 2 - 6, 26, W // 2 + 6, 28), fill=(80, 80, 84))
    return im


def blackboard(w=3):
    im, d = new(w, 1)
    W = w * T
    d.rectangle((2, 4, W - 3, 28), fill=(120, 80, 50), outline=OUTLINE)
    d.rectangle((5, 7, W - 6, 25), fill=(34, 78, 54))
    d.line((9, 11, 40, 11), fill=(230, 230, 220))
    d.line((9, 15, 62, 15), fill=(230, 230, 220))
    d.line((9, 19, 36, 19), fill=(240, 230, 120))
    d.rectangle((W // 2 - 6, 26, W // 2 + 6, 28), fill=(220, 220, 210))
    return im


def window_in():
    im, d = new(1, 1)
    d.rectangle((4, 6, 27, 26), fill=(170, 210, 240), outline=OUTLINE)
    d.rectangle((6, 8, 25, 24), fill=(140, 190, 230))
    d.line((16, 6, 16, 26), fill=OUTLINE)
    d.line((4, 16, 27, 16), fill=OUTLINE)
    d.rectangle((8, 10, 11, 12), fill=(220, 240, 255))
    d.rectangle((2, 26, 29, 28), fill=(214, 206, 188), outline=OUTLINE)
    return im


def poster(color):
    im, d = new(1, 1)
    d.rectangle((6, 6, 25, 27), fill=color, outline=OUTLINE)
    d.rectangle((9, 9, 22, 16), fill=shade(color, 60))
    d.line((9, 20, 22, 20), fill=WHITE)
    d.line((9, 23, 18, 23), fill=WHITE)
    return im


def clock():
    im, d = new(1, 1)
    d.ellipse((7, 7, 25, 25), fill=WHITE, outline=OUTLINE, width=2)
    d.line((16, 16, 16, 10), fill=OUTLINE, width=2)
    d.line((16, 16, 20, 16), fill=OUTLINE)
    return im


def plant():
    im, d = new(1, 1)
    d.ellipse((8, 25, 24, 31), fill=(0, 0, 0, 50))
    d.rectangle((11, 20, 21, 29), fill=(176, 90, 60), outline=OUTLINE)
    for (x, y) in [(16, 10), (10, 14), (22, 14), (13, 6), (19, 6)]:
        d.ellipse((x - 5, y - 4, x + 5, y + 4), fill=(60, 150, 70), outline=(40, 110, 50))
    return im


def water_cooler():
    im, d = new(1, 1)
    d.rectangle((9, 14, 23, 30), fill=(200, 204, 210), outline=OUTLINE)
    d.rectangle((10, 2, 22, 14), fill=(150, 200, 240), outline=OUTLINE)
    d.rectangle((12, 4, 15, 9), fill=(220, 240, 255))
    d.rectangle((14, 17, 18, 20), fill=(60, 120, 200))
    return im


def podium():
    im, d = new(1, 1)
    d.rectangle((6, 4, 25, 30), fill=(120, 78, 46), outline=OUTLINE)
    d.rectangle((8, 6, 23, 10), fill=(160, 112, 70))
    d.rectangle((12, 14, 19, 20), fill=(60, 60, 70))
    return im


def lathe():
    im, d = new(2, 2)
    d.rectangle((2, 50, 61, 61), fill=(0, 0, 0, 50))
    d.rectangle((2, 20, 61, 56), fill=(70, 110, 90), outline=OUTLINE)
    d.rectangle((4, 22, 59, 28), fill=(90, 140, 112))
    d.rectangle((6, 8, 20, 22), fill=(110, 114, 120), outline=OUTLINE)
    d.rectangle((20, 12, 46, 18), fill=(190, 190, 186), outline=OUTLINE)
    d.rectangle((46, 6, 58, 22), fill=(110, 114, 120), outline=OUTLINE)
    d.ellipse((10, 34, 18, 42), fill=(220, 60, 50), outline=OUTLINE)
    d.ellipse((24, 34, 32, 42), fill=(60, 180, 90), outline=OUTLINE)
    for x in range(40, 58, 6):
        d.rectangle((x, 36, x + 2, 50), fill=(50, 80, 66))
    return im


def workbench():
    im, d = new(2, 1)
    d.rectangle((2, 24, 61, 30), fill=(0, 0, 0, 50))
    d.rectangle((2, 6, 61, 24), fill=(140, 104, 64), outline=OUTLINE)
    d.rectangle((4, 8, 59, 12), fill=(170, 130, 84))
    d.rectangle((8, 14, 14, 20), fill=(120, 124, 130), outline=OUTLINE)
    d.line((18, 15, 30, 15), fill=(200, 200, 196), width=2)
    d.rectangle((40, 13, 54, 21), fill=(200, 60, 50), outline=OUTLINE)
    return im


def lab_bench():
    im, d = new(3, 1)
    d.rectangle((2, 24, 93, 30), fill=(0, 0, 0, 50))
    d.rectangle((2, 6, 93, 24), fill=(60, 64, 70), outline=OUTLINE)
    d.rectangle((4, 8, 91, 11), fill=(90, 96, 104))
    for x in (12, 46, 70):
        d.rectangle((x, 12, x + 6, 20), fill=(190, 230, 250), outline=OUTLINE)
        d.rectangle((x + 1, 16, x + 5, 19), fill=rng.choice([(90, 200, 120), (230, 120, 80), (120, 120, 240)]))
    d.rectangle((26, 12, 40, 21), fill=(110, 114, 120), outline=OUTLINE)
    return im


def med_cabinet():
    im = cupboard((236, 236, 240))
    d = ImageDraw.Draw(im)
    d.rectangle((13, 10, 18, 21), fill=(220, 50, 50))
    d.rectangle((10, 13, 21, 18), fill=(220, 50, 50))
    return im


def sofa():
    im, d = new(2, 1)
    d.rectangle((2, 24, 61, 30), fill=(0, 0, 0, 50))
    d.rectangle((2, 4, 61, 14), fill=(90, 70, 130), outline=OUTLINE)
    d.rectangle((2, 14, 61, 26), fill=(118, 96, 160), outline=OUTLINE)
    d.line((31, 15, 31, 25), fill=(90, 70, 130))
    d.rectangle((2, 12, 8, 26), fill=(100, 80, 140), outline=OUTLINE)
    d.rectangle((55, 12, 61, 26), fill=(100, 80, 140), outline=OUTLINE)
    return im


def tv():
    im, d = new(2, 1)
    d.rectangle((6, 4, 57, 28), fill=(30, 30, 36), outline=OUTLINE)
    d.rectangle((9, 7, 54, 25), fill=(60, 120, 180))
    d.rectangle((12, 10, 30, 14), fill=(200, 230, 255))
    return im


def reception():
    im, d = new(3, 1)
    im2 = counter(3)
    im.alpha_composite(im2)
    d.rectangle((38, 4, 58, 11), fill=(30, 98, 72), outline=WHITE)
    d.rectangle((40, 6, 56, 7), fill=WHITE)
    return im


def rack():
    """Server / network rack."""
    im, d = new(1, 2)
    d.rectangle((3, 2, 28, 62), fill=(40, 44, 52), outline=OUTLINE)
    for y in range(6, 58, 7):
        d.rectangle((6, y, 25, y + 4), fill=(70, 76, 88))
        d.point((8, y + 2), fill=(80, 240, 120))
        d.point((11, y + 2), fill=(240, 180, 60))
    return im


def stairs():
    im, d = new(2, 2)
    d.rectangle((2, 2, 61, 61), fill=(160, 160, 154), outline=OUTLINE)
    for y in range(6, 60, 8):
        d.rectangle((4, y, 59, y + 5), fill=(200, 200, 194))
        d.line((4, y + 6, 59, y + 6), fill=(120, 120, 116))
    d.rectangle((2, 2, 4, 61), fill=(110, 72, 44))
    d.rectangle((59, 2, 61, 61), fill=(110, 72, 44))
    return im


def locker():
    im, d = new(1, 1)
    d.rectangle((3, 2, 28, 30), fill=(80, 130, 180), outline=OUTLINE)
    d.line((16, 4, 16, 28), fill=OUTLINE)
    for x in (6, 19):
        d.rectangle((x, 6, x + 6, 8), fill=(60, 100, 150))
        d.rectangle((x, 10, x + 6, 12), fill=(60, 100, 150))
    return im


def dumbbells():
    im, d = new(2, 1)
    d.rectangle((2, 20, 61, 28), fill=(120, 80, 50), outline=OUTLINE)
    for x in (8, 28, 46):
        d.rectangle((x, 8, x + 12, 12), fill=(60, 60, 70), outline=OUTLINE)
        d.rectangle((x - 3, 5, x, 15), fill=(40, 40, 46), outline=OUTLINE)
        d.rectangle((x + 12, 5, x + 15, 15), fill=(40, 40, 46), outline=OUTLINE)
    return im


# --------------------------------------------------------------------------- catalogue

def catalogue(element):
    """Registers every interior element through generate.py's element() helper."""
    element("floor-wood", floor_wood(), "floor", False)
    element("floor-tile", floor_tile(), "floor", False)
    element("floor-tile-blue", floor_tile((214, 226, 236), (190, 206, 222)), "floor", False)
    element("floor-carpet", floor_carpet(), "floor", False)
    element("floor-carpet-green", floor_carpet((56, 120, 80)), "floor", False)
    element("floor-concrete", floor_concrete(), "floor", False)
    element("floor-stage", floor_stage(), "floor", False)
    element("door-in", door_mat("in"), "floor", False)
    element("door-out", door_mat("out"), "floor", False)

    element("in-wall-back", wall_back(), "wall", True)
    element("in-wall-back-blue", wall_back((206, 222, 232)), "wall", True)
    element("in-wall-back-pink", wall_back((236, 216, 214)), "wall", True)
    element("in-wall-back-grey", wall_back((200, 200, 196)), "wall", True)
    element("in-wall-side", wall_side(), "wall", True)
    element("in-wall-front", wall_front(), "wall", True)
    element("bookshelf", bookshelf(), "wall", True)
    element("cupboard", cupboard(), "wall", True)
    element("bed", bed(), "wall", True)
    element("bed-green", bed((110, 180, 120)), "wall", True)
    element("hospital-bed", hospital_bed(), "wall", True)
    element("counter", counter(), "wall", True)
    element("reception", reception(), "wall", True)
    element("lathe", lathe(), "wall", True)
    element("workbench", workbench(), "wall", True)
    element("lab-bench", lab_bench(), "wall", True)
    element("med-cabinet", med_cabinet(), "wall", True)
    element("rack", rack(), "wall", True)
    element("stairs", stairs(), "wall", True)
    element("locker", locker(), "wall", True)

    element("desk", desk(), "objects", True)
    element("pc-desk", pc_desk(), "objects", True)
    element("chair", chair(), "objects", True)
    element("chair-red", chair((170, 60, 60)), "objects", True)
    element("seat-row", seat_row(), "objects", True)
    element("bench-long", bench_long(), "objects", True)
    element("table-round", table_round(), "objects", True)
    element("canteen-table", canteen_table(), "objects", True)
    element("plant", plant(), "objects", True)
    element("water-cooler", water_cooler(), "objects", True)
    element("podium", podium(), "objects", True)
    element("sofa", sofa(), "objects", True)
    element("dumbbells", dumbbells(), "objects", True)

    element("whiteboard", whiteboard(), "topObjects", False)
    element("blackboard", blackboard(), "topObjects", False)
    element("window-in", window_in(), "topObjects", False)
    element("poster-blue", poster((60, 110, 200)), "topObjects", False)
    element("poster-red", poster((200, 60, 60)), "topObjects", False)
    element("poster-green", poster((40, 140, 90)), "topObjects", False)
    element("clock", clock(), "topObjects", False)
    element("tv", tv(), "topObjects", False)


# --------------------------------------------------------------------------- rooms

class Room:
    """
    One interior area. `put` places elements in it; the exit is the pair of tiles at the bottom that
    lead back outside (the spawn is just above them). The floor and walls are placed first, as a few
    big tiled elements rather than one per tile, to keep the number of placements down.
    """

    def __init__(self, area_id, name, w, h, floor="floor-tile", wall="in-wall-back", put=None, tiled=None):
        self.id = area_id
        self.name = name
        self.w, self.h = w, h
        self._put = put
        self.exit_x = w // 2 - 1  # exit mats at exit_x and exit_x + 1 on the bottom row
        self.spawn = (w // 2 - 1, h - 2)
        self.put(tiled(floor, w, h), 0, 0)
        self.put(tiled(wall, w, 2), 0, 0)
        self.put(tiled("in-wall-front", self.exit_x, 1), 0, h - 1)
        self.put(tiled("in-wall-front", w - self.exit_x - 2, 1), self.exit_x + 2, h - 1)
        self.put(tiled("in-wall-side", 1, h - 3), 0, 2)
        self.put(tiled("in-wall-side", 1, h - 3), w - 1, 2)
        # windows and a clock along the back wall
        for x in range(3, w - 3, 4):
            self.put("window-in", x, 0)
        self.put("clock", w - 2, 0)

    def put(self, key, x, y, to=None):
        self._put(key, x, y, self.id, to)

    def exits(self, to_area, to_x, to_y):
        for x in (self.exit_x, self.exit_x + 1):
            self.put("door-out", x, self.h - 1, (to_area, to_x, to_y))

    def area_def(self):
        return {"id": self.id, "name": self.name, "width": self.w, "height": self.h,
                "spawnX": self.spawn[0], "spawnY": self.spawn[1], "ground": "dark"}


# Room layout rules (checked by generate.py's validate()):
#   rows 0-1 are the back wall, so furniture starts at row 2; the bottom row is the front wall
#   with the exit in the middle, and the spawn is just above it, so keep rows h-3 and h-2 clear.
#   Seats need a free tile next to them; every walkable tile must be reachable from the spawn.

def classroom(r, board="blackboard"):
    """Rows of bench-desks facing a board, a teacher's desk, lockers at the back."""
    r.put(board, r.w // 2 - 1, 0)
    r.put("poster-blue", 1, 0)
    r.put("poster-green", r.w - 3, 0)
    r.put("desk", r.w // 2 - 1, 2)
    r.put("chair-red", r.w // 2 - 1, 3)
    for y in range(5, r.h - 3, 2):
        for x in range(2, r.w - 4, 4):
            r.put("bench-long", x, y)
    r.put("notice-board", r.w - 3, 2)
    r.put("locker", 1, 2)
    r.put("plant", 1, r.h - 2)
    r.put("water-cooler", r.w - 2, r.h - 2)


def computer_lab(r):
    r.put("whiteboard", r.w // 2 - 1, 0)
    r.put("poster-blue", 2, 0)
    r.put("rack", r.w - 2, 2)
    r.put("rack", r.w - 3, 2)
    r.put("notice-board", 1, 2)
    for y in range(4, r.h - 4, 3):
        for x in range(2, r.w - 3, 3):
            r.put("pc-desk", x, y)
            r.put("chair", x, y + 1)
    r.put("plant", 1, r.h - 2)
    r.put("water-cooler", r.w - 2, r.h - 2)


def dept(r):
    """A department: classroom on the left, computer lab on the right, lockers in between."""
    mid = r.w // 2
    r.put("blackboard", 2, 0)
    r.put("whiteboard", mid + 3, 0)
    r.put("desk", 2, 2)
    r.put("chair-red", 2, 3)
    r.put("notice-board", 6, 2)
    for y in range(5, r.h - 3, 2):
        for x in (1, 5):
            r.put("bench-long", x, y)
    for y in range(2, r.h - 3):
        if y % 3 == 2:
            r.put("locker", mid, y)
    for y in range(3, r.h - 4, 3):
        for x in range(mid + 2, r.w - 2, 3):
            r.put("pc-desk", x, y)
            r.put("chair", x, y + 1)
    r.put("rack", r.w - 2, 2)
    r.put("water-cooler", r.w - 2, r.h - 2)
    r.put("plant", 1, r.h - 2)


def library(r):
    r.put("poster-green", 1, 0)
    r.put("reception", 1, 2)
    for x in range(5, r.w - 2, 3):
        r.put("bookshelf", x, 2)
    for y in range(5, r.h - 4, 3):
        r.put("bookshelf", 1, y)
        r.put("bookshelf", r.w - 3, y)
        for x in range(5, r.w - 6, 4):
            r.put("desk", x, y)
            r.put("chair", x, y + 1)
            r.put("chair", x + 1, y + 1)
    r.put("notice-board", r.w - 4, r.h - 3)
    r.put("plant", 1, r.h - 2)
    r.put("water-cooler", r.w - 2, r.h - 2)


def hostel(r):
    """A hostel floor: rooms (bed + cupboard + desk) along the back, common room below."""
    n = (r.w - 2) // 4
    for i in range(n):
        x = 1 + i * 4
        r.put("bed" if i % 2 else "bed-green", x, 2)
        r.put("cupboard", x + 1, 2)
        r.put("desk", x + 2, 2)
        r.put("chair", x + 2, 3)
    r.put("poster-red", 2, 0)
    r.put("poster-blue", r.w - 4, 0)
    # common room: TV on the wall, sofas, a table and some weights
    y = r.h - 5
    r.put("tv", 1, y - 1)
    r.put("sofa", 1, y + 1)
    r.put("sofa", 4, y + 1)
    r.put("table-round", r.w - 6, y - 1)
    r.put("chair", r.w - 7, y)
    r.put("chair", r.w - 4, y)
    r.put("dumbbells", r.w - 3, y + 2)
    r.put("notice-board", r.w // 2 - 1, y - 1)
    r.put("water-cooler", 1, r.h - 2)
    r.put("plant", r.w - 2, r.h - 2)


def canteen(r):
    r.put("poster-red", 1, 0)
    r.put("poster-green", 5, 0)
    r.put("tv", r.w - 4, 0)
    r.put("counter", 1, 2)
    r.put("counter", 4, 2)
    r.put("water-cooler", r.w - 2, 2)
    for y in range(4, r.h - 4, 3):
        for x in range(1, r.w - 3, 5):
            r.put("canteen-table", x, y)
            r.put("chair-red", x, y + 1)
            r.put("chair-red", x + 2, y + 1)
    r.put("plant", r.w - 2, r.h - 2)


def admin(r):
    r.put("poster-blue", 1, 0)
    r.put("poster-green", r.w - 3, 0)
    r.put("reception", r.w // 2 - 1, 2)
    r.put("cupboard", 1, 2)
    r.put("cupboard", 2, 2)
    r.put("cupboard", r.w - 3, 2)
    r.put("cupboard", r.w - 2, 2)
    for y in range(5, r.h - 4, 3):
        for x in (1, r.w - 3):
            r.put("desk", x, y)
            r.put("chair", x, y + 1)
    r.put("table-round", r.w // 2 - 1, 5)
    r.put("sofa", r.w // 2 - 3, 8)
    r.put("sofa", r.w // 2 + 1, 8)
    r.put("notice-board", r.w // 2 - 1, r.h - 4)
    r.put("plant", 1, r.h - 2)
    r.put("plant", r.w - 2, r.h - 2)


def auditorium(r):
    # stage along the back wall, rows of seats facing it with a centre aisle
    for y in (2, 3):
        for x in range(1, r.w - 1):
            r.put("floor-stage", x, y)
    r.put("podium", r.w // 2, 2)
    r.put("poster-red", 2, 0)
    r.put("poster-blue", r.w - 3, 0)
    r.put("plant", 1, 3)
    r.put("plant", r.w - 2, 3)
    for y in range(5, r.h - 3, 2):
        for x in (1, 5, r.w - 8, r.w - 4):
            r.put("seat-row", x, y)


def workshop(r):
    r.put("whiteboard", 2, 0)
    r.put("poster-red", 6, 0)
    for x in range(1, r.w - 2, 3):
        r.put("lathe", x, 2)
    for y in range(6, r.h - 4, 3):
        for x in range(2, r.w - 3, 4):
            r.put("workbench", x, y)
    r.put("locker", 1, r.h - 4)
    r.put("notice-board", r.w - 3, r.h - 4)
    r.put("water-cooler", 1, r.h - 2)


def dispensary(r):
    r.put("poster-red", r.w // 2, 0)
    r.put("reception", 1, 2)
    r.put("med-cabinet", r.w - 2, 2)
    r.put("med-cabinet", r.w - 3, 2)
    for x in range(1, r.w - 2, 3):
        r.put("hospital-bed", x, 5)
    r.put("chair", 2, r.h - 3)
    r.put("chair", 4, r.h - 3)
    r.put("plant", r.w - 2, r.h - 2)
    r.put("water-cooler", r.w - 3, r.h - 2)


TEMPLATES = {
    "classroom": classroom,
    "lab": computer_lab,
    "dept": dept,
    "library": library,
    "hostel": hostel,
    "canteen": canteen,
    "admin": admin,
    "auditorium": auditorium,
    "workshop": workshop,
    "dispensary": dispensary,
}
