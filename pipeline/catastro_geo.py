"""
Geolocate SII catastro rols (pipeline/catastro_sii.py --facts output) with open address points.

    python pipeline/catastro_geo.py --facts ~/atlas-data/catastro/facts.parquet \
        --addresses ~/atlas-data/addresses_stgo.parquet --out ~/atlas-data/catastro/rol_geo.parquet

Address points: Overture Maps addresses theme (release 2026-11-18.0, from OpenAddresses cl/countrywide, CC-BY-4.0),
filtered to the Santiago bbox. Matching, per comuna:
  1. exact: normalized street + house number (abbreviations expanded, street-type prefixes and articles dropped);
  2. near: same street (or the only street in the comuna ending with the same word), nearest number within 40,
     same parity preferred;
  3. manzana: the median point of the located rols of the same SII manzana, for rols without a match and for
     points more than 300 m from their manzana's median (wrong matches).
Gran Santiago (32 comunas): ~81% of rols by address, ~96% with the manzana fallback.
"""
import argparse
import duckdb, re, unicodedata
PRE = {"AV","AVDA","AVENIDA","PJE","PJ","PSJE","PASAJE","CALLE","CL","CLL","PASAJ"}
REP = {"GRAL":"GENERAL","GNRAL":"GENERAL","STA":"SANTA","STO":"SANTO","SN":"SAN","PDTE":"PRESIDENTE","PTE":"PRESIDENTE","CAP":"CAPITAN","CAPT":"CAPITAN",
       "TTE":"TENIENTE","CNEL":"CORONEL","MCAL":"MARISCAL","ALM":"ALMIRANTE","DR":"DOCTOR","PBRO":"PRESBITERO","MONS":"MONSENOR","COST":"COSTANERA","PROF":"PROFESOR",
       "NTRA":"NUESTRA","SRA":"SENORA","STGO":"SANTIAGO","LIB":"LIBERTADOR","BDO":"BERNARDO","OHIGGINS":"OHIGGINS"}
def nstreet(s):
    s = unicodedata.normalize("NFD", s or "").encode("ascii","ignore").decode().upper()
    s = re.sub(r"[^A-Z0-9 ]", " ", s.replace("'", ""))
    t = [REP.get(w, w) for w in s.split()]
    while t and t[0] in PRE: t = t[1:]
    t = [w for w in t if w not in ("DE","DEL","LA","LAS","LOS","EL","Y")]
    return " ".join(t)
def ncom(s):
    s = unicodedata.normalize("NFD", s or "").encode("ascii","ignore").decode().upper().replace("-"," ")
    return " ".join(s.split())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--facts", required=True)
    ap.add_argument("--addresses", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    c = duckdb.connect()
    ("/home/user/atlas-data/geo/geo.duckdb")
    c.create_function("nstreet", nstreet, ["VARCHAR"], "VARCHAR")
    c.create_function("ncom", ncom, ["VARCHAR"], "VARCHAR")
    c.execute(f"""create or replace table addr as select ncom(address_levels[2].value) comuna, nstreet(street) st, try_cast(regexp_extract(number,'^\\d+') as int) num,
       (bbox.xmin+bbox.xmax)/2 lon, (bbox.ymin+bbox.ymax)/2 lat from '{a.addresses}' where number is not null""")
    c.execute(f"""create or replace table addr1 as select comuna, st, num, avg(lon) lon, avg(lat) lat, count(*) k from addr where num is not null group by all""")
    c.execute(f"""create or replace table cat as select code, mz, pr, destino, dir, comuna_name,
       nstreet(regexp_extract(dir, '^(.*?)\\s+(\\d+)', 1)) st, try_cast(regexp_extract(dir, '^(.*?)\\s+(\\d+)', 2) as int) num
       from '{a.facts}'""")
    c.execute(f"""create or replace table cm as select cat.*, a.lon, a.lat from cat left join addr1 a
       on a.comuna = case when cat.comuna_name like 'SANTIAGO %' then 'SANTIAGO' else cat.comuna_name end and a.st = cat.st and a.num = cat.num""")
    c.execute(f"create or replace view cm2 as select *, case when comuna_name like 'SANTIAGO %' then 'SANTIAGO' else comuna_name end acom from cm")
    # street alias by last word: unique street in comuna with that last word
    c.execute(f"""create or replace table lastw as select comuna, split_part(st,' ',-1) lw, any_value(st) st from (select distinct comuna, st from addr1 where length(split_part(st,' ',-1))>=4) group by 1,2 having count(distinct st)=1""")
    c.execute(f"""create or replace table cm3 as
     with u as (select distinct acom, st, num from cm2 where lon is null and num is not null),
     al as (select u.*, coalesce((select st from addr1 a where a.comuna=u.acom and a.st=u.st limit 1),
                                 (select l.st from lastw l where l.comuna=u.acom and l.lw=split_part(u.st,' ',-1))) st2 from u),
     near as (select al.acom, al.st, al.num, arg_min(a.lon, abs(a.num-al.num) + case when (a.num-al.num)%2=0 then 0 else 0.5 end) lon,
                   arg_min(a.lat, abs(a.num-al.num) + case when (a.num-al.num)%2=0 then 0 else 0.5 end) lat, min(abs(a.num-al.num)) d
              from al join addr1 a on a.comuna=al.acom and a.st=al.st2 and abs(a.num-al.num)<=40 group by all)
     select * from near""")
    c.execute(f"""create or replace table geo as select cm2.code, cm2.mz, cm2.pr, cm2.destino, cm2.dir, cm2.comuna_name,
       coalesce(cm2.lon, n.lon) lon, coalesce(cm2.lat, n.lat) lat,
       case when cm2.lon is not null then 'exact' when n.lon is not null then 'near' end how
       from cm2 left join cm3 n on n.acom=cm2.acom and n.st=cm2.st and n.num=cm2.num""")
    c.execute("""create table mzc as select code, mz, median(lon) lon, median(lat) lat from geo where lon is not null group by 1, 2""")
    c.execute(f"""copy (select g.code, g.mz, g.pr,
        case when g.lon is not null and 111000 * sqrt(power((g.lon - m.lon) * 0.834, 2) + power(g.lat - m.lat, 2)) <= 300 then g.lon else m.lon end lon,
        case when g.lon is not null and 111000 * sqrt(power((g.lon - m.lon) * 0.834, 2) + power(g.lat - m.lat, 2)) <= 300 then g.lat else m.lat end lat,
        case when g.lon is not null and 111000 * sqrt(power((g.lon - m.lon) * 0.834, 2) + power(g.lat - m.lat, 2)) <= 300 then g.how
             when m.lon is not null then 'manzana' end how
      from geo g left join mzc m using (code, mz)) to '{a.out}' (format parquet, compression zstd)""")
    print(c.execute(f"select how, count(*) from '{a.out}' group by 1 order by 2 desc").fetchall())


if __name__ == "__main__":
    main()
