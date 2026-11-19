"""
Settlement weights per calculation zone from Overture buildings (theme=buildings).

    python pipeline/zone_weights.py --buildings buildings_stgo.parquet \
        --zones public/data/zones.geojson --out public/data/zone-weights.json

Weight = number of building footprints whose bbox center falls in the zone. It is a proxy
for where people live until Censo 2024 population by manzana is integrated (spec §2.3:
coarse levels describe settled areas, not empty land). Download of the buildings file:
pyarrow dataset on s3://overturemaps-us-west-2/release/<release>/theme=buildings/type=building/
filtered by bbox (see README).
"""
import argparse
import json

import pyarrow.parquet as pq


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--buildings", required=True)
    ap.add_argument("--zones", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    zones = json.load(open(a.zones, encoding="utf-8"))["features"]
    # zones are axis-aligned cells: index them by their lower-left corner
    ring0 = zones[0]["geometry"]["coordinates"][0]
    dx = ring0[1][0] - ring0[0][0]
    dy = ring0[2][1] - ring0[1][1]
    x0 = min(f["geometry"]["coordinates"][0][0][0] for f in zones)
    y0 = min(f["geometry"]["coordinates"][0][0][1] for f in zones)
    key = lambda x, y: (int((x - x0) // dx), int((y - y0) // dy))
    index = {}
    for f in zones:
        lx, ly = f["geometry"]["coordinates"][0][0]
        index[key(lx + dx / 2, ly + dy / 2)] = f["properties"]["id"]

    t = pq.read_table(a.buildings, columns=["bbox"]).column("bbox").combine_chunks()
    xmin, xmax = t.field("xmin").to_numpy(), t.field("xmax").to_numpy()
    ymin, ymax = t.field("ymin").to_numpy(), t.field("ymax").to_numpy()
    counts = {}
    for x, y in zip((xmin + xmax) / 2, (ymin + ymax) / 2):
        zid = index.get(key(x, y))
        if zid:
            counts[zid] = counts.get(zid, 0) + 1
    json.dump({"source": "Overture Maps buildings", "weights": counts}, open(a.out, "w"), separators=(",", ":"))
    print(f"zones with buildings: {len(counts)}/{len(zones)}; buildings matched: {sum(counts.values())}")


if __name__ == "__main__":
    main()
