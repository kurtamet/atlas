"""
Connectivity layer IN07 (mobile and fixed internet), zone and comuna level. Research draft.

    python pipeline/connectivity_ookla.py --year 2026 --quarter 3 \
        --zones public/data/zones.geojson --weights public/data/zone-weights.json \
        --out ../atlas-data/connectivity.json

Source: Ookla Speedtest Open Data (s3://ookla-open-data, anonymous read, us-west-2):
quarterly aggregates of user-initiated speed tests on ~610 m web-mercator tiles (zoom 16).
Indicators per zone, separately for mobile and fixed: test-weighted mean download and upload
(Mbps), mean latency (ms), number of tests and devices. Tiles are assigned to the zone that
contains the tile centre. Zones with fewer than MIN_TESTS tests are left empty: "no data",
not "no coverage". Comuna = building-weighted mean of zones (pipeline/zone_weights.py).

It measures the speed people actually got in tests, not the operator's declared coverage, and
tests are biased toward places and people that run them.

LICENCE: Ookla open data is CC BY-NC-SA 4.0 (non-commercial). Do not publish this layer on the
paid product until there is a commercial licence from Ookla, or switch the input to SUBTEL
coverage/statistics (official, Chile-side downloader, see docs/ROADMAP.md).
"""
import argparse
import json
from collections import defaultdict

import pyarrow.compute as pc
import pyarrow.fs as pafs
import pyarrow.parquet as pq

BUCKET = "ookla-open-data/parquet/performance"
BBOX = (-71.75, -34.30, -69.75, -32.90)  # Región Metropolitana, generous
MIN_TESTS = 10
COLS = ["tile_x", "tile_y", "avg_d_kbps", "avg_u_kbps", "avg_lat_ms", "tests", "devices"]


def read_tiles(fs, kind, year, quarter):
    month = (quarter - 1) * 3 + 1
    path = f"{BUCKET}/type={kind}/year={year}/quarter={quarter}/{year}-{month:02d}-01_performance_{kind}_tiles.parquet"
    f = pq.ParquetFile(path, filesystem=fs)
    rows = []
    for i in range(f.metadata.num_row_groups):
        t = f.read_row_group(i, columns=COLS)
        m = pc.and_(pc.and_(pc.greater_equal(t["tile_x"], BBOX[0]), pc.less_equal(t["tile_x"], BBOX[2])),
                    pc.and_(pc.greater_equal(t["tile_y"], BBOX[1]), pc.less_equal(t["tile_y"], BBOX[3])))
        rows += t.filter(m).to_pylist()
    return path, rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int, required=True)
    ap.add_argument("--quarter", type=int, required=True)
    ap.add_argument("--zones", required=True)
    ap.add_argument("--weights", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    zones = json.load(open(a.zones, encoding="utf-8"))["features"]
    weights = json.load(open(a.weights))["weights"]
    cell = 0.01
    index = defaultdict(list)
    for f in zones:
        ring = f["geometry"]["coordinates"][0]
        xs, ys = [p[0] for p in ring], [p[1] for p in ring]
        box = (min(xs), min(ys), max(xs), max(ys), f["properties"]["id"], str(f["properties"]["comuna"]))
        for gx in range(int(box[0] // cell), int(box[2] // cell) + 1):
            for gy in range(int(box[1] // cell), int(box[3] // cell) + 1):
                index[(gx, gy)].append(box)

    def zone_of(x, y):
        for b in index.get((int(x // cell), int(y // cell)), ()):
            if b[0] <= x < b[2] and b[1] <= y < b[3]:
                return b
        return None

    fs = pafs.S3FileSystem(anonymous=True, region="us-west-2")
    out = {
        "metric": "IN07",
        "source": "Ookla Speedtest Open Data (CC BY-NC-SA 4.0)",
        "period": f"{a.year}-Q{a.quarter}",
        "method": f"test-weighted mean per ~600 m zone (tile centre in zone), min {MIN_TESTS} tests; comuna = building-weighted mean of zones",
        "licence_note": "non-commercial; not for the paid product without an Ookla licence",
    }
    for kind in ("mobile", "fixed"):
        path, rows = read_tiles(fs, kind, a.year, a.quarter)
        acc = defaultdict(lambda: [0, 0, 0, 0, 0, None])  # tests, d*t, u*t, lat*t, devices, comuna
        for r in rows:
            b = zone_of(r["tile_x"], r["tile_y"])
            if not b:
                continue
            z = acc[b[4]]
            t = r["tests"]
            z[0] += t; z[1] += r["avg_d_kbps"] * t; z[2] += r["avg_u_kbps"] * t; z[3] += r["avg_lat_ms"] * t
            z[4] += r["devices"]; z[5] = b[5]
        zout, by_c = {}, defaultdict(list)
        for zid, (t, d, u, lat, dev, com) in acc.items():
            if t < MIN_TESTS:
                continue
            rec = {"down": round(d / t / 1000, 1), "up": round(u / t / 1000, 1), "lat": round(lat / t), "tests": t, "devices": dev}
            zout[zid] = rec
            w = weights.get(zid, 0)
            if w:
                by_c[com].append((rec, w))
        cout = {}
        for com, xs in by_c.items():
            sw = sum(w for _, w in xs)
            cout[com] = {k: round(sum(r[k] * w for r, w in xs) / sw, 1) for k in ("down", "up", "lat")}
        out[kind] = {"file": path, "zones": zout, "comunas": cout}
        downs = sorted(r["down"] for r in zout.values())
        if downs:
            print(f"{kind}: tiles in bbox {len(rows)}; zones with data {len(downs)}/{len(zones)}; "
                  f"download Mbps p10/p50/p90 = {downs[len(downs)//10]}/{downs[len(downs)//2]}/{downs[9*len(downs)//10]}")
    json.dump(out, open(a.out, "w"), separators=(",", ":"))


if __name__ == "__main__":
    main()
