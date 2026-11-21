"""
SII Detalle Catastral (2026, 2nd semester) -> EC01 (UF per built m², homes) per comuna, plus a compact
per-rol facts table for later use (object card, rol search).

    python pipeline/catastro_sii.py --raw ~/atlas-data/catastro/raw --f2890db ~/atlas-data/f2890.duckdb \
        --uf pipeline/uf_daily.csv --comunas public/data/comunas.geojson \
        --out public/data/value.json --facts ~/atlas-data/catastro/facts.parquet

Input: the per-comuna zips from sismunInternet6 unpacked into --raw (pipe-separated, latin-1, no header).
  BRTMPCATASN  one row per rol:  comuna|manzana|predio|dirección|avalúo total|contribución|destino|avalúo exento|
                                 bien común ×6|sup. terreno m²|U/R|…
  BRTMPCATASNL one row per building line: comuna|manzana|predio|línea|material|calidad|año|sup. m²|destino|cond.|pisos
  The comuna field is the SII comuna code, not the CUT code. The mapping is derived from the data itself: each SII code
  is matched to the F2890 comuna name whose recent rols it contains (Santiago has three SII codes), with a few
  manual overrides for small rural comunas.

EC01 method:
- F2890 deals (rows grouped by comuna + dates + amounts, <= 5 rols), deeds in the last 24 complete months.
- Keep deals with exactly one homes rol (destino H). Area = built m² of that rol (sum of its NL lines).
  Parking (Z) and storage (L) rols sold in the same deal stay in the price, as in most market reports.
- Price in UF: MONTO_UF, else MONTO_PESOS / UF of the deed date. Keep 15 m² <= area <= 1500 m² and
  5 <= UF/m² <= 500; median per comuna (only comunas with >= 30 deals).
"""
import argparse
import json
import unicodedata

import duckdb

MAX_ROLS = 5
MIN_DEALS = 30

