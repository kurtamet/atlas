"""Point-level context for the free object card (spec §9, M9): no LLM, computed in the browser.

Writes two files, loaded only when an object card opens:
  public/data/obj/pois.json      nearest-service candidates per group as [lon, lat] (5 decimals; metro with name)
  public/data/obj/hazards.json   GeoJSON: official hazard areas (RS07, RS09, RS05) clipped to the
                                 study extent and simplified (~5 m), plus the San Ramón fault trace
Usage: python pipeline/object_context.py <places.parquet> <gtfs_dir> <amenazas_dir> public/data
"""
import csv, json, os, sys
import geopandas as gpd
import pandas as pd
import pyarrow.parquet as pq
from shapely.geometry import box, mapping

places, gtfs, haz_dir, out_dir = sys.argv[1:5]
os.makedirs(f"{out_dir}/obj", exist_ok=True)
GROUPS = {
    "food": {"food_and_beverage_store", "convenience_store", "farmers_market", "market"},
    "pharmacy": {"pharmacy_and_drug_store"},
    "health": {"health_care", "hospital", "outpatient_care_facility", "primary_care_or_general_clinic", "medical_service", "pediatric_clinic"},
    "park": {"park", "public_plaza", "dog_park", "garden"},
    "school": {"preschool", "elementary_school", "middle_school", "high_school"},
}
zones = json.load(open(f"{out_dir}/zones.geojson"))["features"]
xs = [p[0] for f in zones for p in f["geometry"]["coordinates"][0]]; ys = [p[1] for f in zones for p in f["geometry"]["coordinates"][0]]
ext = (min(xs) - 0.02, min(ys) - 0.02, max(xs) + 0.02, max(ys) + 0.02)
inside = lambda x, y: ext[0] <= x <= ext[2] and ext[1] <= y <= ext[3]

pois = {g: [] for g in GROUPS}
for r in pq.read_table(places, columns=["bbox", "basic_category", "confidence"]).to_pylist():
    if (r["confidence"] or 0) < 0.5:
        continue
    for g, cats in GROUPS.items():
        if r["basic_category"] in cats:
            b = r["bbox"]; x, y = (b["xmin"] + b["xmax"]) / 2, (b["ymin"] + b["ymax"]) / 2
            if inside(x, y):
                pois[g].append([round(x, 5), round(y, 5)])

g = gtfs.rstrip("/")
rtype = {r["route_id"]: r["route_type"] for r in csv.DictReader(open(f"{g}/routes.txt", encoding="utf-8-sig"))}
trips = {r["trip_id"]: (r["route_id"], r["service_id"]) for r in csv.DictReader(open(f"{g}/trips.txt", encoding="utf-8-sig"))}
served, metro = set(), set()
for r in csv.DictReader(open(f"{g}/stop_times.txt", encoding="utf-8-sig")):
    rid, sid = trips.get(r["trip_id"], (None, None))
    if rtype.get(rid) == "1":  # metro runs under several service ids (L, LJ, V, S...)
        metro.add(r["stop_id"]); served.add(r["stop_id"])
    elif sid == "L":
        served.add(r["stop_id"])
pois["transport"], pois["metro"] = [], []
seen = set()
for r in csv.DictReader(open(f"{g}/stops.txt", encoding="utf-8-sig")):
    if r["stop_id"] not in served:
        continue
    x, y = float(r["stop_lon"]), float(r["stop_lat"])
    if r["stop_id"] in metro:
        name = r["stop_name"].split(" Dirección ")[0].strip()  # one entry per station, not per direction
        if name not in seen:  # one point per station (platforms share a name)
            seen.add(name); pois["metro"].append([round(x, 5), round(y, 5), name])
    else:
        pois["transport"].append([round(x, 5), round(y, 5)])
json.dump({"source": "Overture Maps places (confidence >= 0.5), DTPM GTFS", "groups": pois}, open(f"{out_dir}/obj/pois.json", "w"), ensure_ascii=False, separators=(",", ":"))
print({k: len(v) for k, v in pois.items()})

# hazard polygons, same composition as pipeline/hazards_prms.py
L = lambda i: gpd.read_file(f"{haz_dir}/l{i}.geojson")[["geometry"]]
l4 = gpd.read_file(f"{haz_dir}/l4.geojson")
HAZ = {
    "RS07": pd.concat([L(8), L(9), L(13), L(16), l4[l4["TIPO_DE_FE"] == "Crecidas fluviales"][["geometry"]]]),
    "RS09": pd.concat([L(11), L(10), l4[l4["TIPO_DE_FE"] == "Flujo de detritos"][["geometry"]]]),
    "RS05": L(14),
}
clip = gpd.GeoSeries([box(*ext)], crs=4326).to_crs(32719).iloc[0]
feats = []
for k, gdf in HAZ.items():
    u = gpd.GeoSeries([gdf.set_crs(4326, allow_override=True).to_crs(32719).buffer(0).union_all().intersection(clip).simplify(5)], crs=32719).to_crs(4326).iloc[0]
    feats.append({"type": "Feature", "properties": {"k": k}, "geometry": mapping(u)})
fault = gpd.read_file(f"{haz_dir}/l3.geojson").to_crs(4326).union_all()
feats.append({"type": "Feature", "properties": {"k": "fault"}, "geometry": mapping(fault)})
txt = json.dumps({"type": "FeatureCollection", "features": feats}, separators=(",", ":"))
import re
txt = re.sub(r"(-?\d+\.\d{5})\d+", r"\1", txt)  # ~1 m precision is plenty for metropolitan-scale maps
open(f"{out_dir}/obj/hazards.json", "w").write(txt)
print("hazards.json", len(txt) // 1024, "KB")
