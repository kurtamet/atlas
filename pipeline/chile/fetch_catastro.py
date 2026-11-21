"""
SII catastro downloader (Detalle Catastral y Rol de Cobro), run on your own computer.

    pip install playwright && python3 -m playwright install chromium
    python3 pipeline/chile/fetch_catastro.py

What it does:
  1. Asks for the RUT and the clave tributaria in the terminal. The clave is not echoed or stored, and
     it is not written to any file or log.
  2. Opens a real Chromium window, signs in on the SII login page (one attempt only: wrong passwords
     count toward SII's lockout) and opens the service
     https://www4.sii.cl/sismunInternet6/?caller=DETALLE_CAT_Y_ROL_COBRO
  3. Inside that signed-in page it makes the same two calls the page makes when you pick a comuna
     (obtenerArchivosVigente, then descargaArchivo) for every Región Metropolitana comuna, and saves each
     file under its SII name, e.g. data-chile/catastro/files/BRTMPCATAS_2026_2_15108.zip. Files already
     there are skipped, so it can be re-run. Nothing is clicked. If something is missing, download it by
     hand in the same window: those files are still caught.
  4. It logs which service calls the page makes (method, address, GWT method names; no cookies,
     no clave, no RUT) to data-chile/catastro/api-log.jsonl. Send that log to Claude: with it the next version
     will download all Santiago comunas without clicks.

Close the browser window (or press Ctrl+C) when the downloads are done.
"""
import getpass
import json
import os
import re
import sys
import time
from urllib.parse import urlencode

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    sys.exit("Falta Playwright. Instala con:\n  pip install playwright && python3 -m playwright install chromium")

from common import ROOT

SERVICE = "https://www4.sii.cl/sismunInternet6/?caller=DETALLE_CAT_Y_ROL_COBRO"
LOGIN = "https://zeusr.sii.cl/AUT2000/InicioAutenticacion/IngresoRutClave.html?" + SERVICE
OUT = os.path.join(ROOT, "catastro")
FILES = os.path.join(OUT, "files")
SECRET_KEYS = re.compile(r"clave|pass|token|rut|dv|cookie", re.I)


def ask_credentials():
    rut = input("RUT (ej. 12345678-9): ").strip().replace(".", "").upper()
    m = re.fullmatch(r"(\d{6,8})-?([\dK])", rut)
    if not m:
        sys.exit("RUT no válido")
    clave = getpass.getpass("Clave tributaria (no se muestra): ")
    if not clave:
        sys.exit("Clave vacía")
    return m.group(1), m.group(2), clave


def dotted(body, dv):
    s = f"{int(body):,}".replace(",", ".")
    return f"{s}-{dv}"


def safe_fields(post):
    """form/JSON field names with values only for harmless fields (never the clave, RUT or tokens)"""
    if not post:
        return None
    try:
        data = json.loads(post)
        def scrub(o):
            if isinstance(o, dict):
                return {k: ("***" if SECRET_KEYS.search(k) else scrub(v)) for k, v in o.items()}
            if isinstance(o, list):
                return [scrub(x) for x in o[:20]]
            return o
        return scrub(data)
    except ValueError:
        out = {}
        for part in post.split("&"):
            k, _, v = part.partition("=")
            if k:
                out[k] = "***" if SECRET_KEYS.search(k) else v[:80]
        return out


KNOWN_CODES = [  # SII comuna codes (not CUT) seen for Región Metropolitana; topped up from the page's own region data
    13167, 14109, 14127, 14155, 14156, 14157, 14158, 14166, 14201, 14202, 14502, 14503, 14602, 14603, 14605,
    15108, 15128, 15132, 15151, 15161, 16110, 16131, 16154, 16164, 16165, 16402, 16403,
]
FACADE = "https://www4.sii.cl/sismunInternet6/facade"
DOWNLOAD = "https://www4.sii.cl/sismunInternet6/descargaArchivo"
FILE_RE = re.compile(r"[A-Za-z0-9_\-]+\.(?:zip|txt|gz|rar)")
UUID_RE = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
POST_JS = """async ([url, body, headers]) => {
  const r = await fetch(url, {method: 'POST', body, headers, credentials: 'include'});
  return [r.status, await r.text()];
}"""


def gwt_strings(body):
    """'7|0|N|s1|...|sN|refs' -> (strings, refs)"""
    parts = body.split("|")
    n = int(parts[2])
    return parts[3:3 + n], parts[3 + n:]


def gwt_body(strings, refs):
    return "|".join(["7", "0", str(len(strings))] + strings + refs)


