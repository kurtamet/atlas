"""RS01 recorded violent crime per 100k residents, comuna level, from CEAD (Ministerio de Seguridad Pública).

    python pipeline/crime_cead.py <data-chile/cead/api> public/data

Input: tables saved by pipeline/chile/fetch_cead.py (the site's own "Estadísticas por unidad territorial"
endpoint): monthly rates per 100k ("medida 2") of casos policiales (denuncias + detenciones flagrantes)
for every RM comuna, one file per year and crime family (fam1 = delitos contra la vida o integridad,
fam2 = robos violentos, fam6 = delitos contra la propiedad no violentos), plus all crimes together.

Annual rate = sum of the 12 monthly rates. RS01 = fam1 + fam2 of the latest full year.
These are crimes REPORTED to or detected by the police where they happened, not where victims live:
commercial centres (Santiago, Providencia) get high rates per resident because of their floating population.
"""
import html as H
import json
import os
import re
import sys
import unicodedata

api, out_dir = sys.argv[1:3]


def norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z]", "", s)


def parse(path):
    """{normalized comuna name: annual sum} for the comuna rows (row class formato_4)."""
    doc = open(path, encoding="utf-8", errors="ignore").read()
    rows = {}
    for tr in re.findall(r'<tr class="formato_4[^"]*"[^>]*>(.*?)</tr>', doc, re.S):
        tr = re.sub(r"<!--.*?-->", "", tr, flags=re.S)
        cells = [H.unescape(re.sub(r"<[^>]+>", "", c)).strip() for c in re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)]
        if len(cells) < 13:
            continue
        vals = [float(c.replace(".", "").replace(",", ".")) if c not in ("", "-") else 0.0 for c in cells[1:13]]
        rows[norm(cells[0])] = sum(vals)
    return rows


def table(year, fam=None, medida=2):
    p = os.path.join(api, f"sel1_medida{medida}_{year}" + (f"_fam{fam}" if fam else "") + ".html")
    return parse(p) if os.path.exists(p) else None


comunas = json.load(open(f"{out_dir}/comunas.geojson"))["features"]
years = sorted({m.group(1) for f in os.listdir(api) if (m := re.match(r"sel1_medida2_(\d{4})", f))}, reverse=True)
year, prev = years[0], years[1] if len(years) > 1 else None
violent = [table(year, f) for f in ("1", "2")]
if not all(violent):
    sys.exit(f"family tables for {year} missing: rerun pipeline/chile/fetch_cead.py")
violent_prev = [table(prev, f) for f in ("1", "2")] if prev else [None]
total, prop = table(year), table(year, "6")
count = [table(year, f, medida=1) for f in ("1", "2")]

out = {}
for f in comunas:
    k = norm(f["properties"]["name"])
    if k not in violent[0]:
        print("no CEAD row for", f["properties"]["name"])
        continue
    v = violent[0][k] + violent[1][k]
    rec = {"RS01": round(v)}
    if all(violent_prev):
        p = violent_prev[0][k] + violent_prev[1][k]
        rec["RS01_chg"] = round(100 * (v - p) / p) if p else None
    if total:
        rec["RS01_all"] = round(total[k])
    if prop:
        rec["RS01_prop"] = round(prop[k])
    if all(count):
        rec["RS01_n"] = round(count[0][k] + count[1][k])
    out[str(f["properties"]["code"])] = rec

json.dump({"metric": "RS01", "year": int(year), "prev": int(prev) if prev else None,
           "source": f"CEAD, Ministerio de Seguridad Pública: casos policiales {year} (denuncias + detenciones flagrantes)",
           "comunas": out}, open(f"{out_dir}/crime.json", "w"), ensure_ascii=False, separators=(",", ":"))
print(year, len(out), "of", len(comunas))
for c, r in sorted(out.items(), key=lambda x: -x[1]["RS01"]):
    print(c, r)
