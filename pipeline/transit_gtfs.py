"""
Transit supply layer IN04 from the DTPM GTFS feed (Red Metropolitana de Movilidad).

    python pipeline/transit_gtfs.py --gtfs path/to/gtfs_dir --zones public/data/zones.geojson \
        --comunas public/data/comunas.geojson --out public/data/transit.json

Indicator: scheduled departures per hour, weekday 07:00-09:00, summed over all stops and
stations within 500 m straight-line distance of the zone center.
This is the spec's explicitly named fallback (M3): straight-line distance, not walking time
over the street network, and schedule-based, not a probability of arrival. Network routing
replaces it once the walking graph is built.

Comuna value = mean of its zones weighted by building count (pipeline/zone_weights.py), i.e. the
supply around a typical building; Censo 2024 population replaces the weights later.
"""
import argparse
import csv
import json
import math
from collections import defaultdict

WINDOW = (7 * 3600, 9 * 3600)
RADIUS_M = 500
SERVICE = "L"  # weekday service in the DTPM calendar


def secs(t: str) -> int:
    h, m, s = (int(x) for x in t.split(":"))
    return h * 3600 + m * 60 + s


def overlap(a0, a1, b0, b1):
    return max(0, min(a1, b1) - max(a0, b0))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--gtfs", required=True)
    ap.add_argument("--zones", required=True)
    ap.add_argument("--comunas", required=True)
    ap.add_argument("--weights", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    g = a.gtfs.rstrip("/")

    trips = {r["trip_id"] for r in csv.DictReader(open(f"{g}/trips.txt", encoding="utf-8-sig")) if r["service_id"] == SERVICE}

    # departures of each trip inside the window
    per_trip = defaultdict(float)
    freq_trips = set()
    for r in csv.DictReader(open(f"{g}/frequencies.txt", encoding="utf-8-sig")):
        if r["trip_id"] not in trips:
            continue
        freq_trips.add(r["trip_id"])
        ov = overlap(secs(r["start_time"]), secs(r["end_time"]), *WINDOW)
        per_trip[r["trip_id"]] += ov / int(r["headway_secs"])

    hours = (WINDOW[1] - WINDOW[0]) / 3600
    per_stop = defaultdict(float)
    for r in csv.DictReader(open(f"{g}/stop_times.txt", encoding="utf-8-sig")):
        tid = r["trip_id"]
        if tid not in trips:
            continue
        if tid in freq_trips:
            per_stop[r["stop_id"]] += per_trip[tid] / hours
        elif r["departure_time"] and WINDOW[0] <= secs(r["departure_time"]) < WINDOW[1]:
            per_stop[r["stop_id"]] += 1 / hours

    stops = []
    for r in csv.DictReader(open(f"{g}/stops.txt", encoding="utf-8-sig")):
        v = per_stop.get(r["stop_id"])
        if v:
            stops.append((float(r["stop_lon"]), float(r["stop_lat"]), v))

    # local equirectangular projection around Santiago (adequate at 500 m scale)
    lat0 = math.radians(-33.45)
    kx, ky = 111_320 * math.cos(lat0), 110_574
    cell = RADIUS_M
    grid = defaultdict(list)
    for x, y, v in stops:
        px, py = x * kx, y * ky
        grid[(int(px // cell), int(py // cell))].append((px, py, v))

    def supply(lon, lat):
        px, py = lon * kx, lat * ky
        cx, cy = int(px // cell), int(py // cell)
        tot = 0.0
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for sx, sy, v in grid.get((cx + dx, cy + dy), ()):
                    if (sx - px) ** 2 + (sy - py) ** 2 <= RADIUS_M ** 2:
                        tot += v
        return tot

    zones = json.load(open(a.zones, encoding="utf-8"))
    weights = json.load(open(a.weights))["weights"]
    out_z, by_comuna = {}, defaultdict(list)
    for f in zones["features"]:
        ring = f["geometry"]["coordinates"][0]
        lon = sum(p[0] for p in ring[:4]) / 4
        lat = sum(p[1] for p in ring[:4]) / 4
        v = round(supply(lon, lat))
        out_z[f["properties"]["id"]] = v
        w = weights.get(f["properties"]["id"], 0)
        if w:
            by_comuna[str(f["properties"]["comuna"])].append((v, w))

    def wmean(xs):
        return sum(v * w for v, w in xs) / sum(w for _, w in xs)

    out = {
        "metric": "IN04",
        "source": "DTPM GTFS (dtpm.cl/index.php/gtfs-vigente)",
        "feed": g.rsplit("/", 1)[-1],
        "method": f"weekday {WINDOW[0]//3600:02d}-{WINDOW[1]//3600:02d}h departures/hour at stops within {RADIUS_M} m straight line; comuna = building-weighted mean of zones",
        "zones": out_z,
        "comunas": {c: round(wmean(v)) for c, v in by_comuna.items()},
    }
    json.dump(out, open(a.out, "w"), separators=(",", ":"))
    vals = sorted(out_z.values())
    print(f"stops with service: {len(stops)}; zones: {len(vals)}; p10/p50/p90 = {vals[len(vals)//10]}/{vals[len(vals)//2]}/{vals[9*len(vals)//10]}")


if __name__ == "__main__":
    main()
