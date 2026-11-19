"""SO01 population density from Censo 2024 manzanas (INE cartography, GeoParquet).

Manzana population is assigned to the ~600 m zone that contains its centroid.
Zone value = gross density (residents / zone area, hab/km²).
Comuna value = population-weighted mean of zone densities, i.e. the density
an average resident of the comuna lives at (empty hills don't dilute it).

Usage: python pipeline/censo_density.py <Manzanas.parquet> public/data/zones.geojson public/data/censo.json
"""
import json, sys
import geopandas as gpd

man_path, zones_path, out_path = sys.argv[1:4]
man = gpd.read_parquet(man_path, columns=["CUT", "n_per", "n_vp", "SHAPE"]).set_geometry("SHAPE")
man = man[man["n_per"].fillna(0) > 0]
pts = gpd.GeoDataFrame(man[["CUT", "n_per", "n_vp"]], geometry=man.geometry.representative_point(), crs=man.crs).to_crs(4326)

zones = gpd.read_file(zones_path)[["id", "comuna", "geometry"]]
zones["km2"] = zones.to_crs(32719).area / 1e6
j = gpd.sjoin(pts, zones, predicate="within", how="inner")
agg = j.groupby("id").agg(pop=("n_per", "sum"), viv=("n_vp", "sum"))
z = zones.set_index("id").join(agg, how="inner")
z["dens"] = z["pop"] / z["km2"]

zone_out = {i: {"SO01": round(r.dens), "pop": int(r["pop"])} for i, r in z.iterrows()}
com_out = {}
for code, g in z.groupby("comuna"):
    p = g["pop"].sum()
    com_out[code] = {"SO01": round((g["dens"] * g["pop"]).sum() / p), "pop": int(p)}

json.dump({"source": "INE Censo 2024, manzanas R13", "zones": zone_out, "comunas": com_out}, open(out_path, "w"), separators=(",", ":"))
print(f"zones {len(zone_out)}, pop matched {int(z['pop'].sum()):,} of {int(man['n_per'].sum()):,}")
for c, v in sorted(com_out.items(), key=lambda x: -x[1]["SO01"]):
    print(c, v)
