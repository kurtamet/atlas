"""
Prices by property type from SII F2890 deals + SII catastro destino: apartments, houses, offices, retail,
industrial, parking, storage and land. Used by the object card and the paid report to value the unit
the user picked with a benchmark of its own type (EC01 stays the homes-only map layer).

    python pipeline/catastro_types.py --raw ~/atlas-data/catastro/raw --f2890db ~/atlas-data/f2890.duckdb \
        --uf pipeline/uf_daily.csv --comunas public/data/comunas.geojson --zones public/data/zones.geojson \
        --mz ~/atlas-data/catastro_mz.jsonl --out public/data/value-types.json

--mz: the catastro_mz table (supabase/migrations/0003_catastro.sql) exported as JSON lines; it gives the
location of each rol, so deals can be counted per calculation zone.

Method:
- Deals as in catastro_sii.py: F2890 rows grouped by comuna + dates + amounts, <= 5 rols, deeds in the window.
- The "main" rol of a deal is its only rol whose destino is not parking (Z) or storage (L); deals with two or
  more main rols are dropped (mixed or block sales). Parking and storage sold with it stay in the price.
- Type of the main rol: H split into apartments (address with a unit: DP/DEPTO/DPTO) and houses; O offices;
  C retail; I industrial / warehouses; W land (UF per land m²). A deal of a single Z or a single L
  rol and nothing else gives a price per parking space / storage unit.
- UF/m² = deal UF / built m² of the main rol (land m² for W), within per-type sanity bounds; median, p25, p75
  per comuna (>= MIN_C deals), per zone (>= MIN_Z deals, apartments, houses, offices, retail) and for the
  whole region.
"""
import argparse
import json
import unicodedata
from collections import defaultdict

import duckdb
import numpy as np
import shapely

MAX_ROLS = 5
MIN_C, MIN_Z, MIN_RM = 8, 6, 20
OVERRIDES = {14203: "TIL TIL", 14501: "TALAGANTE", 14604: "ALHUE", 14605: "SAN PEDRO", 16302: "PIRQUE", 16402: "CALERA DE TANGO"}
ALIASES = {"SANTIAGO CENTRO": "SANTIAGO", "SANTIAGO SUR": "SANTIAGO", "SANTIAGO OESTE": "SANTIAGO", "TIL-TIL": "TIL TIL"}
# type -> (unit of the price, min area, max area, min UF/unit, max UF/unit)
TYPES = {
    "Hd": ("m2", 15, 600, 5, 500),
    "Hc": ("m2", 25, 1500, 3, 500),
    "O": ("m2", 10, 5000, 5, 600),
    "C": ("m2", 8, 5000, 3, 800),
    "I": ("m2", 50, 50000, 1, 300),
    "W": ("land", 100, 200000, 0.05, 200),
    "Z": ("unit", 0, 0, 50, 6000),
    "L": ("unit", 0, 0, 20, 3000),
}
ZONE_TYPES = {"Hd", "Hc", "O", "C"}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", s or "").encode("ascii", "ignore").decode().replace("-", " ")
    return " ".join(s.upper().split())


