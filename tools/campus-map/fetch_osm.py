#!/usr/bin/env python3
"""
Fetches the OSM features inside the GEC Bilaspur campus core and caches them in
osm/gec-bilaspur.osm.json. The generator reads only this file; run this script
when the campus data on OpenStreetMap has improved.

Run: python3 tools/campus-map/fetch_osm.py
"""
import json
import sys
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "osm" / "gec-bilaspur.osm.json"
BBOX = "82.1280,22.1340,82.1330,22.1385"  # W,S,E,N
URL = f"https://api.openstreetmap.org/api/0.6/map.json?bbox={BBOX}"


def main():
    req = urllib.request.Request(URL, headers={"User-Agent": "metaverse-campus-map"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        if resp.status != 200:
            sys.exit(f"{URL}: HTTP {resp.status}")
        data = json.load(resp)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    tmp = OUT.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=1) + "\n")
    tmp.rename(OUT)
    ways = sum(1 for e in data["elements"] if e["type"] == "way")
    print(f"wrote {OUT} ({ways} ways)")


if __name__ == "__main__":
    main()
