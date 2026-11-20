"""RS03 household victimization by violent crime (VHDV), ENUSC 2024 small-area estimates (INE + SPD).

Experimental statistics: comuna-level SAE estimates with 95% interval and estimate type.
No finer level exists, and we don't downscale it (spec: no own disaggregation to blocks).

Usage: python pipeline/enusc_sae.py <tabulados-sae--enusc-2024-vhdv.xlsx> public/data
"""
import json, sys
import openpyxl

xlsx, out_dir = sys.argv[1:3]
codes = {str(f["properties"]["code"]) for f in json.load(open(f"{out_dir}/comunas.geojson"))["features"]}
out = {}
for row in openpyxl.load_workbook(xlsx, data_only=True).active.iter_rows(min_row=4, values_only=True):
    code, name, p, lo, hi, kind, cv = row[:7]
    if code and str(code).strip() in codes and p is not None:
        out[str(code).strip()] = {"RS03": round(p * 100, 1), "RS03_lo": round(lo * 100, 1), "RS03_hi": round(hi * 100, 1), "RS03_kind": str(kind).strip()}
json.dump({"source": "INE/SPD, ENUSC 2024 SAE (estadística experimental)", "comunas": out}, open(f"{out_dir}/enusc.json", "w"), ensure_ascii=False, separators=(",", ":"))
print(len(out), "of", len(codes))
for k, v in sorted(out.items(), key=lambda x: -x[1]["RS03"]):
    print(k, v)