def stats(v):
    v = np.asarray(v, dtype=float)
    return {"n": int(len(v)), "med": round(float(np.median(v)), 1), "p25": round(float(np.quantile(v, 0.25)), 1), "p75": round(float(np.quantile(v, 0.75)), 1)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", required=True)
    ap.add_argument("--f2890db", required=True)
    ap.add_argument("--uf", required=True)
    ap.add_argument("--comunas", required=True)
    ap.add_argument("--zones", required=True)
    ap.add_argument("--mz", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--from", dest="date_from", default="20241001")
    ap.add_argument("--to", dest="date_to", default="20260930")
    a = ap.parse_args()

    cut_by_name = {norm(f["properties"]["name"]): str(f["properties"]["code"]) for f in json.load(open(a.comunas, encoding="utf-8"))["features"]}
    con = duckdb.connect()
    con.execute(f"attach '{a.f2890db}' as f (read_only)")
    rd = "delim='|', header=false, encoding='latin-1', all_varchar=true, quote='', null_padding=true"
    con.execute(f"""create table n as select column00::int code, column01::int mz, column02::int pr, trim(column03) dir,
        trim(column06) destino, try_cast(column14 as int) land from read_csv('{a.raw}/BRTMPCATASN_*', {rd})""")
    con.execute(f"""create table nl as select column00::int code, column01::int mz, column02::int pr, try_cast(column07 as int) sup
        from read_csv('{a.raw}/BRTMPCATASNL_*', {rd})""")
    con.execute(r"""create table rol as select n.code, n.mz, n.pr, n.land, b.m2,
        case when n.destino = 'H' and regexp_matches(n.dir, '\b(DP|DEPTO|DPTO|DEP)\b') then 'Hd'
             when n.destino = 'H' then 'Hc' else n.destino end t
      from n left join (select code, mz, pr, sum(sup) m2 from nl group by 1, 2, 3) b using (code, mz, pr)""")

    con.create_function("norm", lambda s: norm(s), ["VARCHAR"], "VARCHAR")
    con.execute("create table fk as select distinct norm(COMUNA) comuna, try_cast(MANZANA as int) mz, try_cast(PREDIO as int) pr from f.raw where FI >= '20240101'")
    best = con.execute("""select code, arg_max(comuna, hits) from (select n.code, fk.comuna, count(*) hits
        from fk join (select distinct code, mz, pr from n) n using (mz, pr) group by 1, 2) group by code""").fetchall()
    con.execute("create table codes (code int, fname varchar, cut varchar)")
    con.executemany("insert into codes values (?, ?, ?)", [(c, OVERRIDES.get(c, nm), cut_by_name.get(ALIASES.get(OVERRIDES.get(c, nm), OVERRIDES.get(c, nm)))) for c, nm in best])

    con.execute(f"create table ufd as select cast(date as varchar) d, uf val from read_csv('{a.uf}', header=true, columns={{'date':'VARCHAR','uf':'DOUBLE'}})")
    con.execute(f"""create table deals as
      select row_number() over () deal, norm(COMUNA) fname, any_value(FE) fe,
             coalesce(any_value(try_cast(r.UF as double)), any_value(try_cast(r.PESOS as double)) / any_value(ufd.val)) price_uf,
             list({{'mz': try_cast(MANZANA as int), 'pr': try_cast(PREDIO as int)}}) rols
      from f.raw r left join ufd on ufd.d = r.FE
      where FE between '{a.date_from}' and '{a.date_to}' and (r.PESOS is not null or r.UF is not null)
      group by COMUNA, FI, FE, r.PESOS, r.UF having count(*) <= {MAX_ROLS}""")
    con.execute("""create table dr as select d.deal, d.price_uf, c.code, c.cut, r.mz, r.pr, r.t, r.m2, r.land
      from deals d, unnest(d.rols) u(x) join codes c on c.fname = d.fname join rol r on r.code = c.code and r.mz = u.x.mz and r.pr = u.x.pr""")
    con.execute("""create table typed as select deal, any_value(price_uf) price_uf, any_value(cut) cut, count(*) nr,
        count(*) filter (where t not in ('Z', 'L')) nmain,
        any_value(t) filter (where t not in ('Z', 'L')) mt, any_value(code) filter (where t not in ('Z', 'L')) mcode,
        any_value(mz) filter (where t not in ('Z', 'L')) mmz, any_value(pr) filter (where t not in ('Z', 'L')) mpr,
        any_value(m2) filter (where t not in ('Z', 'L')) mm2, any_value(land) filter (where t not in ('Z', 'L')) mland,
        any_value(t) ta, any_value(code) acode, any_value(mz) amz, any_value(pr) apr
      from dr group by deal""")
    rows = con.execute("""select case when nmain = 1 then mt when nr = 1 then ta end t, cut, price_uf,
        case when nmain = 1 and mt = 'W' then mland when nmain = 1 then mm2 end area,
        coalesce(mcode, acode) code, coalesce(mmz, amz) mz, coalesce(mpr, apr) pr
      from typed where nmain = 1 or (nr = 1 and ta in ('Z', 'L'))""").fetchall()

    # rol locations from catastro_mz (exact or nearby address only)
    loc = {}
    for line in open(a.mz, encoding="utf-8"):
        r = json.loads(line)
        for i, p in enumerate(r["pr"]):
            if r["how"][i] in "en" and r["lon"][i] is not None:
                loc[(r["sii"], r["mz"], p)] = (r["lon"][i], r["lat"][i])
    zfeats = json.load(open(a.zones, encoding="utf-8"))["features"]
    ztree = shapely.STRtree([shapely.geometry.shape(f["geometry"]) for f in zfeats])

    by_c, by_z, by_rm = defaultdict(list), defaultdict(list), defaultdict(list)
    pts, keys = [], []
    for t, cut, price, area, code, mz, pr in rows:
        if t not in TYPES or price is None or not cut:
            continue
        unit, amin, amax, vmin, vmax = TYPES[t]
        if unit == "unit":
            v = price
        else:
            if not area or not (amin <= area <= amax):
                continue
            v = price / area
        if not (vmin <= v <= vmax):
            continue
        by_c[(t, cut)].append(v)
        by_rm[t].append(v)
        if t in ZONE_TYPES and (code, mz, pr) in loc:
            pts.append(loc[(code, mz, pr)])
            keys.append((t, v))
    if pts:
        q = ztree.query(shapely.points(np.array(pts)), predicate="within")
        for pi, gi in zip(*q):
            t, v = keys[pi]
            by_z[(t, zfeats[gi]["properties"]["id"])].append(v)

    out = {
        "source": "SII F2890 transactions + SII Detalle Catastral 2026-2 (destino, built and land m²)",
        "period": [a.date_from, a.date_to],
        "method": __doc__.split("Method:")[1].strip(),
        "types": {},
    }
    for t, (unit, *_r) in TYPES.items():
        e = {"unit": unit, "rm": stats(by_rm[t]) if len(by_rm[t]) >= MIN_RM else None, "comunas": {}, "zones": {}}
        for (tt, cut), v in by_c.items():
            if tt == t and len(v) >= MIN_C:
                e["comunas"][cut] = stats(v)
        for (tt, z), v in by_z.items():
            if tt == t and len(v) >= MIN_Z:
                e["zones"][z] = stats(v)
        out["types"][t] = e
        print(f"{t}: deals {len(by_rm[t])}, comunas {len(e['comunas'])}, zones {len(e['zones'])}, RM median {e['rm'] and e['rm']['med']}")
    json.dump(out, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"), sort_keys=True)


if __name__ == "__main__":
    main()
