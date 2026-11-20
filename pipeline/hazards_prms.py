"""RS05 / RS07 / RS09: residents living inside official hazard zones of the Santiago metropolitan region.

Source: MINVU SEREMI/SERVIU RM feature service OTRAS_AMENAZAS_RMS (PRMS risk areas plus
geological hazard studies). Following the spec, hazards are kept apart, never summed:
  RS07 flooding   = PRMS recurrently floodable areas + groundwater outcrop + 'Zona Inundación' (alto)
                    + high-hazard river floods + hyperconcentrated flows (Quebrada de Macul type)
  RS09 geological = PRMS mass-movement and collapse areas + high-hazard debris flows
  RS05 seismic    = zones of very poor seismic soil response
Value = % of Censo 2024 residents (manzana centroids) inside the hazard area, per zone and comuna.
Zones without residents have no value. Zone also gets distance to the San Ramón fault (km).

Usage: python pipeline/hazards_prms.py <amenazas_dir> <Manzanas.parquet> public/data
"""
import json, sys
import geopandas as gpd
import pandas as pd

src, man_path, out_dir = sys.argv[1:4]
L = lambda i: gpd.read_file(f"{src}/l{i}.geojson").to_crs(32719)[["geometry"]].assign(geometry=lambda d: d.buffer(0))
l4 = gpd.read_file(f"{src}/l4.geojson").to_crs(32719)
HAZ = {
    "RS07": pd.concat([L(8), L(9), L(13), L(16), l4[l4["TIPO_DE_FE"] == "Crecidas fluviales"][["geometry"]].buffer(0).to_frame("geometry")]),
    "RS09": pd.concat([L(11), L(10), l4[l4["TIPO_DE_FE"] == "Flujo de detritos"][["geometry"]].buffer(0).to_frame("geometry")]),
    "RS05": L(14),
}
fault = gpd.read_file(f"{src}/l3.geojson").to_crs(32719).union_all()

man = gpd.read_parquet(man_path, columns=["n_per", "SHAPE"]).set_geometry("SHAPE")
man = man[man["n_per"].fillna(0) > 0]
pts = gpd.GeoDataFrame({"pop": man["n_per"].values}, geometry=man.geometry.representative_point().values, crs=man.crs).to_crs(32719)
zones = gpd.read_file(f"{out_dir}/zones.geojson")[["id", "comuna", "geometry"]].to_crs(32719)
pts = gpd.sjoin(pts, zones, predicate="within", how="inner").drop(columns="index_right")
for k, g in HAZ.items():
    u = gpd.GeoDataFrame(geometry=[g.geometry.union_all()], crs=32719)
    pts[k] = pts.intersects(u.geometry.iloc[0])

out = {"source": "MINVU RM, OTRAS_AMENAZAS_RMS (PRMS + estudios de amenaza)", "zones": {}, "comunas": {}}
for key, col in (("zones", "id"), ("comunas", "comuna")):
    for i, g in pts.groupby(col):
        p = g["pop"].sum()
        out[key][str(i)] = {k: round(float(100 * g.loc[g[k], "pop"].sum() / p), 1) for k in HAZ}
for z in zones.itertuples():
    if z.id in out["zones"]:
        out["zones"][z.id]["fault_km"] = round(z.geometry.centroid.distance(fault) / 1000, 1)
json.dump(out, open(f"{out_dir}/hazards.json", "w"), separators=(",", ":"))
print(len(out["zones"]), "zones")
for c, v in sorted(out["comunas"].items()):
    print(c, v)