# SII code -> F2890 comuna name where the data-driven match is weak (tiny samples in rural comunas)
OVERRIDES = {14203: "TIL TIL", 14501: "TALAGANTE", 14604: "ALHUE", 14605: "SAN PEDRO", 16302: "PIRQUE", 16402: "CALERA DE TANGO"}
ALIASES = {"SANTIAGO CENTRO": "SANTIAGO", "SANTIAGO SUR": "SANTIAGO", "SANTIAGO OESTE": "SANTIAGO", "TIL-TIL": "TIL TIL"}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", s or "").encode("ascii", "ignore").decode().replace("-", " ")
    return " ".join(s.upper().split())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", required=True)
    ap.add_argument("--f2890db", required=True, help="duckdb file with table raw(COMUNA,MANZANA,PREDIO,FI,FE,PESOS,UF)")
    ap.add_argument("--uf", required=True)
    ap.add_argument("--comunas", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--facts")
    ap.add_argument("--from", dest="date_from", default="20241001")
    ap.add_argument("--to", dest="date_to", default="20260930")
    a = ap.parse_args()

    comunas = json.load(open(a.comunas, encoding="utf-8"))
    cut_by_name = {norm(f["properties"]["name"]): str(f["properties"]["code"]) for f in comunas["features"]}

    con = duckdb.connect()
    con.execute(f"attach '{a.f2890db}' as f (read_only)")
    rd = "delim='|', header=false, encoding='latin-1', all_varchar=true, quote='', null_padding=true"
    con.execute(f"""create table n as select column00::int code, column01::int mz, column02::int pr, trim(column03) dir,
        try_cast(column04 as bigint) avaluo, try_cast(column05 as bigint) contrib, trim(column06) destino,
        try_cast(column14 as int) sup_terreno, trim(column15) ur
      from read_csv('{a.raw}/BRTMPCATASN_*', {rd})""")
    con.execute(f"""create table nl as select column00::int code, column01::int mz, column02::int pr, trim(column04) material,
        trim(column05) calidad, try_cast(column06 as int) anio, try_cast(column07 as int) sup, trim(column08) destino,
        try_cast(column10 as int) pisos
      from read_csv('{a.raw}/BRTMPCATASNL_*', {rd})""")
    con.execute("""create table rol as select n.*, b.m2, b.anio, b.pisos, b.material from n left join (
        select code, mz, pr, sum(sup) m2, min(nullif(anio,0)) anio, max(pisos) pisos, arg_max(material, sup) material
        from nl group by 1,2,3) b using (code, mz, pr)""")

    # SII code -> F2890 name, by overlap of recent rols
    con.create_function("norm", lambda s: norm(s), ["VARCHAR"], "VARCHAR")
    con.execute("""create table fk as select distinct norm(COMUNA) comuna, try_cast(MANZANA as int) mz, try_cast(PREDIO as int) pr
                   from f.raw where FI >= '20240101'""")
    best = con.execute("""select code, arg_max(comuna, hits) from (
        select n.code, fk.comuna, count(*) hits from fk join (select distinct code, mz, pr from n) n using (mz, pr) group by 1, 2)
        group by code""").fetchall()
    sii_name = {code: OVERRIDES.get(code, name) for code, name in best}
    con.execute("create table codes (code int, fname varchar)")
    con.executemany("insert into codes values (?, ?)", list(sii_name.items()))

    con.execute(f"create table ufd as select cast(date as varchar) d, uf val from read_csv('{a.uf}', header=true, columns={{'date':'VARCHAR','uf':'DOUBLE'}})")
    con.execute(f"""create table deals as
      select row_number() over () deal, norm(COMUNA) fname, FE, count(*) nrol,
             coalesce(any_value(try_cast(r.UF as double)), any_value(try_cast(r.PESOS as double)) / any_value(ufd.val)) price_uf,
             list({{'mz': try_cast(MANZANA as int), 'pr': try_cast(PREDIO as int)}}) rols
      from f.raw r left join ufd on ufd.d = r.FE
      where FE between '{a.date_from}' and '{a.date_to}' and (r.PESOS is not null or r.UF is not null)
      group by COMUNA, FI, FE, r.PESOS, r.UF having count(*) <= {MAX_ROLS}""")
    con.execute("""create table deal_rols as
      select d.deal, d.fname, d.FE, d.price_uf, u.rol.mz mz, u.rol.pr pr
      from deals d, unnest(d.rols) u(rol)""")
    con.execute("""create table homes as
      select dr.deal, any_value(dr.fname) fname, any_value(dr.price_uf) price_uf, any_value(c.code) code,
             count(*) filter (where r.destino = 'H') nh, max(r.m2) filter (where r.destino = 'H') m2
      from deal_rols dr join codes c on c.fname = dr.fname join rol r on r.code = c.code and r.mz = dr.mz and r.pr = dr.pr
      group by dr.deal""")
    con.execute("""create table ec01 as select *, price_uf / m2 ufm2 from homes
                   where nh = 1 and m2 between 15 and 1500 and price_uf / m2 between 5 and 500""")
    rows = con.execute(f"""select fname, count(*) n, median(ufm2), quantile_cont(ufm2, 0.25), quantile_cont(ufm2, 0.75), median(m2)
                           from ec01 group by fname having count(*) >= {MIN_DEALS}""").fetchall()

    out = {
        "metric": "EC01",
        "source": "SII Detalle Catastral 2026-2 (sismunInternet6) + SII F2890 transactions",
        "period": [a.date_from, a.date_to],
        "method": "deals with exactly one homes rol (destino H); UF at deed date / built m² of that rol; 15-1500 m², 5-500 UF/m²; median",
        "comunas": {},
        "detail": {},
    }
    by_cut: dict[str, list] = {}
    for fname, n, med, p25, p75, m2 in rows:
        cut = cut_by_name.get(ALIASES.get(fname, fname))
        if cut:
            by_cut.setdefault(cut, []).append((fname, n, med, p25, p75, m2))
    for cut, parts in by_cut.items():
        if len(parts) == 1:
            fname, n, med, p25, p75, m2 = parts[0]
        else:  # Santiago: recompute over its SII sub-comunas together
            names = [p[0] for p in parts]
            n, med, p25, p75, m2 = con.execute(
                "select count(*), median(ufm2), quantile_cont(ufm2, .25), quantile_cont(ufm2, .75), median(m2) from ec01 where list_contains(?, fname)",
                [names]).fetchone()
        out["comunas"][cut] = round(med, 1)
        out["detail"][cut] = {"n": n, "p25": round(p25, 1), "p75": round(p75, 1), "m2": round(m2)}
    json.dump(out, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"EC01 for {len(out['comunas'])}/{len(cut_by_name)} comunas; deals used: {con.execute('select count(*) from ec01').fetchone()[0]}")
    missing = sorted(set(cut_by_name) - {k for k, v in cut_by_name.items() if v in out["comunas"]})
    if missing:
        print("missing:", missing)

    if a.facts:
        con.execute("create table fcodes as select code, fname from codes")
        con.execute(f"""copy (select r.*, c.fname comuna_name from rol r left join fcodes c using (code))
                        to '{a.facts}' (format parquet, compression zstd)""")
        print("facts:", a.facts, con.execute("select count(*) from rol").fetchone()[0], "rols")


if __name__ == "__main__":
    main()
