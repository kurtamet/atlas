"""
Daily-services access index IN01 (spec §3.1 / M3 example index C3), zone and comuna level.

    python pipeline/access_services.py --places places_stgo.parquet --gtfs gtfs_dir \
        --zones public/data/zones.geojson --weights public/data/zone-weights.json \
        --out public/data/access.json

Four equally weighted groups (spec M3): groceries, pharmacy, primary health care,
everyday public transport. For each group: time to the nearest place, scored with the
spec's piecewise-linear function s(t)=100 for t<=5 min, 0 for t>=20 min.

Time is ESTIMATED from straight-line distance x 1.3 (typical urban detour) at 4.5 km/h —
the spec's named fallback until routing over the walking network exists. Places come from
Overture Maps (confidence >= 0.5); transport = GTFS stops with weekday morning service.
It measures distance to services, not their quality or capacity.
"""
import argparse
import csv
import json
import math
from collections import defaultdict

import pyarrow.parquet as pq

GROUPS = {
    "food": {"food_and_beverage_store", "convenience_store", "farmers_market", "market"},
    "pharmacy": {"pharmacy_and_drug_store"},
    "health": {"health_care", "hospital", "outpatient_care_facility", "primary_care_or_general_clinic", "medical_service", "pediatric_clinic"},
}
MIN_CONFIDENCE = 0.5
DETOUR, SPEED_KMH = 1.3, 4.5
A_MIN, B_MIN = 5, 20
LAT0 = math.radians(-33.45)
KX, KY = 111_320 * math.cos(LAT0), 110_574
CELL = 400  # m, search grid


def score(t):
    return 100.0 if t <= A_MIN else 0.0 if t >= B_MIN else 100.0 * (B_MIN - t) / (B_MIN - A_MIN)


class Nearest:
    def __init__(self, pts):
        self.grid = defaultdict(list)
        for x, y in pts:
            px, py = x * KX, y * KY
            self.grid[(int(px // CELL), int(py // CELL))].append((px, py))

    def dist(self, lon, lat, max_rings=5):
        px, py = lon * KX, lat * KY
        cx, cy = int(px // CELL), int(py // CELL)
        best = math.inf
        for r in range(max_rings + 1):
            for dx in range(-r, r + 1):
                for dy in range(-r, r + 1):
                    if max(abs(dx), abs(dy)) != r:
                        continue
                    for sx, sy in self.grid.get((cx + dx, cy + dy), ()):
                        best = min(best, math.hypot(sx - px, sy - py))
            if best <= r * CELL:  # nothing closer can be in outer rings
                break
        return best


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--places", required=True)
    ap.add_argument("--gtfs", required=True)
    ap.add_argument("--zones", required=True)
    ap.add_argument("--weights", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    t = pq.read_table(a.places, columns=["bbox", "basic_category", "confidence"]).to_pylist()
    pts = defaultdict(list)
    for r in t:
        if (r["confidence"] or 0) < MIN_CONFIDENCE:
            continue
        for g, cats in GROUPS.items():
            if r["basic_category"] in cats:
                b = r["bbox"]
                pts[g].append(((b["xmin"] + b["xmax"]) / 2, (b["ymin"] + b["ymax"]) / 2))

    g = a.gtfs.rstrip("/")
    served = set()
    weekday = {r["trip_id"] for r in csv.DictReader(open(f"{g}/trips.txt", encoding="utf-8-sig")) if r["service_id"] == "L"}
    for r in csv.DictReader(open(f"{g}/stop_times.txt", encoding="utf-8-sig")):
        if r["trip_id"] in weekday:
            served.add(r["stop_id"])
    pts["transport"] = [(float(r["stop_lon"]), float(r["stop_lat"])) for r in csv.DictReader(open(f"{g}/stops.txt", encoding="utf-8-sig")) if r["stop_id"] in served]

    idx = {k: Nearest(v) for k, v in pts.items()}
    zones = json.load(open(a.zones, encoding="utf-8"))["features"]
    weights = json.load(open(a.weights))["weights"]
    out_z, by_c = {}, defaultdict(list)
    for f in zones:
        ring = f["geometry"]["coordinates"][0]
        lon = sum(p[0] for p in ring[:4]) / 4
        lat = sum(p[1] for p in ring[:4]) / 4
        parts = {}
        for k, n in idx.items():
            d = n.dist(lon, lat)
            minutes = d * DETOUR / (SPEED_KMH * 1000 / 60)
            parts[k] = round(minutes, 1) if math.isfinite(minutes) else None
        s = sum(score(m) if m is not None else 0 for m in parts.values()) / len(parts)
        zid = f["properties"]["id"]
        out_z[zid] = {"v": round(s), **{k: m for k, m in parts.items()}}
        w = weights.get(zid, 0)
        if w:
            by_c[str(f["properties"]["comuna"])].append((s, w))

    out = {
        "metric": "IN01",
        "source": "Overture Maps places (release 2026-11-18.0), DTPM GTFS",
        "method": f"mean of 4 groups, s(t)=100 at <={A_MIN} min to 0 at >={B_MIN} min; minutes = straight line x{DETOUR} at {SPEED_KMH} km/h; comuna = building-weighted mean",
        "counts": {k: len(v) for k, v in pts.items()},
        "zones": out_z,
        "comunas": {c: round(sum(v * w for v, w in xs) / sum(w for _, w in xs)) for c, xs in by_c.items()},
    }
    json.dump(out, open(a.out, "w"), separators=(",", ":"))
    print(out["counts"])


if __name__ == "__main__":
    main()
