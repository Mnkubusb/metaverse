"""Pixel-art props for the Bilaspur place maps (riverfront, railway station, zoo, temple, mall),
drawn with Pillow at the 32 px tile size in the same flat style as the campus art: dark outline,
one highlight and one shadow tone per material, a soft contact shadow on things that stand.

PROP_SIZES / PROP_LAYERS feed layout.SPRITE_SIZES and the element layers; render_all() writes
the PNGs next to the sliced tiles in apps/web/public/campus/.
"""
import math

from PIL import Image, ImageDraw

T = 32
OUTLINE = (44, 38, 48, 255)
SHADOW = (22, 44, 26, 70)


def shade(c, k):
    return tuple(max(0, min(255, v + k)) for v in c[:3]) + (255,)


def canvas(w, h):
    im = Image.new("RGBA", (w * T, h * T), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)


def ground_shadow(d, x0, x1, y):
    d.ellipse((x0, y - 5, x1, y + 3), fill=SHADOW)


# ----------------------------------------------------------------------------- outdoor props

def boat():
    im, d = canvas(3, 1)
    d.polygon([(4, 12), (92, 12), (84, 26), (12, 26)], fill=(138, 88, 50), outline=OUTLINE)
    d.polygon([(8, 14), (88, 14), (82, 22), (14, 22)], fill=(170, 116, 70))
    for x in (30, 48, 66):
        d.rectangle((x, 14, x + 3, 22), fill=(118, 74, 42))
    d.line((48, 2, 48, 13), fill=OUTLINE, width=2)  # oar post
    d.polygon([(49, 3), (62, 9), (49, 11)], fill=(230, 90, 60), outline=OUTLINE)
    return im


def stall(awning, awning2, goods, label_colour=(250, 240, 220)):
    """Market stall seen from the front: striped awning, counter with goods, shadow."""
    im, d = canvas(3, 2)
    ground_shadow(d, 6, 90, 60)
    d.rectangle((8, 30, 88, 58), fill=(150, 98, 58), outline=OUTLINE)
    d.rectangle((10, 32, 86, 36), fill=(184, 128, 80))
    for k, x in enumerate(range(14, 84, 12)):
        d.rectangle((x, 40, x + 8, 48), fill=goods[k % len(goods)], outline=OUTLINE)
    d.rectangle((10, 50, 86, 56), fill=(126, 80, 46))
    # posts and awning
    d.rectangle((10, 10, 13, 30), fill=(96, 70, 50))
    d.rectangle((83, 10, 86, 30), fill=(96, 70, 50))
    d.polygon([(2, 8), (94, 8), (90, 22), (6, 22)], fill=awning, outline=OUTLINE)
    for x in range(6, 90, 12):
        d.polygon([(x, 8), (x + 6, 8), (x + 5, 22), (x + 1, 22)], fill=awning2)
    for x in range(6, 92, 8):
        d.pieslice((x - 4, 18, x + 4, 26), 0, 180, fill=awning, outline=OUTLINE)
    return im


def train_coach(body=(62, 96, 168), stripe=(236, 196, 70), w=7):
    """A passenger coach seen from above: roof with ventilators, pale end gangways."""
    im, d = canvas(w, 1)
    d.rectangle((3, 3, w * T - 4, 28), fill=shade(body, -10), outline=OUTLINE)
    d.rectangle((6, 6, w * T - 7, 25), fill=body)
    d.rectangle((6, 14, w * T - 7, 17), fill=stripe)
    for x in range(18, w * T - 18, 20):
        d.ellipse((x, 8, x + 6, 12), fill=shade(body, 40), outline=OUTLINE)
        d.ellipse((x, 19, x + 6, 23), fill=shade(body, 40), outline=OUTLINE)
    d.rectangle((0, 9, 3, 22), fill=(90, 90, 96))
    d.rectangle((w * T - 4, 9, w * T - 1, 22), fill=(90, 90, 96))
    return im


