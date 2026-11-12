import random
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from campusmap import areas, emit, layout, places, reach  # noqa: E402

PUBLIC = Path(__file__).resolve().parents[3] / "apps/web/public/campus"


@pytest.mark.parametrize("plan", places.all_plans(), ids=lambda p: p.id)
def test_place_maps_build_and_validate(plan):
    lay = layout.build(plan.features, plan.width, plan.height, random.Random(plan.seed), plan=plan)
    defs = areas.RoomBuilder(lay).build()
    assert emit.validate(lay, PUBLIC, defs) == []
    assert reach.reachable_count(lay) > 1000
    assert lay.doors, "every place has at least one building to walk into"


def test_water_and_tracks_block_movement():
    plan = next(p for p in places.all_plans() if p.id == "bilaspur-junction")
    lay = layout.build(plan.features, plan.width, plan.height, random.Random(plan.seed), plan=plan)
    blocked = reach.blocked_tiles(lay, "main")
    assert (2, 31) in blocked          # on the first track, away from the foot over-bridges
    assert (30, 31) not in blocked     # the foot over-bridge crosses it
    assert (64, 28) not in blocked     # platform 1
