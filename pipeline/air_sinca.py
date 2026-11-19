"""EN01 annual PM2.5 per comuna from SINCA (MMA) monitoring stations, Región Metropolitana.

Station value: mean of daily PM2.5 (validated, else preliminary) per calendar year 2023-2025,
kept only with >= 75% of days; the layer uses the mean of available years.
Comuna value: inverse-distance-squared interpolation from the ~10 stations to the comuna's
population-weighted centre (Censo zones). With so few stations this is a coarse surface:
the card names the nearest station and its own measured value.

Usage: python pipeline/air_sinca.py <sinca_dir> public/data
(raw files come from pipeline/chile/fetch_sinca.py, run from Chile)
"""
import glob, json, math, os, sys

src, out_dir = sys.argv[1:3]
meta = {s["key"]: s for s in json.load(open(f"{src}/stations.json")) if "Metropolitana" in str(s.get("region", ""))}
stations = {}
for path in sorted(glob.glob(f"{src}/D*_PM25_daily.csv")):
    key = os.path.basename(path).split("_")[0]
    years = {}
    for ln in open(path, encoding="latin-1").read().splitlines()[1:]:
        c = ln.split(";")
        if len(c) < 4:
            continue
        v = next((x for x in c[2:5] if x.strip()), None)
        if v is None:
            continue
        try:
            years.setdefault("20" + c[0][:2], []).append(float(v.replace(",", ".")))
        except ValueError:
            pass
    annual = {y: round(sum(v) / len(v), 1) for y, v in years.items() if len(v) >= 0.75 * 365}
    if annual and key in meta:
        m = meta[key]
        stations[key] = {"name": m["nombre"].replace(" (Acreditada)", ""), "lon": m["longitud"], "lat": m["latitud"],
                         "annual": annual, "mean": round(sum(annual.values()) / len(annual), 1)}
print({k: (v["name"], v["annual"]) for k, v in stations.items()})

zones = json.load(open(f"{out_dir}/zones.geojson"))["features"]
censo = json.load(open(f"{out_dir}/censo.json"))["zones"]
cent = {}
for f in zones:
    pop = censo.get(f["properties"]["id"], {}).get("pop", 0)
    if not pop:
        continue
    ring = f["geometry"]["coordinates"][0]
    x, y = sum(p[0] for p in ring[:4]) / 4, sum(p[1] for p in ring[:4]) / 4
    s = cent.setdefault(f["properties"]["comuna"], [0.0, 0.0, 0])
    s[0] += x * pop; s[1] += y * pop; s[2] += pop
kx = 111_320 * math.cos(math.radians(-33.45))
out = {}
for code, (sx, sy, p) in cent.items():
    x, y = sx / p, sy / p
    num = den = 0.0
    near, nd = None, 1e18
    for k, s in stations.items():
        d = math.hypot((s["lon"] - x) * kx, (s["lat"] - y) * 110_574)
        if d < nd:
            near, nd = k, d
        w = 1 / max(d, 500) ** 2
        num += w * s["mean"]; den += w
    out[code] = {"EN01": round(num / den, 1), "EN01_st": stations[near]["name"], "EN01_stv": stations[near]["mean"], "EN01_km": round(nd / 1000, 1)}
json.dump({"source": "SINCA (MMA), PM2.5 daily 2023-2025, IDW to comunas", "stations": stations, "comunas": out},
          open(f"{out_dir}/air.json", "w"), ensure_ascii=False, separators=(",", ":"))
for k, v in sorted(out.items(), key=lambda x: -x[1]["EN01"]):
    print(k, v)
