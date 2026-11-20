"""CL01 hot days and CL03 annual precipitation per comuna from ARClim (MMA / CR2).

ARClim API, comunas layer, historical period 1980-2010 ("present") plus the SSP2-4.5 change to
2035-2065 ("delta") for the card. Comuna-level model data (CR2MET-based downscaling); no
zone-level value: the source resolution is ~5 km, so we don't pretend finer detail.

Usage: python pipeline/climate_arclim.py public/data
"""
import json, sys, urllib.parse, urllib.request

out_dir = sys.argv[1]
ATTR = ["$CLIMA$hot_days$annual$present", "$CLIMA$hot_days$annual$delta$ssp245",
        "$CLIMA$pr_sum$annual$present", "$CLIMA$pr_sum$annual$delta$ssp245"]
url = "https://arclim.mma.gob.cl/api/datos/comunas/json/?" + urllib.parse.urlencode({"attributes": ",".join(["NOM_COMUNA"] + ATTR)})
d = json.load(urllib.request.urlopen(url, timeout=120))["data"]
codes = {str(f["properties"]["code"]) for f in json.load(open(f"{out_dir}/comunas.geojson"))["features"]}
out = {}
for code, row in zip(d["index"], d["values"]):
    if code in codes:
        r = dict(zip(d["columns"], row))
        out[code] = {"CL01": round(r[ATTR[0]], 1), "CL01_d": round(r[ATTR[1]], 1),
                     "CL03": round(r[ATTR[2]]), "CL03_d": round(r[ATTR[3]], 1)}
json.dump({"source": "ARClim (MMA, CR2) 1980-2010 and SSP2-4.5 2035-2065", "comunas": out}, open(f"{out_dir}/climate.json", "w"), separators=(",", ":"))
print(len(out), "of", len(codes))
for k, v in sorted(out.items()):
    print(k, v)
