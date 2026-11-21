"""
Load the catastro per manzana into Supabase (table catastro_mz, supabase/migrations/0003_catastro.sql).

    NODE_USE_ENV_PROXY=1 python pipeline/catastro_rol_upload.py --dir ~/atlas-data/catastro \
        --comunas public/data/comunas.geojson [--dry]

Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in the environment. Only the comunas of the map
(comunas.geojson) are loaded. Upsert by (sii, mz), so it can be re-run for a new semester.
"""
import argparse
import json
import os
import time
import unicodedata
import urllib.request

import duckdb

UF = 40844.79  # 31-07-2026, avalúos of semester 2026-2
ALIASES = {"SANTIAGO CENTRO": "SANTIAGO", "SANTIAGO SUR": "SANTIAGO", "SANTIAGO OESTE": "SANTIAGO"}


def norm(s):
    s = unicodedata.normalize("NFD", s or "").encode("ascii", "ignore").decode().replace("-", " ")
    return " ".join(s.upper().split())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", required=True)
    ap.add_argument("--comunas", required=True)
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--batch", type=int, default=300)
    a = ap.parse_args()
    cut_by_name = {norm(f["properties"]["name"]): int(f["properties"]["code"]) for f in json.load(open(a.comunas, encoding="utf-8"))["features"]}
    c = duckdb.connect()
    c.create_function("cutof", lambda n: cut_by_name.get(ALIASES.get(n, n), 0), ["VARCHAR"], "INTEGER")
    rows = c.execute(f"""
      select f.code sii, cutof(f.comuna_name) cut, f.mz,
             list(f.pr order by f.pr) pr,
             list(round(g.lon, 6) order by f.pr) lon, list(round(g.lat, 6) order by f.pr) lat,
             string_agg(case g.how when 'exact' then 'e' when 'near' then 'n' when 'manzana' then 'm' else '-' end, '' order by f.pr) how,
             list(f.dir order by f.pr) dir,
             string_agg(coalesce(nullif(f.destino, ''), '-'), '' order by f.pr) ds,
             list(coalesce(f.m2, 0)::int order by f.pr) m2,
             list(coalesce(f.anio, 0)::int order by f.pr) yr,
             list(coalesce(round(f.avaluo / {UF}), 0)::int order by f.pr) av
      from '{a.dir}/facts.parquet' f left join '{a.dir}/rol_geo.parquet' g using (code, mz, pr)
      where cutof(f.comuna_name) > 0
      group by f.code, f.comuna_name, f.mz""").fetchall()
    cols = ["sii", "cut", "mz", "pr", "lon", "lat", "how", "dir", "ds", "m2", "yr", "av"]
    recs = [dict(zip(cols, r)) for r in rows]
    size = sum(len(json.dumps(r)) for r in recs)
    print(f"{len(recs)} manzanas, {sum(len(r['pr']) for r in recs)} rols, ~{size / 1e6:.0f} MB JSON")
    if a.dry:
        return
    url = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/") + "/rest/v1/catastro_mz"
    key = os.environ["SUPABASE_SECRET_KEY"]
    for i in range(0, len(recs), a.batch):
        body = json.dumps(recs[i:i + a.batch]).encode()
        req = urllib.request.Request(url, data=body, method="POST", headers={
            "apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal"})
        for attempt in range(4):
            try:
                urllib.request.urlopen(req, timeout=120).read()
                break
            except Exception as e:
                if attempt == 3:
                    raise
                print("retry", i, e)
                time.sleep(2 ** attempt)
        if i // a.batch % 20 == 0:
            print(f"  {i + len(recs[i:i + a.batch])}/{len(recs)}")
    print("done")


if __name__ == "__main__":
    main()