def api_download(page, ctx, state, body, dv, label, idle):
    """Ask the service for each comuna's current files (obtenerArchivosVigente) and fetch them (descargaArchivo),
    the same two calls the page makes when you pick a comuna."""
    for _ in range(30):
        if state.get("headers"):
            break
        idle(1000)
    hdr = state.get("headers") or {}
    if not hdr.get("x-gwt-permutation"):
        raise RuntimeError("la página del servicio no cargó (sin llamadas al facade)")
    headers = {k: v for k, v in hdr.items() if k in ("content-type", "x-gwt-permutation", "x-gwt-module-base")}

    def call(payload):
        status, text = page.evaluate(POST_JS, [FACADE, payload, headers])
        return status, text

    strong = state["strong"]
    base = "https://www4.sii.cl/sismunInternet6/"
    # comuna codes: the region data the page loads, plus the ones already seen
    codes = set(KNOWN_CODES)
    st, txt = call(gwt_body([base, strong, "cl.sii.sdi.diid.sismun.web.client.service.Facade", "getDatosRegionales"],
                            ["1", "2", "3", "4", "0", ""]))
    if st == 200:
        codes |= {int(x) for x in re.findall(r"(?<![\d.])(1[3-6]\d{3})(?![\d.])", txt)}
    codes = sorted(codes)
    if len(codes) > 200:  # the region data matched too much: stay with what we know
        codes = sorted(KNOWN_CODES)

    def files_request(code):
        tpl = state.get("template")
        if tpl:  # a real request the page made: swap the comuna code only
            strings, refs = gwt_strings(tpl)
            strings = list(strings)
            strings[state["code_idx"]] = str(code)
            return gwt_body(strings, refs)
        return gwt_body([base, strong, "cl.sii.sdi.diid.sismun.web.client.service.Facade", "obtenerArchivosVigente",
                         "cl.sii.sdi.diid.sismun.to.DatosUsuarioTo/3014193288", "java.lang.Boolean/476441737",
                         "PUBLICADO", str(code), "13", "('DETALLE_CATASTRAL','ROL_DE_COBRO')", dv, body],
                        "1|2|3|4|1|5|5|0|0|6|0|-2|7|8|9|0|0|0|0|0|10|11|12|".split("|"))

    print(f"Probando {len(codes)} códigos de comuna del SII…")
    got_any = False
    for i, code in enumerate(codes, 1):
        label["now"] = str(code)
        st, txt = call(files_request(code))
        if st != 200 or not txt.startswith("//OK"):
            if i == 1 or not got_any:
                print(f"  {code}: el servicio respondió {st} {txt[:60]!r}")
            continue
        names = list(dict.fromkeys(FILE_RE.findall(txt)))
        ids = list(dict.fromkeys(UUID_RE.findall(txt)))
        if not names:
            continue
        for k, name in enumerate(names):
            dest = os.path.join(FILES, name)
            if os.path.exists(dest) and os.path.getsize(dest) > 0:
                print(f"[{i}/{len(codes)}] {code}: {name} ya estaba")
                got_any = True
                continue
            fid = ids[k] if k < len(ids) else (ids[0] if ids else "")
            ext = name.rsplit(".", 1)[1]
            q = {"nombreDocumento": name, "extension": ext, "acc": "download", "id": fid, "mediaType": "application/octet-stream"}
            res = ctx.request.get(DOWNLOAD + "?" + urlencode(q), headers={"referer": base}, timeout=600000)
            data = res.body()
            if res.status != 200 or len(data) < 100:
                print(f"[{i}/{len(codes)}] {code}: {name} falló ({res.status}, {len(data)} bytes)")
                continue
            with open(dest, "wb") as fh:
                fh.write(data)
            got_any = True
            print(f"[{i}/{len(codes)}] {code}: {name} ({len(data) / 1e6:.1f} MB)")
        idle(300)
    if not got_any:
        raise RuntimeError("el servicio no devolvió archivos; elige una comuna a mano en la ventana para que copie la llamada real")


