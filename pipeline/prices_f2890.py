"""
Price layer EC02 from SII F2890 (registered transactions), comuna level.

    python pipeline/prices_f2890.py --f2890 F2890_01-10-2026.txt --uf uf_daily.csv \
        --comunas public/data/comunas.geojson --out public/data/prices-comunas.json

F2890 has one row per rol (comuna, manzana, predio) with inscription/deed dates and
the price in CLP and/or UF. It has NO surface, property type or address, so this layer
is "median transaction price, all property types" until the SII catastro is joined.

Method (spec M6, simplified; documented in the output):
- A deal covering several rols (e.g. apartment + parking + storage) repeats the total
  price on every row: rows with the same comuna, dates and amounts are one deal.
  Deals with more than MAX_ROLS rols (block sales) are dropped.
- Price in UF: MONTO_UF when present, else MONTO_PESOS / UF of the deed date.
- Keep 500 <= UF <= 100 000. Banco Central uses 100 as the floor, but without the catastro
  we cannot drop parking spaces and storage rooms sold on their own (≈300–900 UF), which
  otherwise pull the median of high-rise comunas far down (Vitacura: 874 UF at 100, 9 750 at 500).
  Replace with a filter on the catastro destino code once it is available.
- Main window: deeds in the last 24 complete months; yearly medians for the trend.
"""
import argparse
import json
import unicodedata

import duckdb

MAX_ROLS = 5
UF_MIN, UF_MAX = 500, 100_000


def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode()
    return " ".join(s.upper().split())


# F2890 splits Santiago into SII sub-comunas.
ALIASES = {"SANTIAGO CENTRO": "SANTIAGO", "SANTIAGO SUR": "SANTIAGO", "SANTIAGO OESTE": "SANTIAGO"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--f2890", required=True)
    ap.add_argument("--uf", required=True)
    ap.add_argument("--comunas", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--from", dest="date_from", default="20241001")
    ap.add_argument("--to", dest="date_to", default="20260930")
    a = ap.parse_args()

    comunas = json.load(open(a.comunas, encoding="utf-8"))
    code_by_name = {norm(f["properties"]["name"]): str(f["properties"]["code"]) for f in comunas["features"]}

    con = duckdb.connect()
    con.execute(f"""
      create table raw as select * from read_csv('{a.f2890}', delim=';', header=true, encoding='latin-1',
        columns={{'COMUNA':'VARCHAR','MANZANA':'VARCHAR','PREDIO':'VARCHAR','FI':'VARCHAR','FE':'VARCHAR','PESOS':'DOUBLE','UF':'DOUBLE'}},
        ignore_errors=true)""")
    con.execute(f"create table ufd as select cast(date as varchar) d, uf as val from read_csv('{a.uf}', header=true, columns={{'date':'VARCHAR','uf':'DOUBLE'}})")
    con.create_function("norm", lambda s: ALIASES.get(norm(s), norm(s)), ["VARCHAR"], "VARCHAR")
    con.execute(f"""
      create table deals as
      select norm(COMUNA) comuna, FE, substr(FE,1,4) yr, count(*) nrol,
             coalesce(any_value(raw.UF), any_value(raw.PESOS) / any_value(ufd.val)) price_uf
      from raw left join ufd on ufd.d = raw.FE
      where FE between '20180101' and '{a.date_to}' and (raw.PESOS is not null or raw.UF is not null)
      group by COMUNA, FI, FE, raw.PESOS, raw.UF
      having count(*) <= {MAX_ROLS}""")
    con.execute(f"delete from deals where price_uf is null or price_uf < {UF_MIN} or price_uf > {UF_MAX}")

    main_rows = con.execute(f"""
      select comuna, count(*) n, median(price_uf), quantile_cont(price_uf, 0.25), quantile_cont(price_uf, 0.75)
      from deals where FE between '{a.date_from}' and '{a.date_to}' group by comuna""").fetchall()
    year_rows = con.execute("select comuna, yr, count(*), median(price_uf) from deals group by comuna, yr order by yr").fetchall()

    out = {
        "metric": "EC02",
        "source": "SII F2890 (sii.cl/destacados/transparencia), file F2890_01-10-2026",
        "period": [a.date_from, a.date_to],
        "method": f"deals = rows grouped by comuna+dates+amounts, <= {MAX_ROLS} rols; UF at deed date; {UF_MIN}-{UF_MAX} UF; all property types, no surface",
        "comunas": {},
    }
    for comuna, n, med, p25, p75 in main_rows:
        code = code_by_name.get(comuna)
        if code:
            out["comunas"][code] = {"name": comuna, "n": n, "median": round(med), "p25": round(p25), "p75": round(p75), "years": {}}
    for comuna, yr, n, med in year_rows:
        code = code_by_name.get(comuna)
        if code in out["comunas"]:
            out["comunas"][code]["years"][yr] = {"n": n, "median": round(med)}
    missing = sorted(set(code_by_name) - {v["name"] for v in out["comunas"].values()})
    json.dump(out, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"comunas with prices: {len(out['comunas'])}/{len(code_by_name)}; missing: {missing}")


if __name__ == "__main__":
    main()
