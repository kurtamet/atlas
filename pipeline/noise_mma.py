"""EN03 road-traffic noise from the MMA Gran Santiago Urbano 2023 noise map (published April 2024).

MMA publishes the day map (Ld) only as colored web tiles (z12, ~30 m pixels) plus per-comuna
exposure counts (residents above 65 dBA day / 55 dBA night). We decode tile colors back to the
legend's 5 dB classes. Buildings are holes in the map and carriageways are >=75 dBA strokes,
so a zone's value is the median level of the open space inside blocks (pixels < 75 dBA).

Zone value  = mean class midpoint (dBA Ld) of non-road pixels in the zone (>=40 pixels).
Comuna value = population-weighted (Censo 2024) mean of zone values.
Comuna card  = official MMA share of residents above 65 dBA day / 55 dBA night.

Usage: python pipeline/noise_mma.py <limites_comunales_v2.js> <tile_cache_dir> public/data
"""
import io, json, math, os, sys, unicodedata, urllib.request
import numpy as np
from PIL import Image

limites_path, cache, out_dir = sys.argv[1:4]
TILE = "https://ruido.mma.gob.cl/wp-content/mapas/gsu_2024/data/01_Ld/12/{x}/{y}.png"
Z = 12
# legend classes (dBA) and their colors as rendered in the tiles
CLASSES = [(33, (180, 216, 178)), (37.5, (127, 178, 23)), (42.5, (0, 102, 80)), (47.5, (232, 242, 68)),
           (52.5, (163, 116, 2)), (57.5, (254, 137, 0)), (62.5, (221, 0, 0)), (67.5, (152, 0, 0)),
           (72.5, (138, 76, 143)), (77.5, (0, 86, 195)), (82, (0, 90, 155))]
PAL = np.array([c for _, c in CLASSES], dtype=float)
MID = np.array([m for m, _ in CLASSES])

def tile_xy(lon, lat):
    n = 2 ** Z
    x = (lon + 180) / 360 * n
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    return x, y

os.makedirs(cache, exist_ok=True)
tiles = {}
def tile(tx, ty):
    if (tx, ty) not in tiles:
        p = f"{cache}/{tx}_{ty}.png"
        if not os.path.exists(p):
            try:
                data = urllib.request.urlopen(TILE.format(x=tx, y=ty), timeout=30).read()
            except Exception:
                data = b""
            open(p, "wb").write(data)
        raw = open(p, "rb").read()
        if not raw:
            tiles[(tx, ty)] = None
        else:
            a = np.asarray(Image.open(io.BytesIO(raw)).convert("RGBA")).astype(float)
            d = ((a[..., None, :3] - PAL) ** 2).sum(-1)
            cls = MID[d.argmin(-1)]
            cls[(a[..., 3] < 100) | (d.min(-1) > 60 ** 2)] = np.nan
            tiles[(tx, ty)] = cls
    return tiles[(tx, ty)]

zones = json.load(open(f"{out_dir}/zones.geojson"))
censo = json.load(open(f"{out_dir}/censo.json"))
cells = []
for f in zones["features"]:
    xs = [c[0] for c in f["geometry"]["coordinates"][0]]; ys = [c[1] for c in f["geometry"]["coordinates"][0]]
    cells.append((min(xs), min(ys), max(xs), max(ys), f["properties"]["id"], f["properties"]["comuna"]))
vals = {}
for (x1, y1, x2, y2, zid, _) in cells:
    fx1, fy1 = tile_xy(x1, y2); fx2, fy2 = tile_xy(x2, y1)
    out = []
    for px in range(int(fx1 * 256), int(fx2 * 256)):
        for py in range(int(fy1 * 256), int(fy2 * 256)):
            tl = tile(px // 256, py // 256)
            if tl is None:
                continue
            v = tl[py % 256, px % 256]
            # road carriageways are drawn as >=75 dBA strokes; we describe the blocks people live in
            if not np.isnan(v) and v < 75:
                out.append(v)
    if out:
        vals[zid] = out
zone_out = {i: round(float(np.mean(v)), 1) for i, v in vals.items() if len(v) >= 40}
com = {}
for i, v in zone_out.items():
    pop = censo["zones"].get(i, {}).get("pop", 0)
    if pop:
        code = next(c[5] for c in cells if c[4] == i)
        s = com.setdefault(code, [0.0, 0])
        s[0] += v * pop; s[1] += pop
com_out = {k: {"EN03": round(s / p, 1)} for k, (s, p) in com.items()}

# official exposure shares, matched by normalized comuna name
norm = lambda s: unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().upper().strip()
comunas = json.load(open(f"{out_dir}/comunas.geojson"))
by_name = {norm(f["properties"]["name"]): str(f["properties"]["code"]) for f in comunas["features"]}
lim = json.loads(open(limites_path, encoding="utf-8").read().split("=", 1)[1].strip().rstrip(";"))
for f in lim["features"]:
    p = f["properties"]; code = by_name.get(norm(p["COM"]))
    if code and code in com_out:
        com_out[code].update(day65=p["P_DIA"], night55=p["P_NOCHE"])

json.dump({"source": "MMA Mapa de Ruido Gran Santiago Urbano 2023 (Ld tiles + exposure by comuna)", "zones": zone_out, "comunas": com_out},
          open(f"{out_dir}/noise.json", "w"), separators=(",", ":"))
print(f"tiles {sum(v is not None for v in tiles.values())}/{len(tiles)}, zones {len(zone_out)}, comunas {len(com_out)}")
for k, v in sorted(com_out.items(), key=lambda x: -x[1]["EN03"]):
    print(k, v)
