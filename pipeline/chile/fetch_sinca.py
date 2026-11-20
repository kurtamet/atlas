"""Download PM2.5 daily series for Santiago SINCA stations (MMA). Run from Chile.

1. station list JSON (saved as-is, so the parsing can be fixed later without re-running);
2. for each Región Metropolitana station code D01..D40, daily validated PM2.5 2023-01-01..2025-12-31
   via the SINCA Airviro CGI (the same CSV the site offers under "Excel").
Everything raw goes to data-chile/sinca/.
"""
from common import fetch, log, out, save

S = "sinca"
BASE = "https://sinca.mma.gob.cl"


def main():
    st, body, _ = fetch(f"{BASE}/index.php/json/listadomapa2k19/")
    log(S, f"station list: HTTP {st}, {len(body)} bytes")
    if st == 200:
        save(out(S, "stations.json"), body)
    st, body, _ = fetch(f"{BASE}/index.php/region/index/id/M")
    log(S, f"region page: HTTP {st}, {len(body)} bytes")
    if st == 200:
        save(out(S, "region_M.html"), body)

    got = 0
    for n in range(1, 41):
        code = f"D{n:02d}"
        for macro, tag in ((f"./RM/{code}/Cal/PM25//PM25.diario.diario.ic", "PM25_daily"),
                           (f"./RM/{code}/Cal/PM10//PM10.diario.diario.ic", "PM10_daily")):
            url = (f"{BASE}/cgi-bin/APUB-MMA/apub.tsindico2.cgi?outtype=xcl&macro={macro}"
                   "&from=230101&to=251231&path=/usr/airviro/data/CONAMA/&lang=esp&rsrc=&macropath=")
            st, body, _ = fetch(url, timeout=90)
            ok = st == 200 and body.count(b"\n") > 30
            log(S, f"{code} {tag}: HTTP {st}, {len(body)} bytes{' OK' if ok else ''}")
            if ok:
                save(out(S, f"{code}_{tag}.csv"), body)
                got += 1
    log(S, f"done: {got} series saved")


if __name__ == "__main__":
    main()
