"""
Attach geolocated SII catastro rols to Overture building footprints and aggregate per building.

    python pipeline/catastro_buildings.py --dir ~/atlas-data/catastro --buildings ~/atlas-data/buildings_geom_stgo.parquet \
        --uf 40844.79

Inputs in --dir: facts.parquet (catastro_sii.py --facts), deals.parquet (--deals), rol_geo.parquet (catastro_geo.py).
A rol located by address ('exact' or 'near') goes to the footprint that contains its point, else to the nearest
footprint within ~25 m. Rols placed only at their manzana are left out. Output bld_facts.parquet, keyed by bid =
row index in --buildings (the feature id in buildings-stgo.pmtiles minus 1). --uf: UF value on the avalúo date
(31-07-2026 for semester 2026-2).
"""
import argparse

import duckdb
import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq
import shapely


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", required=True)
    ap.add_argument("--buildings", required=True)
    ap.add_argument("--uf", type=float, default=40844.79)
    a = ap.parse_args()
    c = duckdb.connect()
    pts = c.execute(f"select code, mz, pr, lon, lat from '{a.dir}/rol_geo.parquet' where how in ('exact', 'near')").fetchnumpy()
    geoms = shapely.from_wkb(pq.read_table(a.buildings, columns=["geometry"]).column("geometry").to_numpy(zero_copy_only=False))
    tree = shapely.STRtree(geoms)
    P = shapely.points(pts["lon"], pts["lat"])
    inside = tree.query(P, predicate="within")
    bid = np.full(len(P), -1, dtype=np.int64)
    bid[inside[0]] = inside[1]
    miss = np.where(bid < 0)[0]
    near = tree.query_nearest(P[miss], max_distance=0.00025, all_matches=False)
    bid[miss[near[0]]] = near[1]
    print(f"rols on a footprint: {(bid >= 0).sum()} of {len(P)}")
    rb = pa.table({"code": pts["code"], "mz": pts["mz"], "pr": pts["pr"], "bid": bid})
    c.register("rb", rb)
    c.execute(f"""copy (
      with r as (select f.*, rb.bid from '{a.dir}/facts.parquet' f join rb using (code, mz, pr) where rb.bid >= 0),
           d as (select rb.bid, count(*) nd, median(ufm2) ufm2 from '{a.dir}/deals.parquet' dl join rb using (code, mz, pr)
                 where rb.bid >= 0 group by 1)
      select r.bid, count(*) nr, count(*) filter (where destino = 'H') u,
             mode(destino) filter (where destino not in ('Z', 'L')) ds,
             median(m2) filter (where destino not in ('Z', 'L')) m2u,
             median(anio) filter (where anio > 1800) yr,
             median(avaluo / {a.uf}) filter (where destino not in ('Z', 'L')) av,
             any_value(d.nd) nd, any_value(d.ufm2) ufm2
      from r left join d using (bid) group by r.bid) to '{a.dir}/bld_facts.parquet' (format parquet)""")
    print(c.execute(f"select count(*), count(ufm2) from '{a.dir}/bld_facts.parquet'").fetchall())


if __name__ == "__main__":
    main()
