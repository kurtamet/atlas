"""Download comuna crime statistics from CEAD (Subsecretaría de Prevención del Delito). Run from Chile.

Two routes, both raw:
 a) crawl the CEAD site for published spreadsheets (comunal reports, .xlsx/.xls/.csv) and download them;
 b) save the interactive "Estadísticas delictuales" page with its scripts, and try its data endpoint
    for Región Metropolitana comunas, 2023-2025, rates per 100k by crime group.
Everything goes to data-chile/cead/; the log tells what worked so the parser can be finished.
"""
import re, urllib.parse
from common import fetch, log, out, save

S = "cead"
BASE = "https://cead.spd.gov.cl"
PAGES = ["/", "/estadisticas-delictuales/", "/centro-de-documentacion/", "/estadisticas-regionales/",
         "/estadisticas-comunales/", "/biblioteca/", "/reportes-estadisticos/"]
DOC = re.compile(r'href="([^"]+\.(?:xlsx|xls|csv|zip))"', re.I)
SCRIPT = re.compile(r'<script[^>]+src="([^"]+)"', re.I)
AJAX = re.compile(r'["\']([^"\']*(?:get_|ajax|admin-ajax|\.php)[^"\']*)["\']', re.I)


def main():
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

    # guess at the interactive table's endpoint (as used by the site's own JS in recent years)
    for ep in [e for e in endpoints if "estadisticas" in e.lower() and e.endswith(".php")][:3] or \
              ["/wp-content/themes/gobcl-wp-master/data/get_estadisticas_delictuales.php"]:
        url = urllib.parse.urljoin(BASE + "/", ep)
        for medida in ("1", "2"):  # 1 = frecuencia, 2 = tasa por 100 mil (site convention)
            st, body, _ = fetch(url, data={"medida": medida, "tipoVal": "2", "anio[]": ["2023", "2024", "2025"],
                                           "region[]": ["13"], "seleccion": "2"},
                                headers={"X-Requested-With": "XMLHttpRequest", "Referer": BASE + "/estadisticas-delictuales/"})
            name = f"api_{ep.split('/')[-1]}_medida{medida}.txt"
            log(S, f"POST {ep} medida={medida}: HTTP {st}, {len(body)} bytes")
            save(out(S, name), body)


if __name__ == "__main__":
    main()
