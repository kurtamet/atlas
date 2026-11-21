"""
Building footprints for the object level, from Overture Maps (OSM + Microsoft/Google ML footprints),
because the OpenStreetMap building layer of the basemap misses a large share of Santiago's houses.

    python pipeline/buildings_tiles.py --release 2026-11-18.0 \
        --download /home/user/atlas-data/buildings_geom_stgo.parquet \
        --out /home/user/atlas-data/buildings-stgo.pmtiles

Step 1 reads s3://overturemaps-us-west-2/release/<release>/theme=buildings/type=building/ (anonymous, pyarrow)
filtered to the bbox of public/data/comunas.geojson. Step 2 writes one zoom level (z15) of vector
tiles, layer "building", with render_height (m) and levels; MapLibre overzooms it up to z18.
The .pmtiles file is uploaded to Supabase Storage (public bucket "tiles") and read with HTTP range requests.
"""
import argparse
import gzip
import json
import math
import os
from collections import defaultdict

import pyarrow.compute as pc
import pyarrow.dataset as ds
import pyarrow.fs as pafs
import pyarrow.parquet as pq
import shapely
from shapely import affinity
import numpy as np
import mapbox_vector_tile
from pmtiles.writer import Writer
from pmtiles.tile import zxy_to_tileid, TileType, Compression

Z = 15
EXTENT = 4096


def bbox_of_comunas(path):
    xs, ys = [], []
    def walk(c):
        if isinstance(c[0], (int, float)):
            xs.append(c[0]); ys.append(c[1])
        else:
            for i in c:
                walk(i)
    for f in json.load(open(path, encoding="utf-8"))["features"]:
        walk(f["geometry"]["coordinates"])
    return min(xs), min(ys), max(xs), max(ys)


def download(release, bbox, out):
    s3 = pafs.S3FileSystem(anonymous=True, region="us-west-2")
    d = ds.dataset(f"overturemaps-us-west-2/release/{release}/theme=buildings/type=building/", filesystem=s3, format="parquet")
    x0, y0, x1, y1 = bbox
    f = lambda k: ds.field("bbox", k)
    flt = (f("xmin") < x1) & (f("xmax") > x0) & (f("ymin") < y1) & (f("ymax") > y0)
    t = d.to_table(columns=["geometry", "height", "num_floors"], filter=flt)
    pq.write_table(t, out)
    print(f"downloaded {t.num_rows} buildings -> {out}")


def to_tile_space(c):
    """lon/lat -> z15 tile coordinates (x right, y down), vectorized"""
    n = 1 << Z
    x = (c[:, 0] + 180.0) / 360.0 * n
    r = np.radians(c[:, 1])
    y = (1.0 - np.log(np.tan(r) + 1.0 / np.cos(r)) / np.pi) / 2.0 * n
    return np.column_stack([x, y])


def build_tiles(src, out):
    t = pq.read_table(src)
    geoms = shapely.from_wkb(t.column("geometry").to_numpy(zero_copy_only=False))
    height = t.column("height").to_pylist()
    floors = t.column("num_floors").to_pylist()
    # project to z15 tile space (x, y in tile units), then bucket by tile
    geoms = shapely.transform(geoms, to_tile_space)
    bounds = shapely.bounds(geoms)
    tiles = defaultdict(list)
    for i, g in enumerate(geoms):
        if g is None or g.is_empty:
            continue
        minx, miny, maxx, maxy = bounds[i]
        for tx in range(int(minx), int(maxx) + 1):
            for ty in range(int(miny), int(maxy) + 1):
                tiles[(tx, ty)].append((i, g))
    print(f"{len(tiles)} tiles at z{Z}")
    w = Writer(open(out, "wb"))
    entries = []
    for (tx, ty), feats in tiles.items():
        clip = shapely.box(tx, ty, tx + 1, ty + 1)
        features = []
        for i, g in feats:
            part = g.intersection(clip) if not clip.contains(g) else g
            if part.is_empty or part.geom_type not in ("Polygon", "MultiPolygon"):
                continue
            # tile units -> 0..EXTENT with y down (mapbox_vector_tile y_coord_down)
            local = affinity.affine_transform(part, [EXTENT, 0, 0, EXTENT, -tx * EXTENT, -ty * EXTENT])
            h = height[i] if height[i] is not None else (floors[i] * 3.0 if floors[i] else None)
            props = {}
            if h is not None:
                props["render_height"] = round(float(h), 1)
            if floors[i]:
                props["levels"] = int(floors[i])
            features.append({"geometry": local.wkb, "properties": props, "id": i + 1})
        if not features:
            continue
        data = mapbox_vector_tile.encode([{"name": "building", "features": features}], default_options={"extents": EXTENT, "y_coord_down": True, "quantize_bounds": None})
        entries.append((zxy_to_tileid(Z, tx, ty), gzip.compress(data)))
    for tid, data in sorted(entries):
        w.write_tile(tid, data)
    xs = [k[0] for k in tiles]; ys = [k[1] for k in tiles]
    tox = lambda x: x / (1 << Z) * 360.0 - 180.0
    toy = lambda y: math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / (1 << Z)))))
    w.finalize(
        {"tile_type": TileType.MVT, "tile_compression": Compression.GZIP, "min_zoom": Z, "max_zoom": Z,
         "min_lon_e7": int(tox(min(xs)) * 1e7), "min_lat_e7": int(toy(max(ys) + 1) * 1e7),
         "max_lon_e7": int(tox(max(xs) + 1) * 1e7), "max_lat_e7": int(toy(min(ys)) * 1e7),
         "center_zoom": Z, "center_lon_e7": int(-70.62 * 1e7), "center_lat_e7": int(-33.46 * 1e7)},
        {"name": "atlas-buildings-stgo", "attribution": "© Overture Maps Foundation, OpenStreetMap, Microsoft, Google",
         "vector_layers": [{"id": "building", "fields": {"render_height": "Number", "levels": "Number"}, "minzoom": Z, "maxzoom": Z}]},
    )
    print(f"wrote {len(entries)} tiles -> {out} ({os.path.getsize(out) / 1e6:.1f} MB)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--release", default="2026-11-18.0")
    ap.add_argument("--comunas", default="public/data/comunas.geojson")
    ap.add_argument("--download", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    if not os.path.exists(a.download):
        download(a.release, bbox_of_comunas(a.comunas), a.download)
    build_tiles(a.download, a.out)


if __name__ == "__main__":
    main()
