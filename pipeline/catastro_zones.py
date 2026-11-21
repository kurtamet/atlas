"""
EC01 per calculation zone: EC01 deals (catastro_sii.py --deals) located by catastro_geo.py, median per zone.

    python pipeline/catastro_zones.py --dir ~/atlas-data/catastro --zones public/data/zones.geojson --value public/data/value.json

Adds "zones" (median UF/m²) and "zone_n" (deals) to value.json for zones with at least MIN_DEALS deals.
"""
import argparse
import json
from collections import defaultdict

import duckdb
import numpy as np
import shapely

MIN_DEALS = 5


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", required=True)
    ap.add_argument("--zones", required=True)
    ap.add_argument("--value", required=True)
    a = ap.parse_args()
    d = duckdb.connect().execute(f"""select g.lon, g.lat, dl.ufm2 from '{a.dir}/deals.parquet' dl
        join '{a.dir}/rol_geo.parquet' g using (code, mz, pr) where g.lon is not null""").fetchnumpy()
    feats = json.load(open(a.zones, encoding="utf-8"))["features"]
    tree = shapely.STRtree([shapely.geometry.shape(f["geometry"]) for f in feats])
    q = tree.query(shapely.points(d["lon"], d["lat"]), predicate="within")
    acc = defaultdict(list)
    for pi, gi in zip(*q):
        acc[feats[gi]["properties"]["id"]].append(d["ufm2"][pi])
    keep = sorted(k for k, v in acc.items() if len(v) >= MIN_DEALS)
    v = json.load(open(a.value, encoding="utf-8"))
    v["zones"] = {k: round(float(np.median(acc[k])), 1) for k in keep}
    v["zone_n"] = {k: len(acc[k]) for k in keep}
    v["method_zones"] = f"deals located by address (pipeline/catastro_geo.py); median per zone with >= {MIN_DEALS} deals"
    json.dump(v, open(a.value, "w", encoding="utf-8"), ensure_ascii=False, indent=1, sort_keys=True)
    print(f"zones with EC01: {len(keep)} of {len(feats)} (deals located: {len(d['lon'])}, in a zone: {len(q[0])})")


if __name__ == "__main__":
    main()