def train_engine():
    im, d = canvas(5, 1)
    body = (196, 52, 46)
    d.rectangle((3, 3, 5 * T - 10, 28), fill=shade(body, -14), outline=OUTLINE)
    d.polygon([(5 * T - 12, 3), (5 * T - 2, 9), (5 * T - 2, 22), (5 * T - 12, 28)], fill=shade(body, -14), outline=OUTLINE)
    d.rectangle((6, 6, 5 * T - 13, 25), fill=body)
    d.rectangle((6, 13, 5 * T - 6, 18), fill=(244, 236, 220))
    for x in (30, 70, 110):
        d.rectangle((x, 8, x + 20, 12), fill=(150, 150, 156), outline=OUTLINE)
    d.line((40, 2, 120, 2), fill=(60, 60, 64), width=2)  # pantograph
    d.rectangle((5 * T - 10, 11, 5 * T - 5, 20), fill=(250, 240, 160))
    return im


def canopy(w=4, roof=(78, 120, 168, 165), rib=(60, 96, 140, 190)):
    """Platform shelter roof, see-through so players stay visible beneath it."""
    im, d = canvas(w, 2)
    d.rectangle((0, 4, w * T - 1, 52), fill=roof)
    for x in range(0, w * T, 16):
        d.line((x, 4, x, 52), fill=rib, width=2)
    d.rectangle((0, 4, w * T - 1, 7), fill=(236, 236, 230, 200))
    d.rectangle((0, 49, w * T - 1, 52), fill=(40, 70, 108, 210))
    for x in (8, w * T - 12):
        d.rectangle((x, 52, x + 4, 62), fill=(80, 84, 92))
    return im


def platform_bench():
    im, d = canvas(2, 1)
    ground_shadow(d, 4, 60, 28)
    d.rectangle((4, 8, 59, 18), fill=(176, 180, 186), outline=OUTLINE)
    d.rectangle((6, 10, 57, 13), fill=(214, 218, 222))
    d.rectangle((8, 18, 11, 26), fill=(90, 94, 100))
    d.rectangle((52, 18, 55, 26), fill=(90, 94, 100))
    return im


def ticket_booth(colour=(196, 62, 52)):
    im, d = canvas(2, 2)
    ground_shadow(d, 4, 60, 62)
    d.rectangle((6, 16, 57, 58), fill=(236, 226, 200), outline=OUTLINE)
    d.polygon([(2, 18), (32, 2), (61, 18)], fill=colour, outline=OUTLINE)
    d.rectangle((16, 28, 47, 42), fill=(70, 110, 150), outline=OUTLINE)
    d.rectangle((14, 42, 49, 46), fill=(150, 104, 66))
    d.text((19, 47), "TICKET", fill=(60, 40, 30))
    return im


