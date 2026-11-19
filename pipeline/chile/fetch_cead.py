"""Download comuna crime statistics from CEAD (Subsecretaría de Prevención del Delito). Run from Chile.

Two routes, both raw:
 a) crawl the CEAD site for published spreadsheets (comunal reports, .xlsx/.xls/.csv) and download them;
 b) save the interactive "Estadísticas delictuales" page and query its table endpoint the same way the
    page does: all Región Metropolitana comunas, every crime group, 2023-2025, rates per 100k and counts.
Everything goes to data-chile/cead/; the log tells what worked so the parser can be finished.
"""
import re, urllib.parse
from common import fetch, log, out, save

S = "cead"
# cead.spd.gov.cl stopped resolving after the 2025 move to the Ministerio de Seguridad Pública;
# try the likely new homes and follow links from the Subsecretaría's site.
CANDIDATES = ["https://cead.minsegpublica.gob.cl", "https://cead.spd.gov.cl", "https://cead.subprevenciondeldelito.gob.cl",
              "https://cead.seguridadpublica.gob.cl", "https://subprevenciondeldelito.gob.cl/cead", "https://www.subprevenciondeldelito.gob.cl/cead"]
DISCOVER = ["https://subprevenciondeldelito.gob.cl/", "https://www.subprevenciondeldelito.gob.cl/", "https://www.minsegpublica.gob.cl/",
            "https://www.gob.cl/instituciones/"]
BASE = CANDIDATES[0]


def find_base():
    """first candidate that answers; else any 'cead' link found on the ministry sites"""
    for c in CANDIDATES:
        st, body, final = fetch(c + "/", retries=0, timeout=20)
        log(S, f"try {c}: HTTP {st}")
        if st == 200:
            return final.rstrip("/")
    for d in DISCOVER:
        st, body, final = fetch(d, retries=0, timeout=20)
        log(S, f"discover {d}: HTTP {st}, {len(body)} bytes")
        if st != 200:
            continue
        save(out(S, "pages", "discover_" + re.sub(r"[^a-z0-9]", "_", d.lower())[:60] + ".html"), body)
        for href in re.findall(r'href="([^"]+)"', body.decode("utf-8", "ignore")):
            if re.search(r"cead|estadisticas-delictuales|estad%C3%ADsticas", href, re.I):
                u = urllib.parse.urljoin(final, href)
                log(S, f"  link: {u}")
                st2, _, final2 = fetch(u, retries=0, timeout=20)
                if st2 == 200:
                    return final2.rstrip("/")
    return None
PAGES = ["/estadisticas-delictuales/", "/centro-de-documentacion/"]
DOC = re.compile(r'href="([^"]+\.(?:xlsx|xls|csv|zip))"', re.I)
SCRIPT = re.compile(r'<script[^>]+src="([^"]+)"', re.I)
AJAX = re.compile(r'["\']([^"\']*(?:get_|ajax|admin-ajax|\.php)[^"\']*)["\']', re.I)


def main():
    global BASE
    b = find_base()
    if not b:
        log(S, "CEAD site not found under any known address; see pages/discover_*.html")
        return
    BASE = b
    log(S, f"using {BASE}")
    seen_docs, endpoints = set(), set()
    for p in PAGES:
        st, body, final = fetch(BASE + p)
        log(S, f"page {p}: HTTP {st}, {len(body)} bytes")
        if st != 200:
            continue
        html = body.decode("utf-8", "ignore")
        save(out(S, "pages", (p.strip("/") or "home").replace("/", "_") + ".html"), body)
        for href in DOC.findall(html):
            seen_docs.add(urllib.parse.urljoin(final, href))
        for src in SCRIPT.findall(html):
            u = urllib.parse.urljoin(final, src)
            if "cead" in u and (u.endswith(".js") or ".js?" in u):
                s2, js, _ = fetch(u)
                if s2 == 200:
                    save(out(S, "js", re.sub(r"[^A-Za-z0-9._-]", "_", u.split("/")[-1])[:80]), js)
                    endpoints.update(m for m in AJAX.findall(js.decode("utf-8", "ignore")) if len(m) < 200)
        endpoints.update(m for m in AJAX.findall(html) if len(m) < 200)

    # spreadsheets: prefer comunal / recent ones, cap at 40 files
    docs = sorted(seen_docs, key=lambda u: (not re.search(r"comun", u, re.I), not re.search(r"202[3-6]", u), u))[:40]
    for u in docs:
        st, body, _ = fetch(u, timeout=120)
        name = re.sub(r"[^A-Za-z0-9._-]", "_", urllib.parse.unquote(u.split("/")[-1]))[:120]
        log(S, f"doc {name}: HTTP {st}, {len(body)} bytes")
        if st == 200 and body:
            save(out(S, "docs", name), body)

    with open(out(S, "endpoints.txt"), "w") as f:
        f.write("\n".join(sorted(endpoints)))
    log(S, f"{len(endpoints)} candidate endpoints written to endpoints.txt")

    if not cead_tables(BASE):
        log(S, "interactive tables failed; see api/*.html")


