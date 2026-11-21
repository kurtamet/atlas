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
  3. Every file the service sends (BRTMPCATAS*, BRTMPNACROL*, .txt/.csv/.gz/.zip) is saved to
     data-chile/catastro/files/. In the window, pick the period (latest semester) and the comunas, or
     the national file if the service offers it, and click download. The script catches the files itself.
  4. It logs which service calls the page makes (method, address, form field names; no cookies, no
     clave) to data-chile/catastro/api-log.jsonl. Send that log to Claude: with it the next version
     will download all Santiago comunas without clicks.

Close the browser window (or press Ctrl+C) when the downloads are done.
"""
import getpass
import json
import os
import re
import sys
import time

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


def main():
    os.makedirs(FILES, exist_ok=True)
    body, dv, clave = ask_credentials()
    api_log = open(os.path.join(OUT, "api-log.jsonl"), "a", encoding="utf-8")
    saved = []

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=False)
        ctx = browser.new_context(accept_downloads=True, locale="es-CL")
        page = ctx.new_page()

        def on_request(req):
            if "zeusr.sii.cl" in req.url or req.resource_type not in ("xhr", "fetch", "document"):
                return
            api_log.write(json.dumps({"t": time.strftime("%H:%M:%S"), "method": req.method, "url": req.url.split("?")[0],
                                      "query": req.url.split("?", 1)[1][:300] if "?" in req.url else None,
                                      "fields": safe_fields(req.post_data)}, ensure_ascii=False) + "\n")
            api_log.flush()

        def on_response(res):
            if "sii.cl" not in res.url or "zeusr" in res.url:
                return
            ct = res.headers.get("content-type", "")
            if res.request.resource_type in ("xhr", "fetch"):
                api_log.write(json.dumps({"t": time.strftime("%H:%M:%S"), "response": res.url.split("?")[0], "status": res.status, "type": ct[:60]}) + "\n")
                api_log.flush()

        def on_download(d):
            name = d.suggested_filename or f"catastro-{int(time.time())}"
            path = os.path.join(FILES, name)
            d.save_as(path)
            saved.append(path)
            print(f"  guardado: {path} ({os.path.getsize(path) / 1e6:.1f} MB)")

        ctx.on("request", on_request)
        ctx.on("response", on_response)
        page.on("download", on_download)
        ctx.on("page", lambda p: p.on("download", on_download))

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
        time.sleep(3)
        cookies = {c["name"] for c in ctx.cookies()}
        if "TOKEN" not in cookies:
            print("No se pudo confirmar el ingreso (sin cookie TOKEN). Revisa la ventana: si el SII muestra un error de clave,"
                  " ciérrala; no reintento para no bloquear la cuenta.")
        if "sismunInternet6" not in page.url:
            page.goto(SERVICE, wait_until="domcontentloaded")

        print("\nListo. En la ventana del navegador elige el período (último semestre) y las comunas o el archivo nacional,"
              " y descarga. Los archivos se guardan solos en:\n  " + FILES)
        print("Cierra la ventana cuando termines.\n")
        try:
            while browser.is_connected() and any(not p.is_closed() for p in ctx.pages):
                time.sleep(1)
        except KeyboardInterrupt:
            pass
        try:
            browser.close()
        except Exception:
            pass

    api_log.close()
    print(f"\n{len(saved)} archivo(s) descargado(s) en {FILES}")
    print(f"Registro de llamadas del servicio (sin claves): {os.path.join(OUT, 'api-log.jsonl')}")


if __name__ == "__main__":
    main()