def shikhara(w=3, h=4, tiers=7):
    """Temple spire (nagara style) with an amalaka and a saffron flag, drawn over the temple's roof."""
    im, d = canvas(w, h)
    cx = w * T // 2
    base = (226, 120, 70)
    hi, lo = shade(base, 28), shade(base, -36)
    top = 24
    step = (h * T - top - 2) // tiers
    for k in range(tiers):
        y0 = top + k * step
        half = int(w * T * 0.16) + int((w * T * 0.46 - w * T * 0.16) * k / max(1, tiers - 1))
        d.rectangle((cx - half, y0, cx + half, y0 + step), fill=base, outline=OUTLINE)
        d.rectangle((cx - half + 2, y0 + 2, cx - half + max(4, half // 4), y0 + step - 2), fill=hi)
        d.rectangle((cx + half - max(4, half // 4), y0 + 2, cx + half - 2, y0 + step - 2), fill=lo)
        if w > 3:
            for x in range(cx - half + 10, cx + half - 6, 14):
                d.rectangle((x, y0 + 4, x + 4, y0 + step - 4), fill=shade(base, -16))
    d.ellipse((cx - 12, top - 14, cx + 12, top + 2), fill=(240, 196, 70), outline=OUTLINE)  # amalaka
    d.rectangle((cx - 1, 0, cx + 1, top - 12), fill=OUTLINE)
    d.polygon([(cx + 1, 0), (cx + 20, 5), (cx + 1, 10)], fill=(250, 140, 30), outline=OUTLINE)
    return im


def bell_arch():
    im, d = canvas(2, 2)
    ground_shadow(d, 2, 62, 62)
    d.rectangle((4, 10, 9, 60), fill=(172, 140, 100), outline=OUTLINE)
    d.rectangle((54, 10, 59, 60), fill=(172, 140, 100), outline=OUTLINE)
    d.rectangle((2, 6, 61, 12), fill=(196, 160, 112), outline=OUTLINE)
    for x in (18, 30, 42):
        d.line((x + 3, 12, x + 3, 20), fill=OUTLINE)
        d.pieslice((x - 3, 18, x + 9, 34), 180, 360, fill=(222, 178, 64), outline=OUTLINE)
        d.rectangle((x - 3, 26, x + 9, 28), fill=(222, 178, 64), outline=OUTLINE)
    return im


def marigold_planter():
    im, d = canvas(1, 1)
    d.rectangle((6, 16, 25, 29), fill=(168, 96, 60), outline=OUTLINE)
    for x, y in ((10, 12), (16, 9), (22, 12), (13, 15), (19, 15)):
        d.ellipse((x - 4, y - 4, x + 4, y + 4), fill=(250, 156, 30), outline=(200, 110, 20))
    return im


def lamp_post():
    im, d = canvas(1, 2)
    ground_shadow(d, 8, 26, 62)
    d.rectangle((14, 12, 17, 60), fill=(60, 64, 72))
    d.rectangle((6, 6, 25, 10), fill=(60, 64, 72))
    for x in (6, 22):
        d.ellipse((x - 2, 8, x + 5, 16), fill=(255, 236, 160), outline=OUTLINE)
    return im


def rock():
    im, d = canvas(2, 1)
    ground_shadow(d, 4, 60, 28)
    d.polygon([(6, 26), (14, 8), (34, 4), (54, 12), (58, 26)], fill=(140, 136, 128), outline=OUTLINE)
    d.polygon([(16, 10), (34, 6), (44, 12), (24, 16)], fill=(176, 172, 162))
    return im


def statue():
    """Swami Vivekananda style standing statue on a plinth (riverfront landmark)."""
    im, d = canvas(2, 3)
    ground_shadow(d, 4, 60, 94)
    d.rectangle((10, 64, 53, 90), fill=(214, 206, 188), outline=OUTLINE)
    d.rectangle((14, 60, 49, 66), fill=(188, 180, 162), outline=OUTLINE)
    d.ellipse((24, 10, 40, 26), fill=(240, 150, 60), outline=OUTLINE)  # turban
    d.ellipse((26, 18, 38, 30), fill=(196, 150, 110), outline=OUTLINE)
    d.polygon([(20, 30), (44, 30), (48, 60), (16, 60)], fill=(232, 120, 40), outline=OUTLINE)
    d.line((32, 32, 32, 58), fill=(200, 96, 30))
    return im


def led_screen():
    """Open-air screen on two legs (riverfront movie nights)."""
    im, d = canvas(4, 3)
    ground_shadow(d, 8, 120, 94)
    d.rectangle((16, 60, 21, 94), fill=(70, 74, 82))
    d.rectangle((106, 60, 111, 94), fill=(70, 74, 82))
    d.rectangle((2, 4, 125, 64), fill=(26, 28, 34), outline=OUTLINE)
    d.rectangle((7, 9, 120, 59), fill=(40, 60, 96))
    d.polygon([(54, 22), (54, 46), (76, 34)], fill=(236, 240, 246))
    return im


# ----------------------------------------------------------------------------- animals

def tiger():
    im, d = canvas(2, 1)
    ground_shadow(d, 6, 58, 28)
    body = (230, 136, 40)
    d.rounded_rectangle((10, 8, 50, 24), 6, fill=body, outline=OUTLINE)
    for x in range(16, 48, 7):
        d.line((x, 9, x - 2, 23), fill=OUTLINE, width=2)
    d.ellipse((44, 4, 62, 20), fill=body, outline=OUTLINE)
    d.ellipse((47, 2, 52, 7), fill=body, outline=OUTLINE)
    d.ellipse((55, 2, 60, 7), fill=body, outline=OUTLINE)
    d.rectangle((50, 13, 58, 17), fill=(248, 240, 226))
    d.point((51, 10), fill=OUTLINE)
    d.point((57, 10), fill=OUTLINE)
    d.line((10, 14, 2, 8), fill=body, width=3)
    for x in (14, 22, 38, 46):
        d.rectangle((x, 22, x + 3, 28), fill=shade(body, -30))
    return im


def deer():
    im, d = canvas(2, 2)
    ground_shadow(d, 10, 54, 62)
    body = (186, 120, 70)
    d.rounded_rectangle((14, 30, 46, 46), 6, fill=body, outline=OUTLINE)
    for x, y in ((20, 34), (28, 38), (36, 34), (24, 42), (40, 40)):
        d.ellipse((x, y, x + 3, y + 3), fill=(248, 238, 220))
    d.polygon([(42, 32), (50, 18), (56, 20), (50, 34)], fill=body, outline=OUTLINE)
    d.ellipse((48, 14, 60, 24), fill=body, outline=OUTLINE)
    d.line((52, 14, 48, 4), fill=(110, 80, 50), width=2)
    d.line((48, 8, 44, 6), fill=(110, 80, 50), width=2)
    d.line((56, 14, 60, 4), fill=(110, 80, 50), width=2)
    for x in (16, 22, 38, 44):
        d.rectangle((x, 46, x + 2, 60), fill=shade(body, -40))
    return im


def bear():
    im, d = canvas(2, 1)
    ground_shadow(d, 6, 58, 29)
    body = (40, 34, 34)
    d.rounded_rectangle((8, 6, 48, 26), 8, fill=body, outline=OUTLINE)
    d.ellipse((42, 6, 60, 22), fill=body, outline=OUTLINE)
    d.ellipse((52, 12, 62, 20), fill=(196, 170, 140))
    d.ellipse((44, 3, 50, 9), fill=body)
    d.polygon([(22, 12), (32, 18), (42, 12), (32, 15)], fill=(236, 226, 206))  # sloth bear chest mark
    return im


def crocodile():
    im, d = canvas(3, 1)
    body = (84, 112, 66)
    d.polygon([(4, 16), (20, 10), (70, 9), (94, 14), (70, 20), (20, 22)], fill=body, outline=OUTLINE)
    for x in range(24, 66, 6):
        d.line((x, 11, x, 19), fill=shade(body, -24))
    for x in (28, 58):
        d.line((x, 20, x - 4, 27), fill=body, width=3)
        d.line((x, 10, x - 4, 3), fill=body, width=3)
    d.point((84, 12), fill=(240, 220, 90))
    return im


def peacock():
    im, d = canvas(2, 2)
    ground_shadow(d, 14, 50, 62)
    for k in range(9):
        a = math.radians(200 + k * 17.5)
        x, y = 30 + math.cos(a) * 26, 40 + math.sin(a) * 26
        d.line((30, 40, x, y), fill=(40, 120, 80), width=4)
        d.ellipse((x - 4, y - 4, x + 4, y + 4), fill=(40, 160, 150), outline=(30, 80, 120))
        d.ellipse((x - 2, y - 2, x + 2, y + 2), fill=(30, 50, 120))
    d.ellipse((24, 32, 38, 50), fill=(30, 80, 170), outline=OUTLINE)
    d.ellipse((34, 22, 42, 30), fill=(30, 80, 170), outline=OUTLINE)
    d.line((36, 30, 34, 36), fill=(30, 80, 170), width=4)
    d.line((26, 50, 26, 60), fill=(150, 130, 90), width=2)
    d.line((34, 50, 34, 60), fill=(150, 130, 90), width=2)
    return im


def hippo():
    im, d = canvas(2, 1)
    body = (128, 112, 124)
    d.rounded_rectangle((6, 6, 48, 26), 9, fill=body, outline=OUTLINE)
    d.rounded_rectangle((42, 8, 62, 24), 6, fill=shade(body, 12), outline=OUTLINE)
    d.ellipse((54, 10, 58, 14), fill=OUTLINE)
    d.ellipse((54, 18, 58, 22), fill=OUTLINE)
    return im


def monkey():
    im, d = canvas(1, 1)
    body = (150, 140, 128)
    d.ellipse((8, 12, 22, 28), fill=body, outline=OUTLINE)
    d.ellipse((10, 2, 22, 14), fill=body, outline=OUTLINE)
    d.ellipse((13, 5, 20, 12), fill=(40, 34, 34))
    d.arc((18, 14, 32, 30), 270, 90, fill=body, width=2)
    return im


# ----------------------------------------------------------------------------- catalogue

SPRITES = {
    # key: (painter, layer)
    "boat": (boat, "objects"),
    "stall-chaat": (lambda: stall((214, 54, 44), (246, 220, 90), [(240, 200, 120), (236, 120, 60), (120, 180, 80)]), "objects"),
    "stall-prasad": (lambda: stall((240, 120, 30), (250, 210, 80), [(250, 150, 30), (250, 230, 200), (220, 60, 60)]), "objects"),
    "stall-toys": (lambda: stall((60, 120, 200), (240, 240, 240), [(230, 60, 90), (60, 180, 200), (250, 210, 60)]), "objects"),
    "train-coach": (train_coach, "objects"),
    "train-coach-red": (lambda: train_coach((168, 52, 46), (236, 220, 200)), "objects"),
    "train-engine": (train_engine, "objects"),
    "canopy": (canopy, "topObjects"),
    "canopy-red": (lambda: canopy(roof=(214, 110, 120, 170), rib=(180, 80, 92, 190)), "topObjects"),
    "platform-bench": (platform_bench, "objects"),
    "ticket-booth": (ticket_booth, "objects"),
    "shikhara": (lambda: shikhara(5, 7, 11), "topObjects"),
    "shikhara-small": (shikhara, "topObjects"),
    "bell-arch": (bell_arch, "objects"),
    "marigold": (marigold_planter, "objects"),
    "lamp-post": (lamp_post, "objects"),
    "rock": (rock, "objects"),
    "statue": (statue, "objects"),
    "led-screen": (led_screen, "objects"),
    "tiger": (tiger, "objects"),
    "deer": (deer, "objects"),
    "bear": (bear, "objects"),
    "crocodile": (crocodile, "objects"),
    "peacock": (peacock, "objects"),
    "hippo": (hippo, "objects"),
    "monkey": (monkey, "objects"),
}


def _size(painter):
    im = painter()
    return im.width // T, im.height // T


PROP_SIZES = {k: _size(p) for k, (p, _) in SPRITES.items()}
PROP_LAYERS = {k: layer for k, (_, layer) in SPRITES.items()}


def render_all(public_dir):
    for key, (painter, _) in SPRITES.items():
        painter().save(public_dir / f"{key}.png", optimize=True)
    # invisible blocker laid over water, tracks and fences
    Image.new("RGBA", (T, T), (0, 0, 0, 0)).save(public_dir / "block.png", optimize=True)
    return sorted(SPRITES)