OPT = re.compile(r'<option value="([^"]*)" data-section="([^"]*)"[^>]*>([^<]*)')
MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre",
          "Octubre", "Noviembre", "Diciembre"]


def options(html, select_id):
    m = re.search(r'<select id="%s".*?>(.*?)</select>' % select_id, html, re.S)
    return OPT.findall(m.group(1)) if m else []


def cead_tables(base):
    """Query the site's own table endpoint (get_estadisticas_delictuales.php) the way its page does:
    all RM comunas x all crime families/groups/subgroups, one year per request.
    seleccion 1 = por unidad territorial, 2 = por delito; medida 1 = frecuencia, 2 = tasa por 100 mil;
    tipoVal "1,2" = casos policiales (denuncias + detenciones flagrantes)."""
    p = out(S, "pages", "estadisticas-delictuales.html")
    try:
        html = open(p, encoding="utf-8").read()
    except OSError:
        log(S, "no saved estadisticas-delictuales page")
        return False
    terr = options(html, "territorial-select")
    crimes = options(html, "delitos-select")
    years = [v for v, sec, _ in options(html, "temporalidad-select") if sec.startswith("A")]
    com = [(v, t) for v, sec, t in terr if sec == "Comunas" and v.startswith("13") and len(v) == 5]
    prov = [(v, t) for v, sec, t in terr if sec == "Provincias" and v.startswith("13")]
    fam = [(v, t) for v, sec, t in crimes if sec.startswith("Familia")]
    grp = [(v, t) for v, sec, t in crimes if sec == "Grupo"]
    sub = [(v, t) for v, sec, t in crimes if sec == "Subgrupo"]
    log(S, f"options: {len(com)} RM comunas, {len(fam)} families, {len(grp)} groups, {len(sub)} subgroups, years {years[:4]}")
    if len(com) < 40 or not fam:
        return False
    want = [y for y in ("2025", "2024", "2023") if y in years] or years[1:4]
    url = base + "/wp-content/themes/gobcl-wp-master/data/get_estadisticas_delictuales.php"
    hdr = {"X-Requested-With": "XMLHttpRequest", "Referer": base + "/estadisticas-delictuales/",
           "Origin": base, "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"}
    ok = 0
    for seleccion in ("1", "2"):
        for medida in ("2", "1"):
            for y in want:
                for descarga in (("false", "true") if (seleccion, medida) == ("1", "2") else ("false",)):
                    data = {
                        "medida": medida, "tipoVal": "1,2", "anio[]": [y],
                        "trimestre[]": ["1", "2", "3", "4"],
                        "mes[]": [str(i) for i in range(1, 13)], "mes_nombres[]": MONTHS,
                        "region[]": ["13"], "region_nombres[]": ["Región Metropolitana"],
                        "provincia[]": [v for v, _ in prov], "provincias_nombres[]": [t for _, t in prov],
                        "comuna[]": [v for v, _ in com], "comuna_nombres[]": [t for _, t in com],
                        "familia[]": [v for v, _ in fam], "familia_nombres[]": [t for _, t in fam],
                        "grupo[]": [v for v, _ in grp], "grupo_nombres[]": [t for _, t in grp],
                        "subgrupo[]": [v for v, _ in sub], "subgrupo_nombres[]": [t for _, t in sub],
                        "seleccion": seleccion, "descarga": descarga,
                    }
                    st, body, _ = fetch(url, data=data, headers=hdr, timeout=180, retries=3)
                    ext = "xls" if descarga == "true" else "html"
                    name = f"sel{seleccion}_medida{medida}_{y}.{ext}"
                    # a real table mentions comuna names; the empty template is ~3 KB
                    good = st == 200 and len(body) > 8000 and b"Providencia" in body
                    log(S, f"table {name}: HTTP {st}, {len(body)} bytes{'' if good else '  (empty?)'}")
                    save(out(S, "api", name), body)
                    ok += good
    log(S, f"{ok} non-empty tables")
    return ok > 0

if __name__ == "__main__":
    main()
