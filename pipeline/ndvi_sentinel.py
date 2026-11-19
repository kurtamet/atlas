"""EN04 vegetation (NDVI) from one cloud-free Sentinel-2 L2A summer scene (Element84 COGs on AWS).

Scene: 2026-01-17 (S2B), MGRS tiles 19HCD + 19HCC, both in UTM 19S so they share a pixel grid.
NDVI = (B08 - B04) / (B08 + B04) at 10 m; pixels flagged cloud, shadow, water or no-data in the
SCL band (20 m) are dropped. Zone value = mean NDVI of its pixels (window from the zone bbox in UTM).
Comuna value = population-weighted (Censo 2024) mean of zone values: greenery where people live.
Summer scene on purpose: in Santiago's dry summer only irrigated/tree cover stays green.

Usage: python pipeline/ndvi_sentinel.py public/data
"""
import json, os, sys
import numpy as np
import rasterio
from rasterio.windows import from_bounds
from pyproj import Transformer

out_dir = sys.argv[1]
os.environ.setdefault("CURL_CA_BUNDLE", "/root/.ccr/ca-bundle.crt")
os.environ.setdefault("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")
BASE = "https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/19/H/{t}/2026/1/S2B_19H{t}_20260117_0_L2A/{b}.tif"
TILES = ["CD", "CC"]

zones = json.load(open(f"{out_dir}/zones.geojson"))["features"]
censo = json.load(open(f"{out_dir}/censo.json"))
to_utm = Transformer.from_crs(4326, 32719, always_xy=True)
xs, ys = [], []
for f in zones:
    for x, y in f["geometry"]["coordinates"][0]:
        xs.append(x); ys.append(y)
bx0, by0 = to_utm.transform(min(xs), min(ys)); bx1, by1 = to_utm.transform(max(xs), max(ys))
bx0, by0, bx1, by1 = min(bx0, bx1) - 500, min(by0, by1) - 500, max(bx0, bx1) + 500, max(by0, by1) + 500
# snap to the Sentinel-2 10 m grid (tile origins are multiples of 10 m)
bx0, by0, bx1, by1 = (np.floor(np.array([bx0, by0])/10)*10).tolist() + (np.ceil(np.array([bx1, by1])/10)*10).tolist()

# mosaic on a common 10 m grid over the zone extent
W, H = int((bx1 - bx0) / 10), int((by1 - by0) / 10)
ndvi = np.full((H, W), np.nan, dtype=np.float32)
for t in TILES:
    with rasterio.open(BASE.format(t=t, b="B04")) as r4, rasterio.open(BASE.format(t=t, b="B08")) as r8, rasterio.open(BASE.format(t=t, b="SCL")) as rs:
        tb = r4.bounds
        ix0, iy0, ix1, iy1 = max(bx0, tb.left), max(by0, tb.bottom), min(bx1, tb.right), min(by1, tb.top)
        if ix0 >= ix1 or iy0 >= iy1:
            continue
        win = from_bounds(ix0, iy0, ix1, iy1, r4.transform).round_offsets().round_lengths()
        red = r4.read(1, window=win).astype(np.float32); nir = r8.read(1, window=win).astype(np.float32)
        scl = rs.read(1, window=from_bounds(ix0, iy0, ix1, iy1, rs.transform).round_offsets().round_lengths(),
                      out_shape=red.shape, resampling=rasterio.enums.Resampling.nearest)
        v = (nir - red) / np.maximum(nir + red, 1)
        v[np.isin(scl, [0, 1, 3, 6, 8, 9, 10]) | (nir + red == 0)] = np.nan
        wt = r4.window_transform(win)
        c0 = int(round((wt.c - bx0) / 10)); r0 = int(round((by1 - wt.f) / 10))
        h, w = v.shape
        h = min(h, H - r0); w = min(w, W - c0)
        dst = ndvi[r0:r0 + h, c0:c0 + w]
        src = v[:h, :w]
        ndvi[r0:r0 + h, c0:c0 + w] = np.where(np.isnan(dst), src, dst)
        print(t, "read", v.shape)

zone_out = {}
for f in zones:
    ring = f["geometry"]["coordinates"][0]
    ux, uy = to_utm.transform([p[0] for p in ring], [p[1] for p in ring])
    c0, c1 = int((min(ux) - bx0) / 10), int((max(ux) - bx0) / 10)
    r0, r1 = int((by1 - max(uy)) / 10), int((by1 - min(uy)) / 10)
    cell = ndvi[max(r0, 0):r1, max(c0, 0):c1]
    if cell.size and np.isfinite(cell).mean() > 0.5:
        zone_out[f["properties"]["id"]] = round(float(np.nanmean(cell)), 3)

com = {}
for f in zones:
    i = f["properties"]["id"]; pop = censo["zones"].get(i, {}).get("pop", 0)
    if pop and i in zone_out:
        s = com.setdefault(f["properties"]["comuna"], [0.0, 0]); s[0] += zone_out[i] * pop; s[1] += pop
com_out = {k: round(s / p, 3) for k, (s, p) in com.items()}
json.dump({"source": "Sentinel-2 L2A 2026-01-17 (19HCD, 19HCC), Copernicus via Element84 COGs", "zones": zone_out, "comunas": com_out},
          open(f"{out_dir}/ndvi.json", "w"), separators=(",", ":"))
print(len(zone_out), "zones")
for k, v in sorted(com_out.items(), key=lambda x: -x[1]):
    print(k, v)