def main():
    os.makedirs(FILES, exist_ok=True)
    body, dv, clave = ask_credentials()
    api_log = open(os.path.join(OUT, "api-log.jsonl"), "a", encoding="utf-8")
    saved = []

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=False)
        ctx = browser.new_context(accept_downloads=True, locale="es-CL")
        page = ctx.new_page()

        state = {}  # facade headers + one real obtenerArchivosVigente request, kept in memory only

        def on_request(req):
            if "zeusr.sii.cl" in req.url or req.resource_type not in ("xhr", "fetch", "document"):
                return
            post = req.post_data or ""
            fields = safe_fields(post)
            if post.startswith("7|0|"):  # GWT-RPC: the body carries the RUT, so log the method name only
                try:
                    strings, _ = gwt_strings(post)
                    method = strings[3]
                    if req.url.startswith(FACADE):
                        state["headers"] = {k.lower(): v for k, v in req.headers.items()}
                        state["strong"] = strings[1]
                        if method == "obtenerArchivosVigente":
                            idx = next(j for j, x in enumerate(strings) if re.fullmatch(r"1[3-6]\d{3}", x))
                            state["template"], state["code_idx"] = post, idx
                except (ValueError, IndexError, StopIteration):
                    method = "?"
                fields = {"gwt_method": method}
            api_log.write(json.dumps({"t": time.strftime("%H:%M:%S"), "method": req.method, "url": req.url.split("?")[0],
                                      "query": req.url.split("?", 1)[1][:300] if "?" in req.url else None,
                                      "fields": fields}, ensure_ascii=False) + "\n")
            api_log.flush()

        def on_response(res):
            if "sii.cl" not in res.url or "zeusr" in res.url:
                return
            ct = res.headers.get("content-type", "")
            if res.request.resource_type in ("xhr", "fetch"):
                api_log.write(json.dumps({"t": time.strftime("%H:%M:%S"), "response": res.url.split("?")[0], "status": res.status, "type": ct[:60]}) + "\n")
                api_log.flush()

        pending = []  # downloads are saved from the main loop, not inside the event callback
        ctx.on("request", on_request)
        ctx.on("response", on_response)
        page.on("download", lambda d: pending.append(d))
        ctx.on("page", lambda p: p.on("download", lambda d: pending.append(d)))

        label = {"now": "manual"}

        def flush():
            while pending:
                d = pending.pop(0)
                tmp = d.path()  # waits until the file is complete
                with open(tmp, "rb") as fh:
                    head = fh.read(4)
                ext = ".zip" if head.startswith(b"PK") else ".gz" if head.startswith(b"\x1f\x8b") else ".txt"
                base = re.sub(r"[^\w\-]+", "_", label["now"]).strip("_") or "archivo"
                n = sum(1 for x in saved if os.path.basename(x).startswith(base + "_")) + 1
                path = os.path.join(FILES, f"{base}_{n}{ext}")
                d.save_as(path)
                saved.append(path)
                print(f"  guardado: {os.path.basename(path)} ({os.path.getsize(path) / 1e6:.1f} MB)")

        def idle(ms):
            """sleep while Playwright keeps dispatching events (time.sleep would freeze them)"""
            page.wait_for_timeout(ms)
            flush()

        print("Entrando al SII…")
        page.goto(LOGIN, wait_until="domcontentloaded")
        try:
            page.fill("input[name=rutcntr]", dotted(body, dv), timeout=15000)
            page.fill("input[name=clave]", clave, timeout=5000)
            page.locator("#bt_ingresar, button[type=submit], input[type=submit]").first.click(timeout=5000)
            page.wait_for_load_state("domcontentloaded")
        except Exception as e:
            print(f"No pude completar el formulario automáticamente ({type(e).__name__}). Ingresa a mano en la ventana.")
            input("Cuando hayas ingresado, presiona Enter aquí… ")
        del clave
        idle(3000)
        cookies = {c["name"] for c in ctx.cookies()}
        if "TOKEN" not in cookies:
            print("No se pudo confirmar el ingreso (sin cookie TOKEN). Revisa la ventana: si el SII muestra un error de clave,"
                  " ciérrala; no reintento para no bloquear la cuenta.")
        if "sismunInternet6" not in page.url:
            page.goto(SERVICE, wait_until="domcontentloaded")

        try:
            api_download(page, ctx, state, body, dv, label, idle)
        except Exception as e:
            print(f"La descarga automática se detuvo ({type(e).__name__}: {e}).")
            if not state.get("template"):
                input("Elige la Región Metropolitana y una comuna en la ventana (para que vea la llamada real), "
                      "luego presiona Enter aquí… ")
                idle(1000)
                try:
                    api_download(page, ctx, state, body, dv, label, idle)
                except Exception as e2:
                    print(f"Tampoco funcionó ({type(e2).__name__}: {e2}). Puedes seguir a mano en la ventana.")

        print("\nSi falta algo, descárgalo a mano en la ventana: los archivos se guardan solos en:\n  " + FILES)
        print("Cierra la ventana cuando termines.\n")
        label["now"] = "manual"
        try:
            while browser.is_connected() and any(not p.is_closed() for p in ctx.pages):
                idle(1000)
        except KeyboardInterrupt:
            pass
        except Exception:
            pass  # window closed
        try:
            browser.close()
        except Exception:
            pass

    api_log.close()
    print(f"\n{len(saved)} archivo(s) descargado(s) en {FILES}")
    print(f"Registro de llamadas del servicio (sin claves): {os.path.join(OUT, 'api-log.jsonl')}")


if __name__ == "__main__":
    main()
